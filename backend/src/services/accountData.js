const axios = require('axios');
const cacheService = require('./cache');
const valorantService = require('./valorant');

const ITEM_TYPES = {
  '01bb38e1-da47-4e6a-9b3d-945fe4655707': 'Agents',
  'f85cb6f7-33e5-4dc8-b609-ec7212301948': 'Contracts',
  'd5f120f8-ff8c-4aac-92ea-f2b5acbe9475': 'Sprays',
  'dd3bf334-87f3-40bd-b043-682a57a8dc3a': 'Buddies',
  '3f296c07-64c3-494c-923b-fe692a4fa1bd': 'Player cards',
  'e7c63390-eda7-46e0-bb7a-a6abdacd2433': 'Weapon skins',
  '3ad1b2b2-acdb-4524-852f-954a76ddae0a': 'Skin variants',
  'de7caa6b-adf7-4588-bbd1-143831e786c6': 'Titles'
};

const SKIN_ITEM_TYPE = 'e7c63390-eda7-46e0-bb7a-a6abdacd2433';
const SECTION_CACHE_PREFIX = 'account-overview:';

const normalizeId = (value) => String(value || '').toLowerCase();
const asArray = (value) => (Array.isArray(value) ? value : []);
const byUuid = (items) => new Map(
  asArray(items)
    .filter((item) => item?.uuid)
    .map((item) => [normalizeId(item.uuid), item])
);

const emptyMetadata = () => ({
  weapons: new Map(),
  skinLevels: new Map(),
  missions: new Map(),
  currencies: new Map(),
  bundles: new Map()
});

const normalizeCost = (cost, metadata) => Object.entries(cost || {}).map(([currencyId, amount]) => {
  const currency = metadata.currencies.get(normalizeId(currencyId));
  return {
    currencyId,
    name: currency?.displayName || 'Currency',
    icon: currency?.displayIcon || null,
    amount: Number(amount) || 0
  };
});

const normalizeStorefront = (raw, metadata = emptyMetadata()) => {
  const panel = raw?.SkinsPanelLayout || {};
  const explicitOffers = asArray(panel.SingleItemStoreOffers);
  const offerIds = asArray(panel.SingleItemOffers);
  const offers = explicitOffers.length > 0
    ? explicitOffers
    : offerIds.map((OfferID) => ({ OfferID, Rewards: [{ ItemID: OfferID }], Cost: {} }));

  const dailyOffers = offers.map((offer) => {
    const reward = asArray(offer?.Rewards)[0] || {};
    const itemId = reward.ItemID || offer.OfferID;
    const skin = metadata.skinLevels.get(normalizeId(itemId));
    return {
      id: offer.OfferID || itemId,
      itemId,
      name: skin?.displayName || 'Unknown skin',
      image: skin?.displayIcon || null,
      cost: normalizeCost(offer.Cost, metadata)
    };
  });

  const featured = raw?.FeaturedBundle || {};
  const bundleCandidates = asArray(featured.Bundles).length > 0
    ? featured.Bundles
    : (featured.Bundle ? [featured.Bundle] : []);
  const seenBundles = new Set();
  const bundles = bundleCandidates.flatMap((bundle) => {
    const id = bundle?.DataAssetID || bundle?.ID;
    if (!id || seenBundles.has(id)) return [];
    seenBundles.add(id);
    const details = metadata.bundles.get(normalizeId(id));
    return [{
      id,
      name: details?.displayName || 'Featured bundle',
      image: details?.displayIcon || null,
      cost: normalizeCost(bundle?.TotalDiscountedCost || bundle?.TotalBaseCost, metadata),
      discountPercent: Number(bundle?.TotalDiscountPercent) || 0,
      remainingSeconds: Number(bundle?.DurationRemainingInSeconds) || 0
    }];
  });

  return {
    dailyOffers,
    bundles,
    dailyRemainingSeconds: Number(panel.SingleItemOffersRemainingDurationInSeconds) || 0,
    accessoryOfferCount: asArray(raw?.AccessoryStore?.AccessoryStoreOffers).length,
    accessoryRemainingSeconds: Number(raw?.AccessoryStore?.AccessoryStoreRemainingDurationInSeconds) || 0,
    pluginStoreCount: asArray(raw?.PluginStores).length
  };
};

