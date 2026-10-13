const numberOrNull = (value) => {
  const number = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(number) ? null : number;
};

export const playerStatLine = (player) => {
  if (player?.yoinkStats) {
    return {
      kd: numberOrNull(player.yoinkStats.kd),
      hs: numberOrNull(player.yoinkStats.hsPct),
      wr: numberOrNull(player.yoinkStats.winRate)
    };
  }
  const stats = player?.demoStats?.stats || {};
  return { kd: numberOrNull(stats.kd), hs: numberOrNull(stats.headshotPct), wr: numberOrNull(stats.winRate) };
};

const average = (values) => {
  const present = values.filter((value) => value !== null);
  return present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0) / present.length;
};

export const teamAverages = (players) => {
  const lines = (players || []).map(playerStatLine);
  return {
    kd: average(lines.map((line) => line.kd)),
    hs: average(lines.map((line) => line.hs)),
    wr: average(lines.map((line) => line.wr))
  };
};
