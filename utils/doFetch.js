// utils/doFetch.js
const fetch = global.fetch || require("node-fetch");

/** doFetch with timeout (default 3000ms) */
async function doFetch(url, options = {}, timeoutMs = 3000) {
  if (options.signal) return fetch(url, options);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

module.exports = { doFetch };
