const toPerformance = (totals) => ({
  kd: totals.deaths > 0 ? Number((totals.kills / totals.deaths).toFixed(2)) : totals.kills,
  hsPct: totals.hits > 0 ? Math.round((totals.headshots / totals.hits) * 100) : null,
  matches: totals.matches
});

const performanceInMatch = (matchDetails, puuid) => {
  const player = (matchDetails?.players || []).find((entry) => entry?.subject === puuid);
  if (!player) return null;

  const shots = (matchDetails?.roundResults || [])
    .flatMap((round) => round?.playerStats || [])
    .filter((stats) => stats?.subject === puuid)
    .flatMap((stats) => stats?.damage || [])
    .reduce((totals, dmg) => ({
      headshots: totals.headshots + Number(dmg?.headshots || 0),
      hits: totals.hits + Number(dmg?.headshots || 0) + Number(dmg?.bodyshots || 0) + Number(dmg?.legshots || 0)
    }), { headshots: 0, hits: 0 });

  return {
    kills: Number(player?.stats?.kills || 0),
    deaths: Number(player?.stats?.deaths || 0),
    ...shots
  };
};

const aggregatePerformance = (matchDetailsList, puuid) => {
  const totals = (matchDetailsList || [])
    .map((matchDetails) => performanceInMatch(matchDetails, puuid))
    .filter(Boolean)
    .reduce((sum, match) => ({
      kills: sum.kills + match.kills,
      deaths: sum.deaths + match.deaths,
      headshots: sum.headshots + match.headshots,
      hits: sum.hits + match.hits,
      matches: sum.matches + 1
    }), { kills: 0, deaths: 0, headshots: 0, hits: 0, matches: 0 });

  if (totals.matches === 0) return { kd: null, hsPct: null, matches: 0 };

  return toPerformance(totals);
};

const seasonWinRate = ({ wins, games }) => (games > 0 ? Math.trunc((wins / games) * 100) : null);

const inSeason = (seasonId) => (match) => match?.meta?.season?.id === seasonId;

const aggregateActPerformance = (storedMatches, seasonId) => {
  const totals = (storedMatches || [])
    .filter(inSeason(seasonId))
    .map((match) => match?.stats || {})
    .reduce((sum, stats) => {
      const head = Number(stats?.shots?.head || 0);
      return {
        kills: sum.kills + Number(stats?.kills || 0),
        deaths: sum.deaths + Number(stats?.deaths || 0),
        headshots: sum.headshots + head,
        hits: sum.hits + head + Number(stats?.shots?.body || 0) + Number(stats?.shots?.leg || 0),
        matches: sum.matches + 1
      };
    }, { kills: 0, deaths: 0, headshots: 0, hits: 0, matches: 0 });

  if (totals.matches === 0) return null;

  return toPerformance(totals);
};

const isActComplete = ({ matches, seasonId, hasMore }) =>
  !hasMore || (matches || []).some((match) => !inSeason(seasonId)(match));

const applyActPerformance = (yoinkStatsByPuuid, actByPuuid) => Object.fromEntries(
  Object.entries(yoinkStatsByPuuid || {}).map(([puuid, stats]) => {
    const act = actByPuuid?.[puuid];
    if (!stats) return [puuid, stats];
    if (!act) return [puuid, { ...stats, statScope: 'recent' }];
    return [puuid, { ...stats, kd: act.kd, hsPct: act.hsPct, statMatches: act.matches, statScope: 'act' }];
  })
);

module.exports = { aggregatePerformance, seasonWinRate, aggregateActPerformance, isActComplete, applyActPerformance };
