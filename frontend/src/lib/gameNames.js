const MAP_CODENAMES = {
  Infinity: 'Abyss',
  Ascent: 'Ascent',
  Duality: 'Bind',
  Foxtrot: 'Breeze',
  Canyon: 'Fracture',
  Triad: 'Haven',
  Port: 'Icebox',
  Jam: 'Lotus',
  Pitt: 'Pearl',
  Bonsai: 'Split',
  Juliett: 'Sunset',
  HURM_Alley: 'District',
  HURM_Helix: 'Drift',
  HURM_Bowl: 'Kasbah',
  HURM_Yard: 'Piazza',
  HURM_HighTide: 'Glitch',
  Poveglia: 'Range',
  Rook: 'Corrode'
};

const QUEUE_LABELS = {
  competitive: 'Competitive',
  unrated: 'Unrated',
  swiftplay: 'Swiftplay',
  spikerush: 'Spike Rush',
  deathmatch: 'Deathmatch',
  ggteam: 'Escalation',
  onefa: 'Replication',
  hurm: 'Team Deathmatch',
  snowball: 'Snowball Fight',
  premier: 'Premier',
  newmap: 'New Map',
  custom: 'Custom'
};

const MODE_PATTERNS = [
  ['QuickBomb', 'Spike Rush'],
  ['Swiftplay', 'Swiftplay'],
  ['HURM', 'Team Deathmatch'],
  ['Deathmatch', 'Deathmatch'],
  ['GunGame', 'Escalation'],
  ['OneForAll', 'Replication'],
  ['Snowball', 'Snowball Fight'],
  ['Bomb', 'Standard']
];

const titleCase = (value) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const mapName = (mapPath) => {
  const segments = String(mapPath || '').split('/').filter(Boolean);
  if (segments.length === 0) return 'Unknown map';
  const codename = segments[segments.length - 1];
  return MAP_CODENAMES[codename] || codename;
};

export const queueLabel = (queueId) => {
  if (!queueId) return 'Unknown';
  return QUEUE_LABELS[queueId] || titleCase(queueId);
};

export const modeName = ({ queueId, modeId } = {}) => {
  if (queueId) return queueLabel(queueId);
  const match = MODE_PATTERNS.find(([pattern]) => String(modeId || '').includes(pattern));
  return match ? match[1] : 'Custom';
};
