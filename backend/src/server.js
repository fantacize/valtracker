require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const matchRoutes = require('./routes/match');
const playerRoutes = require('./routes/player');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/match', matchRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/auth', authRoutes);

const resolveFrontendDistPath = () => {
  // When packaged, serve files placed next to the exe.
  if (process.pkg) {
    const nextToExe = path.join(path.dirname(process.execPath), 'frontend-dist');
    if (fs.existsSync(nextToExe)) return nextToExe;
    return null;
  }

  // During normal dev/runtime, serve from frontend build output.
  const localDist = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
  return fs.existsSync(localDist) ? localDist : null;
};

const frontendDistPath = resolveFrontendDistPath();
if (frontendDistPath) {
  app.use(express.static(frontendDistPath));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

// Root endpoint / API docs
app.get('/api', (req, res) => {
  res.json({
    name: 'VALORANT Skin Tracker API',
    version: '1.0.0',
    endpoints: {
      match: {
        status: 'GET /api/match/status',
        current: 'GET /api/match/current',
        pregame: 'GET /api/match/pregame/current',
        loadouts: 'GET /api/match/loadouts/:matchId',
        queueStatus: 'GET /api/match/queue-status?region=na',
        queueModes: 'GET /api/match/queue/modes',
        queueJoin: 'POST /api/match/queue/join'
      },
      auth: {
        status: 'GET /api/auth/status',
        localLogin: 'POST /api/auth/login/local'
      },
      player: {
        byName: 'GET /api/player/:name/:tag',
        byPuuid: 'GET /api/player/puuid/:puuid',
        matchHistory: 'GET /api/player/match-history/:name/:tag'
      }
    }
  });
});

if (frontendDistPath) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      name: 'VALORANT Skin Tracker API',
      message: 'Frontend build not found. Run frontend build or exe packaging.',
      apiDocs: '/api'
    });
  });
}

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🎮 VALORANT Skin Tracker API                       ║
║                                                       ║
║   Server running on: http://localhost:${PORT}        ║
║                                                       ║
║   Endpoints:                                          ║
║   - GET /api/match/current    (get match + skins)    ║
║   - GET /api/player/:name/:tag (get player stats)    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
  
  console.log('✓ Server started successfully');
  console.log('✓ CORS enabled');
  console.log('✓ Waiting for requests...\n');
});

module.exports = app;