const normalizeInventory = (raw, metadata = emptyMetadata()) => {
  const groups = asArray(raw?.EntitlementsByTypes).map((group) => {
    const itemTypeId = normalizeId(group?.ItemTypeID);
    return {
      itemTypeId,
      name: ITEM_TYPES[itemTypeId] || 'Other',
      count: asArray(group?.Entitlements).length
    };
  }).sort((a, b) => b.count - a.count);

  const skinGroup = asArray(raw?.EntitlementsByTypes)
    .find((group) => normalizeId(group?.ItemTypeID) === SKIN_ITEM_TYPE);
  const uniqueSkins = new Map();
  for (const entitlement of asArray(skinGroup?.Entitlements)) {
    const itemId = entitlement?.ItemID || entitlement?.itemId;
    if (!itemId || uniqueSkins.has(normalizeId(itemId))) continue;
    const skin = metadata.skinLevels.get(normalizeId(itemId));
    uniqueSkins.set(normalizeId(itemId), {
      id: itemId,
      name: skin?.displayName || 'Unknown skin',
      image: skin?.displayIcon || null
    });
  }

  return {
    totalEntitlements: groups.reduce((sum, group) => sum + group.count, 0),
    groups,
    skins: [...uniqueSkins.values()].sort((a, b) => a.name.localeCompare(b.name))
  };
};

const normalizeMissions = (raw, metadata = emptyMetadata()) => ({
  weeklyRefillTime: raw?.MissionMetadata?.WeeklyRefillTime || null,
  missions: asArray(raw?.Missions).map((mission) => {
    const details = metadata.missions.get(normalizeId(mission?.ID));
    const objectives = asArray(details?.objectives);
    const target = Number(details?.progressToComplete)
      || objectives.reduce((sum, objective) => sum + (Number(objective?.value) || 0), 0);
    const progress = Object.values(mission?.Objectives || {})
      .reduce((sum, value) => sum + (Number(value) || 0), 0);
    const rawType = String(details?.type || 'Mission');
    return {
      id: mission?.ID,
      title: details?.title || details?.displayName || 'Mission',
      type: rawType.includes('::') ? rawType.split('::').pop() : rawType,
      xp: Number(details?.xpGrant) || 0,
      progress,
      target,
      complete: Boolean(mission?.Complete),
      expirationTime: mission?.ExpirationTime || details?.expirationDate || null
    };
  }).sort((a, b) => Number(a.complete) - Number(b.complete))
});

const normalizeWallet = (raw, metadata = emptyMetadata()) => ({
  currencies: Object.entries(raw?.Balances || {}).map(([currencyId, amount]) => {
    const currency = metadata.currencies.get(normalizeId(currencyId));
    return {
      id: currencyId,
      name: currency?.displayName || 'Currency',
      icon: currency?.displayIcon || null,
      amount: Number(amount) || 0
    };
  })
});

const normalizeLoadout = (raw, metadata = emptyMetadata()) => ({
  accountLevel: Number(raw?.Identity?.AccountLevel) || 0,
  guns: asArray(raw?.Guns).map((gun) => {
    const weapon = metadata.weapons.get(normalizeId(gun?.ID));
    const skin = metadata.skinLevels.get(normalizeId(gun?.SkinLevelID || gun?.SkinID));
    return {
      weaponId: gun?.ID,
      weaponName: weapon?.displayName || 'Unknown weapon',
      skinId: gun?.SkinLevelID || gun?.SkinID || null,
      skinName: skin?.displayName || 'Default skin',
      image: skin?.displayIcon || weapon?.displayIcon || null,
      buddyId: gun?.CharmID || null
    };
  }).sort((a, b) => a.weaponName.localeCompare(b.weaponName))
});

const normalizeXp = (raw) => ({
  level: Number(raw?.Progress?.Level) || 0,
  xp: Number(raw?.Progress?.XP) || 0,
  nextFirstWinAt: raw?.NextTimeFirstWinAvailable || null
});

class AccountDataService {
  constructor({ riot = valorantService, http = axios, cache = cacheService } = {}) {
    this.riot = riot;
    this.http = http;
    this.cache = cache;
    this.metadataInflight = null;
  }

