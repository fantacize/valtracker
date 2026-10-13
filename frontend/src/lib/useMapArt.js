import { useEffect, useState } from 'react';
import { findMapArt } from './gameArt';

let mapsRequest = null;

const loadMaps = () => {
  if (!mapsRequest) {
    mapsRequest = fetch('https://valorant-api.com/v1/maps')
      .then((response) => response.json())
      .then((payload) => payload?.data || [])
      .catch(() => {
        mapsRequest = null;
        return [];
      });
  }
  return mapsRequest;
};

export const useMapArt = (mapPath) => {
  const [art, setArt] = useState(null);

  useEffect(() => {
    let active = true;
    loadMaps().then((maps) => {
      if (active) setArt(findMapArt(maps, mapPath));
    });
    return () => { active = false; };
  }, [mapPath]);

  return art;
};
