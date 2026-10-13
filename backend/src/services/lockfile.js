const fs = require('fs');
const path = require('path');

/**
 * Lockfile Service
 * Reads VALORANT's lockfile to get local API credentials
 */
class LockfileService {
  constructor() {
    const localAppData = process.env.LOCALAPPDATA
      || `C:\\Users\\${process.env.USERNAME}\\AppData\\Local`;

    // Try multiple known lockfile locations; Riot has shifted paths between updates.
    this.lockfileCandidates = [
      path.join(localAppData, 'Riot Games', 'Riot Client', 'Config', 'lockfile'),
      path.join('C:\\Riot Games', 'VALORANT', 'live', 'lockfile')
    ];
    this.lockfilePath = this.lockfileCandidates[0];
    
    this.credentials = null;
    this.lastMtimeMs = null;
  }

  /**
   * Read and parse the lockfile
   * Format: {name}:{pid}:{port}:{password}:{protocol}
   */
  readLockfile(force = false) {
    try {
      const existing = this.lockfileCandidates
        .filter((candidate) => fs.existsSync(candidate))
        .map((candidate) => ({
          candidate,
          mtimeMs: fs.statSync(candidate).mtimeMs
        }))
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

      if (existing.length === 0) {
        console.log('Lockfile not found at known paths:', this.lockfileCandidates.join(', '));
        this.credentials = null;
        this.lastMtimeMs = null;
        return null;
      }

      this.lockfilePath = existing[0].candidate;

      const stat = fs.statSync(this.lockfilePath);
      if (!force && this.credentials && this.lastMtimeMs === stat.mtimeMs) {
        return this.credentials;
      }

      const lockfileContent = fs.readFileSync(this.lockfilePath, 'utf8');
      const parts = lockfileContent.split(':');

      if (parts.length !== 5) {
        console.error('Invalid lockfile format');
        return null;
      }

      this.credentials = {
        name: parts[0],
        pid: parts[1],
        port: parts[2],
        password: parts[3],
        protocol: parts[4].trim()
      };
      this.lastMtimeMs = stat.mtimeMs;

      console.log(`✓ Lockfile read successfully (Port: ${this.credentials.port})`);
      return this.credentials;
    } catch (error) {
      console.error('Error reading lockfile:', error.message);
      this.credentials = null;
      this.lastMtimeMs = null;
      return null;
    }
  }

  /**
   * Get authorization header for local VALORANT API
   */
  getAuthHeader() {
    if (!this.credentials) {
      this.readLockfile();
    } else {
      this.readLockfile();
    }

    if (!this.credentials) {
      return null;
    }

    const authString = `riot:${this.credentials.password}`;
    const base64Auth = Buffer.from(authString).toString('base64');
    
    return {
      'Authorization': `Basic ${base64Auth}`
    };
  }

  /**
   * Get the local API base URL
   */
  getBaseUrl() {
    if (!this.credentials) {
      this.readLockfile();
    } else {
      this.readLockfile();
    }

    if (!this.credentials) {
      return null;
    }

    return `https://127.0.0.1:${this.credentials.port}`;
  }

  /**
   * Identify the current local-client session without exposing its credentials.
   * Consumers can use this value only for equality checks so cached tokens from
   * a previous Riot Client process are never reused after a restart.
   */
  getSessionId() {
    const credentials = this.readLockfile();
    if (!credentials) return null;

    return [
      this.lockfilePath,
      credentials.pid,
      credentials.port,
      credentials.password,
      credentials.protocol
    ].join('|');
  }

  /**
   * Check if VALORANT is running by checking if lockfile exists
   */
  isValorantRunning() {
    return this.lockfileCandidates.some((candidate) => fs.existsSync(candidate));
  }

  /**
   * Force refresh lockfile credentials
   */
  refreshCredentials() {
    return this.readLockfile(true);
  }
}

module.exports = new LockfileService();
