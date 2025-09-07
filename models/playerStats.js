// models/playerStats.js
//
// This module provides a convenience wrapper around the Fortnite API to fetch
// player statistics.  In addition to the original functionality of
// retrieving global or season‑scoped statistics, this implementation adds
// support for filtering the returned statistics by game mode and team size.
//
// The upstream API at https://fortniteapi.io/v1/stats returns a `global_stats`
// object which contains aggregate statistics keyed by mode names.  In
// practice, these keys include combinations such as "solo", "duo", "squad",
// "solo_zero_build", etc.  To allow callers to easily access the subset of
// interest, the helper below inspects these keys and returns the first one
// matching the requested teamType and optional gamemode.  If no matching key
// is found, the helper falls back to a best effort match or returns an empty
// object.

const { doFetch } = require("../utils/doFetch");

const API_BASE = "https://fortniteapi.io/v1";

/**
 * Identify all keys within the statistics object that belong to the requested
 * teamType and optionally match the provided gamemode.  Keys are matched
 * case‑insensitively.  If a gamemode is provided, keys that include both
 * the team and the gamemode are returned.  When no such keys exist, the
 * helper returns keys that contain only the team string.  This helper
 * returns an array of matching keys so callers can aggregate across
 * multiple variations (e.g. `solo_zero_build` and `solo_reload_zero_build`).
 *
 * @param {object} stats - The `global_stats` object from the API response.
 * @param {string} teamType - One of "solo", "duo", "trio", or "squad".
 * @param {string} [gamemode] - Optional gamemode such as "zero_build".
 * @returns {string[]} Array of matching keys (may be empty).
 */
function findStatKeys(stats, teamType, gamemode) {
  if (!stats || typeof stats !== "object") return [];
  const keys = Object.keys(stats);
  const team = String(teamType || "").toLowerCase();
  const mode = gamemode ? gamemode.toLowerCase() : null;
  let matches = keys.filter((k) => k.toLowerCase().includes(team));
  if (mode) {
    const withMode = matches.filter((k) => k.toLowerCase().includes(mode));
    if (withMode.length > 0) {
      matches = withMode;
    }
  }
  return matches;
}

/**
 * Combine multiple stats objects into a single aggregate.  This function
 * understands common property names from fortniteapi.io (`matchesplayed`,
 * `matches_played`, `matches`, `placetop1`, `wins`, `kills`, `placetop10`,
 * `top10`, `score`) and sums them together.  It intentionally ignores
 * unknown properties.  If no objects are provided the result will be an
 * empty object.
 *
 * @param {object[]} list - Array of mode stats to merge.
 * @returns {object} Aggregated stats.
 */
function aggregateModeStats(list) {
  const result = {
    matchesplayed: 0,
    placetop1: 0,
    kills: 0,
    placetop10: 0,
    score: 0,
  };
  for (const stats of list) {
    if (!stats || typeof stats !== "object") continue;
    const mp = stats.matchesplayed ?? stats.matches_played ?? stats.matches;
    result.matchesplayed += Number(mp) || 0;
    result.placetop1 += Number(stats.placetop1 ?? stats.wins) || 0;
    result.kills += Number(stats.kills) || 0;
    result.placetop10 += Number(stats.placetop10 ?? stats.top10) || 0;
    result.score += Number(stats.score) || 0;
  }
  return result;
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

  // Determine which keys contain the requested stats.  Some APIs return
  // statistics keyed by a combination of teamType and gamemode (e.g.
  // `solo_zero_build`), others may only include the teamType (e.g. `duo`).
  let keys = findStatKeys(globalStats, teamType, gamemode);
  if (keys.length === 0 && gamemode) {
    keys = findStatKeys(globalStats, teamType, null);
  }
  let modeStats = {};
  if (keys.length > 0) {
    const list = keys
      .map((k) => globalStats[k])
      .filter((v) => v && typeof v === "object");
    modeStats = aggregateModeStats(list);
  }
  return {
    accountId,
    seasonScope: scope === "season" ? season : "global",
    raw: data,
    global_stats: globalStats,
    selected_keys: keys,
    stats: modeStats,
  };
}

module.exports = { getPlayerStats };