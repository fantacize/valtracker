import { useEffect, useMemo, useState } from 'react';
import './AccountHub.css';

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value) || 0);

const formatDuration = (seconds) => {
  const total = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

function Price({ cost }) {
  if (!Array.isArray(cost) || cost.length === 0) return <span className="account-price muted">Price unavailable</span>;
  return (
    <span className="account-price">
      {cost.map((currency) => (
        <span key={currency.currencyId} title={currency.name}>
          {currency.icon && <img src={currency.icon} alt="" />}
          {formatNumber(currency.amount)}
        </span>
      ))}
    </span>
  );
}

function ImageTile({ image, name, className = '' }) {
  return (
    <div className={`account-image ${className}`}>
      {image ? <img src={image} alt="" loading="lazy" /> : <span>{name?.slice(0, 1) || '?'}</span>}
    </div>
  );
}

function ShopView({ store }) {
  if (!store) return <div className="account-empty">The shop is temporarily unavailable.</div>;
  return (
    <div className="account-view-stack">
      {store.bundles.length > 0 && (
        <section>
          <div className="account-section-heading">
            <div><span>Featured</span><h3>Bundles</h3></div>
          </div>
          <div className="bundle-grid">
            {store.bundles.map((bundle) => (
              <article className="bundle-card" key={bundle.id}>
                <ImageTile image={bundle.image} name={bundle.name} className="bundle-image" />
                <div className="bundle-overlay">
                  <div><span className="account-kicker">{formatDuration(bundle.remainingSeconds)} remaining</span><h4>{bundle.name}</h4></div>
                  <Price cost={bundle.cost} />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="account-section-heading">
          <div><span>Daily rotation</span><h3>Your offers</h3></div>
          <small>Refreshes in {formatDuration(store.dailyRemainingSeconds)}</small>
        </div>
        <div className="offer-grid">
          {store.dailyOffers.map((offer) => (
            <article className="offer-card" key={offer.id}>
              <ImageTile image={offer.image} name={offer.name} />
              <div className="offer-copy"><h4>{offer.name}</h4><Price cost={offer.cost} /></div>
            </article>
          ))}
        </div>
      </section>

      <div className="account-footnote">
        {store.accessoryOfferCount} accessory offers available. Purchases are intentionally disabled.
      </div>
    </div>
  );
}

function MissionsView({ missions }) {
  if (!missions) return <div className="account-empty">Mission data is temporarily unavailable.</div>;
  return (
    <div className="mission-list">
      {missions.missions.map((mission) => {
        const percent = mission.target > 0 ? Math.min(100, Math.round((mission.progress / mission.target) * 100)) : 0;
        return (
          <article className={`mission-card ${mission.complete ? 'complete' : ''}`} key={mission.id}>
            <div className="mission-topline">
              <span>{mission.type}</span>
              <strong>{formatNumber(mission.xp)} XP</strong>
            </div>
            <h3>{mission.title}</h3>
            <div className="mission-progress"><span style={{ width: `${mission.complete ? 100 : percent}%` }} /></div>
            <div className="mission-meta">
              <span>{mission.complete ? 'Completed' : `${formatNumber(mission.progress)} / ${formatNumber(mission.target)}`}</span>
              {mission.expirationTime && <span>Ends {new Date(mission.expirationTime).toLocaleDateString()}</span>}
            </div>
          </article>
        );
      })}
      {missions.missions.length === 0 && <div className="account-empty">No active missions.</div>}
    </div>
  );
}

function CollectionView({ inventory }) {
  const [query, setQuery] = useState('');
  const filteredSkins = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return inventory?.skins || [];
    return (inventory?.skins || []).filter((skin) => skin.name.toLowerCase().includes(needle));
  }, [inventory, query]);

  if (!inventory) return <div className="account-empty">Collection data is temporarily unavailable.</div>;
  return (
    <div className="account-view-stack">
      <div className="entitlement-summary">
        {inventory.groups.map((group) => (
          <article key={group.itemTypeId}><strong>{formatNumber(group.count)}</strong><span>{group.name}</span></article>
        ))}
      </div>
      <div className="collection-toolbar">
        <div><span className="account-kicker">Collection</span><h3>{formatNumber(inventory.skins.length)} weapon skins</h3></div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skins" aria-label="Search owned skins" />
      </div>
      <div className="skin-grid">
        {filteredSkins.map((skin) => (
          <article className="skin-card" key={skin.id}>
            <ImageTile image={skin.image} name={skin.name} />
            <h4>{skin.name}</h4>
          </article>
        ))}
      </div>
      {filteredSkins.length === 0 && <div className="account-empty">No skins match “{query}”.</div>}
    </div>
  );
}

function LoadoutView({ loadout }) {
  if (!loadout) return <div className="account-empty">Loadout data is temporarily unavailable.</div>;
  return (
    <div className="loadout-grid">
      {loadout.guns.map((gun) => (
        <article className="loadout-card" key={gun.weaponId}>
          <ImageTile image={gun.image} name={gun.weaponName} />
          <span>{gun.weaponName}</span>
          <h4>{gun.skinName}</h4>
        </article>
      ))}
    </div>
  );
}

function AccountHub({ apiUrl, enabled }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('shop');

  const loadOverview = async (force = false) => {
    if (!enabled) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/account/overview${force ? '?refresh=1' : ''}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || `Request failed (${response.status})`);
      setData(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) loadOverview(false);
    else setData(null);
  }, [enabled]);

  if (!enabled) {
    return <div className="account-empty tall"><h3>Connect your local Riot account</h3><p>Open Riot Client, then use the account button above. Your session stays on this computer.</p></div>;
  }

  if (loading && !data) {
    return <div className="account-empty tall"><div className="loader" /><h3>Loading your Riot account</h3><p>Syncing the shop, missions, collection, and loadout.</p></div>;
  }

  if (error && !data) {
    return <div className="account-empty tall error"><h3>Could not load account data</h3><p>{error}</p><button type="button" onClick={() => loadOverview(true)}>Try again</button></div>;
  }

  const sections = [
    ['shop', 'Daily shop'],
    ['missions', 'Missions'],
    ['collection', 'Collection'],
    ['loadout', 'Loadout']
  ];

  return (
    <div className="account-hub">
      <div className="account-overview-bar">
        <div className="account-level"><span>Account level</span><strong>{formatNumber(data?.xp?.level || data?.loadout?.accountLevel)}</strong></div>
        <div className="wallet-row">
          {(data?.wallet?.currencies || []).map((currency) => (
            <div className="wallet-item" key={currency.id} title={currency.name}>
              {currency.icon && <img src={currency.icon} alt="" />}
              <span>{currency.name}</span><strong>{formatNumber(currency.amount)}</strong>
            </div>
          ))}
        </div>
        <button className="account-refresh" type="button" onClick={() => loadOverview(true)} disabled={loading}>{loading ? 'Syncing...' : 'Refresh'}</button>
      </div>

      {error && <div className="account-warning">Showing the last successful sync. {error}</div>}
      {Object.keys(data?.errors || {}).length > 0 && <div className="account-warning">Some Riot services did not respond: {Object.keys(data.errors).join(', ')}.</div>}

      <div className="account-tabs" role="tablist" aria-label="Account sections">
        {sections.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={activeSection === id} className={activeSection === id ? 'active' : ''} onClick={() => setActiveSection(id)}>{label}</button>
        ))}
      </div>

      <div className="account-section">
        {activeSection === 'shop' && <ShopView store={data?.store} />}
        {activeSection === 'missions' && <MissionsView missions={data?.missions} />}
        {activeSection === 'collection' && <CollectionView inventory={data?.inventory} />}
        {activeSection === 'loadout' && <LoadoutView loadout={data?.loadout} />}
      </div>
    </div>
  );
}

export default AccountHub;
