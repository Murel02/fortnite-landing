// utils/doFetch.js
const fetch = global.fetch || require("node-fetch");

async function doFetch(url, options = {}) {
  return fetch(url, options);
}

module.exports = { doFetch };
