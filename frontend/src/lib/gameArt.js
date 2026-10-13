const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const agentIconUrl = (characterId) => {
  const id = String(characterId || '').toLowerCase();
  return UUID_PATTERN.test(id) ? `https://media.valorant-api.com/agents/${id}/displayicon.png` : null;
};

export const findMapArt = (maps, mapPath) => {
  const wanted = String(mapPath || '').toLowerCase();
  const map = (maps || []).find((entry) => String(entry?.mapUrl || '').toLowerCase() === wanted);
  return map ? { name: map.displayName, splash: map.splash, banner: map.listViewIcon } : null;
};
