const { doFetch } = require("../utils/doFetch");

const API_BASE = "https://fortniteapi.io/v1";

/**
 * Find the best matching key within the statistics object for the desired
 * teamType and gamemode.  Keys are matched case‑insensitively and may
 * include both the team (solo, duo, trio, squad) and the gamemode (e.g.
 * "zero_build", "br", "stw").  When a gamemode is provided the helper
 * first attempts to find a key that contains both the team and the gamemode.
 * If none exist it will fall back to a key that contains only the team.
 *
 * @param {object} stats - The `global_stats` object from the API response.
 * @param {string} teamType - One of "solo", "duo", "trio", or "squad".
 * @param {string} [gamemode] - The desired gamemode (e.g. "zero_build", "br").
 * @returns {string|null} The matching key or null if none are found.
 */
function findStatsKey(stats, teamType, gamemode) {
  if (!stats || typeof stats !== "object") return null;
  const keys = Object.keys(stats);
  const team = teamType.toLowerCase();
  const mode = gamemode ? gamemode.toLowerCase() : null;
  // Filter keys that include the team string (solo, duo, etc.)
  let matches = keys.filter((k) => k.toLowerCase().includes(team));
  if (mode) {
    // Further filter keys that include the gamemode (e.g. zero_build)
    const withMode = matches.filter((k) => k.toLowerCase().includes(mode));
    if (withMode.length > 0) {
      matches = withMode;
    }
  }
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Fetch player statistics from the Fortnite API and optionally filter
 * the result by season, team size and gamemode.  By default the
 * function requests season‑scoped statistics for the current season and
 * returns the zero build solo stats.  If a different combination is
 * desired callers may specify `teamType` and `gamemode`.  Unknown
 * parameters are ignored gracefully.
 *
 * @param {object} options
 * @param {string} options.accountId - The Epic account ID for the player.
 * @param {('global'|'season')} [options.scope='season'] - Whether to fetch
 *   lifetime or season‑specific statistics.
 * @param {string} [options.season='current'] - A specific season number or
 *   "current" for the current season.
 * @param {string} [options.teamType='solo'] - Team size: "solo", "duo",
 *   "trio", or "squad".
 * @param {string} [options.gamemode='zero_build'] - Gamemode: e.g. "zero_build",
 *   "br", "stw".  The API may expose keys such as `solo_zero_build` or
 *   `duo` without a gamemode; the helper will attempt to find a matching key.
 * @param {string} [options.apiKey=process.env.FORTNITE_API_KEY] - Your API key.
 * @returns {Promise<object>} An object containing the raw API response,
 *   normalized global statistics, and the filtered stats for the requested
 *   team/gamemode combination.
 */
async function getPlayerStats({
  accountId,
  scope = "season",
  season = "current",
  teamType = "solo",
  gamemode = "zero_build",
  apiKey = process.env.FORTNITE_API_KEY,
} = {}) {
  if (!apiKey) throw new Error("Missing FORTNITE_API_KEY");
  if (!accountId) throw new Error("Missing accountId");

  const search = new URLSearchParams({ account: accountId });
  // Only pass the season parameter when requesting season scoped stats.
  if (scope === "season") search.set("season", season);

  const url = `${API_BASE}/stats?${search.toString()}`;
  const res = await doFetch(url, {
    headers: { Authorization: apiKey },
    timeoutMs: 12_000,
  });
  // The API returns a JSON response; parse it if the fetch implementation
  // returned a Response object.
  const data = typeof res.json === "function" ? await res.json() : res;

  // Normalise the stats property.  The API sometimes returns `global_stats` or
  // `global` depending on the endpoint version.  Fallback to an empty object.
  const globalStats = data.global_stats || data.global || {};

  // Determine which key contains the requested stats.  Some APIs return
  // statistics keyed by a combination of teamType and gamemode (e.g.
  // `solo_zero_build`), others may only include the teamType (e.g. `duo`).
  const key = findStatsKey(globalStats, teamType, gamemode);
  const modeStats = key && globalStats[key] ? globalStats[key] : {};

  return {
    accountId,
    seasonScope: scope === "season" ? season : "global",
    raw: data,
    global_stats: globalStats,
    selected_key: key,
    stats: modeStats,
  };
}

module.exports = { getPlayerStats };
