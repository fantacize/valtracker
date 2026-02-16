const fs = require('fs');
const path = require('path');

/**
 * Lockfile Service
 * Reads VALORANT's lockfile to get local API credentials
 */
class LockfileService {
  constructor() {
    // Default lockfile path (Windows)
    this.lockfilePath = path.join(
      process.env.LOCALAPPDATA || 'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local',
      'Riot Games',
      'Riot Client',
      'Config',
      'lockfile'
    );
    
    this.credentials = null;
    this.lastMtimeMs = null;
  }

  /**
   * Read and parse the lockfile
   * Format: {name}:{pid}:{port}:{password}:{protocol}
   */
  readLockfile(force = false) {
    try {
      if (!fs.existsSync(this.lockfilePath)) {
        console.log('Lockfile not found at:', this.lockfilePath);
        this.credentials = null;
        this.lastMtimeMs = null;
        return null;
      }

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
   * Check if VALORANT is running by checking if lockfile exists
   */
  isValorantRunning() {
    return fs.existsSync(this.lockfilePath);
  }

  /**
   * Force refresh lockfile credentials
   */
  refreshCredentials() {
    return this.readLockfile(true);
  }
}

module.exports = new LockfileService();
