const axios = require('axios');

/**
 * Tracker.gg API Service
 * Used for detailed player statistics
 */
class TrackerService {
  constructor() {
    this.baseUrl = 'https://api.tracker.gg/api/v2/valorant';
    this.apiKey = process.env.TRACKER_API_KEY || '';
  }

  /**
   * Get headers for Tracker API
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'TRN-Api-Key': this.apiKey
    };
  }

  /**
   * Get player profile with stats
   */
  async getProfile(name, tag) {
    if (!this.apiKey) {
      const error = new Error('TRACKER_API_KEY is not configured');
      error.code = 'TRACKER_KEY_MISSING';
      throw error;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/standard/profile/riot/${encodeURIComponent(name)}%23${encodeURIComponent(tag)}`,
        { headers: this.getHeaders() }
      );

      const data = response.data.data;
      
      return {
        platformInfo: data.platformInfo,
        metadata: data.metadata,
        segments: data.segments,
        availableSegments: data.availableSegments,
        expiryDate: data.expiryDate
      };
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`Tracker.gg: Profile not found for ${name}#${tag}`);
        return null;
      }
      if (error.response?.status === 401 || error.response?.status === 403) {
        error.code = 'TRACKER_AUTH_FAILED';
      } else if (error.response?.status === 429) {
        error.code = 'TRACKER_RATE_LIMITED';
      }
      console.error('Tracker.gg API error:', error.message);
      throw error;
    }
  }

  /**
   * Extract key stats from profile data
   */
  extractKeyStats(profileData) {
    if (!profileData || !profileData.segments) {
      return null;
    }

    // Find the overview segment (contains overall stats)
    const overview = profileData.segments.find(s => s.type === 'overview');
    
    if (!overview) {
      return null;
    }

    const stats = overview.stats;

    const getStatObject = (keys = []) => {
      for (const key of keys) {
        if (stats[key]) return stats[key];
      }
      return null;
    };

    const getValue = (keys = [], fallback = 0) => {
      const stat = getStatObject(keys);
      if (!stat) return fallback;
      return stat.value ?? fallback;
    };

    const getDisplay = (keys = [], fallback = null) => {
      const stat = getStatObject(keys);
      if (!stat) return fallback;
      return stat.displayValue ?? fallback;
    };

    const getTopPct = (keys = []) => {
      const stat = getStatObject(keys);
      if (!stat || stat.percentile === null || stat.percentile === undefined) return null;
      const percentile = Number(stat.percentile);
      if (Number.isNaN(percentile)) return null;
      // Tracker percentile is "better than X%"; UI wants "Top Y%".
      return Number((100 - percentile).toFixed(1));
    };

    return {
      // Combat stats
      kills: getValue(['kills']),
      deaths: getValue(['deaths']),
      assists: getValue(['assists']),
      kd: getValue(['kDRatio', 'kdRatio', 'kd']),
      kda: getValue(['kDARatio', 'kdaRatio', 'kda']),
      
      // Performance
      headshotPct: getValue(['headshotsPercentage', 'headshotPercentage', 'hsPercentage', 'hsPct']),
      damagePerRound: getValue(['damagePerRound', 'avgDamagePerRound', 'adr']),
      kast: getValue(['kast', 'KAST', 'kastPercentage'], null),
      ddaPerRound: getValue(['damageDeltaPerRound', 'ddaPerRound', 'damageDelta', 'ddDeltaPerRound'], null),
      
      // Match stats
      matchesPlayed: getValue(['matchesPlayed']),
      matchesWon: getValue(['matchesWon']),
      matchesLost: getValue(['matchesLost']),
      winRate: getValue(['matchesWinPct', 'winPercentage', 'winRate']),
      
      // Rounds
      roundsPlayed: getValue(['roundsPlayed']),
      roundsWon: getValue(['roundsWon']),
      
      // Score
      score: getValue(['score']),
      scorePerRound: getValue(['scorePerRound']),
      
      // Playtime
      timePlayed: getDisplay(['timePlayed'], '0h 0m'),

      // Top % fields for the requested cards
      kdTopPct: getTopPct(['kDRatio', 'kdRatio', 'kd']),
      headshotTopPct: getTopPct(['headshotsPercentage', 'headshotPercentage', 'hsPercentage', 'hsPct']),
      winRateTopPct: getTopPct(['matchesWinPct', 'winPercentage', 'winRate']),
      damagePerRoundTopPct: getTopPct(['damagePerRound', 'avgDamagePerRound', 'adr']),
      kastTopPct: getTopPct(['kast', 'KAST', 'kastPercentage']),
      ddaPerRoundTopPct: getTopPct(['damageDeltaPerRound', 'ddaPerRound', 'damageDelta', 'ddDeltaPerRound'])
    };
  }

  /**
   * Get rank data from profile
   */
  extractRankData(profileData) {
    if (!profileData || !profileData.segments) {
      return null;
    }

    const overview = profileData.segments.find(s => s.type === 'overview');
    
    if (!overview || !overview.stats.rank) {
      return {
        tier: 'Unranked',
        tierNumber: 0,
        rr: 0,
        peakRank: 'Unranked'
      };
    }

    return {
      tier: overview.stats.rank.metadata?.tierName || 'Unranked',
      tierNumber: overview.stats.rank.value || 0,
      rr: overview.stats.rankedRating?.value || 0,
      peakRank: overview.stats.peakRank?.metadata?.tierName || 'Unranked'
    };
  }

  /**
   * Get agent-specific stats
   */
  extractAgentStats(profileData) {
    if (!profileData || !profileData.segments) {
      return [];
    }

    const agentSegments = profileData.segments.filter(s => s.type === 'agent');
    
    return agentSegments.map(agent => ({
      name: agent.metadata.name,
      imageUrl: agent.metadata.imageUrl,
      matches: agent.stats.matchesPlayed?.value || 0,
      wins: agent.stats.matchesWon?.value || 0,
      winRate: agent.stats.matchesWinPct?.value || 0,
      kd: agent.stats.kDRatio?.value || 0,
      kda: agent.stats.kDARatio?.value || 0,
      kills: agent.stats.kills?.value || 0,
      deaths: agent.stats.deaths?.value || 0,
      assists: agent.stats.assists?.value || 0
    })).sort((a, b) => b.matches - a.matches); // Sort by most played
  }

  extractRawOverviewStats(profileData) {
    if (!profileData || !profileData.segments) {
      return null;
    }

    const overview = profileData.segments.find(s => s.type === 'overview');
    if (!overview || !overview.stats) {
      return null;
    }

    const raw = {};
    for (const [key, value] of Object.entries(overview.stats)) {
      raw[key] = {
        value: value?.value ?? null,
        displayValue: value?.displayValue ?? null,
        displayName: value?.displayName ?? key
      };
    }
    return raw;
  }

  /**
   * Get comprehensive player stats
   */
  async getPlayerStats(name, tag) {
    try {
      const profile = await this.getProfile(name, tag);
      
      if (!profile) {
        return { data: null, unavailableReason: 'tracker_profile_not_found' };
      }

      return {
        data: {
          overview: this.extractKeyStats(profile),
          rank: this.extractRankData(profile),
          agents: this.extractAgentStats(profile),
          rawOverview: this.extractRawOverviewStats(profile),
          expiryDate: profile.expiryDate
        },
        unavailableReason: null
      };
    } catch (error) {
      console.error('Error getting player stats:', error.message);
      if (error.code === 'TRACKER_KEY_MISSING') {
        return { data: null, unavailableReason: 'tracker_key_missing' };
      }
      if (error.code === 'TRACKER_AUTH_FAILED') {
        return { data: null, unavailableReason: 'tracker_auth_failed' };
      }
      if (error.code === 'TRACKER_RATE_LIMITED') {
        return { data: null, unavailableReason: 'tracker_rate_limited' };
      }
      return { data: null, unavailableReason: 'tracker_unavailable' };
    }
  }
}

module.exports = new TrackerService();
