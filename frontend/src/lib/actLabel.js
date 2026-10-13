const YEARLY_SEASON = /^v(\d{2})$/i;

const actNumberOf = ({ actNumber, actName }) => {
  if (actNumber) return Number(actNumber);
  const match = String(actName || '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
};

const episodeParts = (episodeNumber) => {
  if (!episodeNumber) return null;
  const yearly = YEARLY_SEASON.exec(String(episodeNumber));
  if (yearly) return { short: `V${yearly[1]}`, long: `Season 20${yearly[1]}` };
  return { short: `E${episodeNumber}`, long: `Episode ${episodeNumber}` };
};

export const formatActLabel = (meta) => {
  if (!meta) return null;
  const act = actNumberOf(meta);
  if (!act) return null;

  const episode = episodeParts(meta.episodeNumber);
  return episode
    ? { short: `${episode.short} A${act}`, long: `${episode.long}, Act ${act}` }
    : { short: `A${act}`, long: `Act ${act}` };
};
