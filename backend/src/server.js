require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const matchRoutes = require('./routes/match');
const playerRoutes = require('./routes/player');
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const runtimeStateService = require('./services/runtimeState');
const cacheService = require('./services/cache');
const valorantService = require('./services/valorant');

const app = express();
const PORT = process.env.PORT || 3000;

// Local-only API. Browser development is allowed from the two Vite ports; the
// packaged desktop UI is same-origin and does not need CORS.
const allowedDevelopmentOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
]);
app.use((req, res, next) => {
  const sameOrigin = `http://${req.get('host')}`;
  return cors({
    origin(origin, callback) {
      if (!origin || origin === sameOrigin || allowedDevelopmentOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed'));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  })(req, res, next);
});
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
app.use('/api/account', accountRoutes);

const resolveFrontendDistPath = () => {
  // `pkg` stores the production frontend inside the executable snapshot.
  if (process.pkg) {
    const embeddedDist = path.join(__dirname, '..', 'public');
    return fs.existsSync(embeddedDist) ? embeddedDist : null;
  }

  const localPublic = path.resolve(__dirname, '..', 'public');
  if (fs.existsSync(localPublic)) return localPublic;

  // During development, fall back to Vite's build output.
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
      account: {
        overview: 'GET /api/account/overview'
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
  if (err?.message === 'Origin not allowed') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  console.error('Error:', err);
  return res.status(500).json({
    error: 'Internal server error',
    message: err.message 
  });
});

runtimeStateService.on('state-change', ({ previous, current }) => {
  console.log(`Runtime state changed: ${previous || 'unknown'} -> ${current || 'unknown'}`);
  cacheService.delete('currentMatch');
  cacheService.delete('localQueueModes');
});

runtimeStateService.on('connection-change', ({ previous, current }) => {
  console.log(
    `VALORANT connection changed: ${previous.connected ? 'online' : 'offline'} -> ${current.connected ? 'online' : 'offline'}`
  );
  valorantService.resetSessionCache();
  cacheService.clear();
});

runtimeStateService.start();

// Start server
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log('======================================');
  console.log('VALORANT Skin Tracker API');
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('- GET /api/match/current');
  console.log('- GET /api/player/:name/:tag');
  console.log('======================================');
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. Reusing existing backend instance.`);
    process.exit(0);
    return;
  }
  console.error('Server failed to start:', error);
  process.exit(1);
});

module.exports = app;
