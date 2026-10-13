const express = require('express');
const accountDataService = require('../services/accountData');

const router = express.Router();

router.get('/overview', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const overview = await accountDataService.getOverview({
      force: req.query.refresh === '1'
    });
    return res.json(overview);
  } catch (error) {
    const unavailable = /not running|lockfile|signed-in|riot tokens|routing/i.test(error.message || '');
    return res.status(unavailable ? 503 : 500).json({
      error: 'Failed to load account overview',
      message: unavailable
        ? 'Open VALORANT and sign in, then try again.'
        : error.message
    });
  }
});

module.exports = router;
