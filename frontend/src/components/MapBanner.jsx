import { useMapArt } from '../lib/useMapArt';

function MapBanner({ mapPath, children }) {
  const art = useMapArt(mapPath);

  return (
    <div className={`map-banner ${art ? 'has-art' : ''}`}>
      {art && <img className="map-banner-art" src={art.splash} alt="" aria-hidden="true" />}
      <div className="map-banner-content">{children}</div>
    </div>
  );
}

export default MapBanner;