  async getMetadata() {
    const cached = this.cache.get(`${SECTION_CACHE_PREFIX}metadata`);
    if (cached) return cached;
    if (this.metadataInflight) return this.metadataInflight;

    this.metadataInflight = (async () => {
      const endpoints = {
        weapons: 'https://valorant-api.com/v1/weapons?language=en-US',
        skinLevels: 'https://valorant-api.com/v1/weapons/skinlevels?language=en-US',
        missions: 'https://valorant-api.com/v1/missions?language=en-US',
        currencies: 'https://valorant-api.com/v1/currencies?language=en-US',
        bundles: 'https://valorant-api.com/v1/bundles?language=en-US'
      };
      const results = await Promise.allSettled(Object.entries(endpoints).map(async ([key, url]) => {
        const response = await this.http.get(url, { timeout: 10000 });
        return [key, asArray(response?.data?.data)];
      }));
      const metadata = emptyMetadata();
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const [key, items] = result.value;
        metadata[key] = byUuid(items);
      }
      this.cache.set(`${SECTION_CACHE_PREFIX}metadata`, metadata, 6 * 60 * 60 * 1000);
      return metadata;
    })();

    try {
      return await this.metadataInflight;
    } finally {
      this.metadataInflight = null;
    }
  }

  async getCachedSection(name, ttl, force, fetcher) {
    const key = `${SECTION_CACHE_PREFIX}${name}`;
    if (force) this.cache.delete(key);
    return this.cache.getOrSet(key, fetcher, ttl);
  }

  async getOverview({ force = false } = {}) {
    const user = await this.riot.getCurrentUser();
    if (!user?.puuid) throw new Error('No signed-in VALORANT session was found');

    const requests = {
      storefront: () => this.riot.makePdRequest(`/store/v3/storefront/${user.puuid}`, 'post', {}),
      inventory: () => this.riot.makePdRequest(`/store/v1/entitlements/${user.puuid}`, 'get'),
      missions: () => this.riot.makePdRequest(`/contracts/v1/contracts/${user.puuid}`, 'get'),
      xp: () => this.riot.makePdRequest(`/account-xp/v1/players/${user.puuid}`, 'get'),
      wallet: () => this.riot.makePdRequest(`/store/v1/wallet/${user.puuid}`, 'get'),
      loadout: () => this.riot.makePdRequest(`/personalization/v3/players/${user.puuid}/playerloadout`, 'get')
    };
    const ttls = {
      storefront: 30 * 1000,
      inventory: 10 * 60 * 1000,
      missions: 60 * 1000,
      xp: 60 * 1000,
      wallet: 30 * 1000,
      loadout: 60 * 1000
    };

    const [metadataResult, ...sectionResults] = await Promise.allSettled([
      this.getMetadata(),
      ...Object.entries(requests).map(([name, fetcher]) => (
        this.getCachedSection(name, ttls[name], force, fetcher)
      ))
    ]);
    const metadata = metadataResult.status === 'fulfilled' ? metadataResult.value : emptyMetadata();
    const names = Object.keys(requests);
    const raw = {};
    const errors = {};
    sectionResults.forEach((result, index) => {
      const name = names[index];
      if (result.status === 'fulfilled') raw[name] = result.value;
      else errors[name] = result.reason?.message || 'Request failed';
    });

    return {
      store: raw.storefront ? normalizeStorefront(raw.storefront, metadata) : null,
      inventory: raw.inventory ? normalizeInventory(raw.inventory, metadata) : null,
      missions: raw.missions ? normalizeMissions(raw.missions, metadata) : null,
      xp: raw.xp ? normalizeXp(raw.xp) : null,
      wallet: raw.wallet ? normalizeWallet(raw.wallet, metadata) : null,
      loadout: raw.loadout ? normalizeLoadout(raw.loadout, metadata) : null,
      errors,
      timestamp: Date.now()
    };
  }
}

module.exports = new AccountDataService();
module.exports.AccountDataService = AccountDataService;
module.exports.normalizers = {
  normalizeStorefront,
  normalizeInventory,
  normalizeMissions,
  normalizeWallet,
  normalizeLoadout,
  normalizeXp
};
module.exports.emptyMetadata = emptyMetadata;
