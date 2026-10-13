const RIOT_TIME_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})$/;

const isPartyQueueing = (party) => party?.State === 'MATCHMAKING';

const parseRiotQueueTime = (value) => {
  const match = RIOT_TIME_PATTERN.exec(String(value || ''));
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (year < 2000) return null;
  return Date.UTC(year, month - 1, day, hour, minute, second);
};

module.exports = { isPartyQueueing, parseRiotQueueTime };
