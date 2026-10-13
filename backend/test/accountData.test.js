const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizers, emptyMetadata } = require('../src/services/accountData');

const metadataFixture = () => {
  const metadata = emptyMetadata();
  metadata.skinLevels.set('skin-level', {
    uuid: 'skin-level',
    displayName: 'Prime Vandal Level 4',
    displayIcon: 'https://example.test/prime.png'
  });
  metadata.weapons.set('weapon', { uuid: 'weapon', displayName: 'Vandal' });
  metadata.currencies.set('vp', { uuid: 'vp', displayName: 'VALORANT Points', displayIcon: 'vp.png' });
  metadata.bundles.set('bundle', { uuid: 'bundle', displayName: 'Prime Collection', displayIcon: 'bundle.png' });
  metadata.missions.set('mission', {
    uuid: 'mission',
    title: 'Use Your Ultimate',
    type: 'EAresMissionType::Weekly',
    xpGrant: 12000,
    progressToComplete: 15,
    objectives: [{ objectiveUuid: 'objective', value: 15 }]
  });
  return metadata;
};

test('normalizes the v3 storefront and maps offer metadata', () => {
  const result = normalizers.normalizeStorefront({
    FeaturedBundle: {
      Bundles: [{ DataAssetID: 'bundle', TotalDiscountedCost: { vp: 7100 }, DurationRemainingInSeconds: 3600 }]
    },
    SkinsPanelLayout: {
      SingleItemStoreOffers: [{ OfferID: 'offer', Rewards: [{ ItemID: 'skin-level' }], Cost: { vp: 1775 } }],
      SingleItemOffersRemainingDurationInSeconds: 1800
    }
  }, metadataFixture());

  assert.equal(result.dailyOffers[0].name, 'Prime Vandal Level 4');
  assert.equal(result.dailyOffers[0].cost[0].amount, 1775);
  assert.equal(result.dailyOffers[0].cost[0].name, 'VALORANT Points');
  assert.equal(result.bundles[0].name, 'Prime Collection');
  assert.equal(result.dailyRemainingSeconds, 1800);
});

test('deduplicates owned skin entitlements while preserving category totals', () => {
  const result = normalizers.normalizeInventory({
    EntitlementsByTypes: [{
      ItemTypeID: 'e7c63390-eda7-46e0-bb7a-a6abdacd2433',
      Entitlements: [{ ItemID: 'skin-level' }, { ItemID: 'skin-level' }]
    }]
  }, metadataFixture());

  assert.equal(result.totalEntitlements, 2);
  assert.equal(result.groups[0].name, 'Weapon skins');
  assert.equal(result.skins.length, 1);
  assert.equal(result.skins[0].name, 'Prime Vandal Level 4');
});

test('combines mission progress with localized mission metadata', () => {
  const result = normalizers.normalizeMissions({
    Missions: [{
      ID: 'mission',
      Objectives: { objective: 9 },
      Complete: false,
      ExpirationTime: '2026-09-10T00:00:00Z'
    }]
  }, metadataFixture());

  assert.deepEqual(result.missions[0], {
    id: 'mission',
    title: 'Use Your Ultimate',
    type: 'Weekly',
    xp: 12000,
    progress: 9,
    target: 15,
    complete: false,
    expirationTime: '2026-09-10T00:00:00Z'
  });
});

test('maps equipped gun and skin names without exposing session data', () => {
  const result = normalizers.normalizeLoadout({
    Identity: { AccountLevel: 42 },
    Guns: [{ ID: 'weapon', SkinLevelID: 'skin-level', CharmID: 'buddy' }]
  }, metadataFixture());

  assert.equal(result.accountLevel, 42);
  assert.equal(result.guns[0].weaponName, 'Vandal');
  assert.equal(result.guns[0].skinName, 'Prime Vandal Level 4');
  assert.equal(result.guns[0].buddyId, 'buddy');
});
