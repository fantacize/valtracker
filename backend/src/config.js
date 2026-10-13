const firstDefined = (env, names) => names.map((name) => env[name]).find(Boolean) || '';

const getHenrikApiKey = (env = process.env) =>
  firstDefined(env, ['HENRIK_API_KEY', 'HENRIKAPIKEY', 'henrikapikey']);

const getTrackerApiKey = (env = process.env) =>
  firstDefined(env, ['TRACKER_API_KEY', 'TRACKERAPIKEY', 'trackerapikey']);

module.exports = { getHenrikApiKey, getTrackerApiKey };
