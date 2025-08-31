// models/playerStats.js
const { doFetch } = require("../utils/doFetch");

const API_BASE = "https://fortniteapi.io/v1";

/**
 * scope:
 *  - "global"        -> hele historikken
 *  - "season"        -> sæson-tal (kræver season param)
 *
 * season:
 *  - "current"       -> den aktuelle sæson
 *  - "33"            -> eller et specifikt nummer (eksempel)
 */
async function getPlayerStats({
  accountId,
  scope = "season",
  season = "current",
  apiKey = process.env.FORTNITE_API_KEY,
}) {
  if (!apiKey) throw new Error("Missing FORTNITE_API_KEY");
  if (!accountId) throw new Error("Missing accountId");

  const search = new URLSearchParams({ account: accountId });
  if (scope === "season") search.set("season", season);

  const url = `${API_BASE}/stats?${search.toString()}`;
  const data = await doFetch(url, {
    headers: { Authorization: apiKey },
    timeoutMs: 12_000,
  });

  // Normaliser et par felter let (valgfrit)
  return {
    accountId,
    seasonScope: scope === "season" ? season : "global",
    raw: data,
    global_stats: data.global_stats || data.global || {}, // alt efter respons
  };
}

module.exports = { getPlayerStats };
