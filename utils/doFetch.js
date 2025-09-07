// utils/doFetch.js
//
// This utility replicates the original implementation found in the upstream
// repository.  It exposes a simple fetch wrapper that supports an optional
// timeout on requests.  If a `signal` property is provided on the options
// object the native fetch implementation is used directly, otherwise an
// AbortController is created and used to cancel the request after the
// specified timeout.  The default timeout is 3000ms.

const fetch = global.fetch || require("node-fetch");

/**
 * Perform an HTTP request with an optional timeout.
 *
 * @param {string|Request} url - The URL or Request object to fetch.
 * @param {object} [options={}] - Options passed directly to fetch().
 * @param {number} [timeoutMs=3000] - Abort the request after this many milliseconds.
 * @returns {Promise<Response>} The fetch promise.
 */
async function doFetch(url, options = {}, timeoutMs = 3000) {
  // If the caller provided an AbortSignal then respect it and don't create our
  // own abort logic.  This mirrors the behaviour of the original helper.
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
