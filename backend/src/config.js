const firstDefined = (env, names) => names.map((name) => env[name]).find(Boolean) || '';

const getHenrikApiKey = (env = process.env) =>
  firstDefined(env, ['HENRIK_API_KEY', 'HENRIKAPIKEY', 'henrikapikey']);


module.exports = { getHenrikApiKey };
