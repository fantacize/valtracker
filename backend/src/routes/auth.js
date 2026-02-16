const express = require('express');
const router = express.Router();
const valorantService = require('../services/valorant');

const resolveCurrentIdentity = async () => {
  const user = await valorantService.getCurrentUser();
  if (!user?.puuid) {
    return { loggedIn: false, user: null, source: 'local_client' };
  }

  const names = await valorantService.resolvePuuidsToNames([user.puuid]);
  const me = names?.[user.puuid] || null;

  return {
    loggedIn: true,
    source: 'local_client',
    user: {
      puuid: user.puuid,
      region: user.region || 'na',
      gameName: me?.name || null,
      tagLine: me?.tag || null
    }
  };
};

// Local-client auth status (no external OAuth yet)
router.get('/status', async (req, res) => {
  try {
    const result = await resolveCurrentIdentity();
    return res.json({
      ...result,
      timestamp: Date.now()
    });
  } catch (error) {
    return res.json({
      loggedIn: false,
      source: 'local_client',
      user: null,
      timestamp: Date.now(),
      message: error.message
    });
  }
});

// Explicit local login trigger (refreshes local identity from running client)
router.post('/login/local', async (req, res) => {
  try {
    const result = await resolveCurrentIdentity();
    if (!result.loggedIn) {
      return res.status(400).json({
        loggedIn: false,
        source: 'local_client',
        error: 'VALORANT local client session not available',
        message: 'Open VALORANT and sign in to Riot client first.'
      });
    }

    return res.json({
      ...result,
      timestamp: Date.now()
    });
  } catch (error) {
    return res.status(500).json({
      loggedIn: false,
      source: 'local_client',
      error: 'Failed to login with local client',
      message: error.message
    });
  }
});

module.exports = router;
