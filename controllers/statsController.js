// controllers/statsController.js
//
// This is a local copy of the upstream statsController with modifications
// to support filtering Fortnite statistics by team type and gamemode.  The
// controller exposes a single handler `getStats` which is registered
// under the `/api/stats` route.  It performs the following steps:
//   1. Look up the player’s account ID using their display name.
//   2. Fetch season or lifetime statistics from the fortniteapi.io endpoint.
//   3. Parse the response to compute aggregated stats and extract a subset
//      of stats for a specific team/gamemode combination.
//   4. Return a JSON response containing both aggregate and mode‑specific
//      statistics, along with the resolved player name and metadata.

const { doFetch } = require("../utils/doFetch");

// allow ALLOW_STATS_MOCK or ALLOW_STAT_MOCK
const RAW_ALLOW =
  process.env.ALLOW_STATS_MOCK ?? process.env.ALLOW_STAT_MOCK ?? "true";
const ALLOW_STATS_MOCK = String(RAW_ALLOW).toLowerCase() === "true";
const FIO_BASE = (
  process.env.FORTNITEAPI_IO_BASE || "https://fortniteapi.io"
).replace(/\/+$|$/g, "");

function num(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/,/g, "").replace(/%/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function add(a, b) {
  return num(a) + num(b);
}

// Build an aggregate across modes if “all/overall” is missing
function aggregateGlobalStats(gs = {}) {
  const buckets = [
    "all",
    "overall",
    "keyboardmouse",
    "gamepad",
    "touch",
    "solo",
    "duo",
    "squad",
    "ltm",
    "trio",
    "pairs",
    "rumble",
  ];
  for (const key of [
    "all",
    "overall",
    "keyboardmouse",
    "gamepad",
    "touch",
    "any",
  ]) {
    if (gs[key]) return { ...gs[key] };
  }
  const acc = {
    matchesplayed: 0,
    placetop1: 0,
    kills: 0,
    placetop10: 0,
    score: 0,
  };
  for (const key of Object.keys(gs)) {
    if (!buckets.includes(key) && typeof gs[key] !== "object") continue;
    const m = gs[key] || {};
    acc.matchesplayed = add(
      acc.matchesplayed,
      m.matchesplayed ?? m.matches_played ?? m.matches
    );
    acc.placetop1 = add(acc.placetop1, m.placetop1 ?? m.wins);
    acc.kills = add(acc.kills, m.kills);
    acc.placetop10 = add(acc.placetop10, m.placetop10 ?? m.top10);
    acc.score = add(acc.score, m.score);
  }
  return acc;
}

function parseFioStats(payload) {
  const gs = payload?.global_stats || payload?.global || payload?.stats || {};
  const all = aggregateGlobalStats(gs);
  const matches = num(all.matchesplayed ?? all.matches_played ?? all.matches);
  const wins = num(all.placetop1 ?? all.wins);
  const kills = num(all.kills);
  const top10 = num(all.placetop10 ?? all.top10);
  const score = num(all.score);
  let kd = num(all.kd ?? all["k/d"] ?? all.kdr ?? all.killdeath);
  if (!kd && matches > wins) kd = kills / Math.max(1, matches - wins);
  let winRate = num(all.winrate ?? all.win_rate ?? all["win%"]);
  if (!winRate && matches) winRate = (wins * 100) / matches;
  return {
    matches,
    wins,
    kills,
    kd: Number.isFinite(kd) ? +kd.toFixed(2) : 0,
    winRate: Number.isFinite(winRate) ? +winRate.toFixed(2) : 0,
    top10,
    score,
  };
}

// deterministic mock (unchanged)
function makeMockStats(name) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const rng = (min, max) => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h >>>= 0;
    h ^= h << 5;
    h >>>= 0;
    const r = (h >>> 0) / 0xffffffff;
    return Math.floor(min + r * (max - min + 1));
  };
  const matches = rng(50, 1500);
  const wins = Math.min(
    matches,
    rng(0, Math.max(1, Math.floor(matches * 0.2)))
  );
  const kills = rng(Math.max(5, wins), matches * 4);
  const deaths = Math.max(1, matches - wins);
  const kd = kills / deaths;
  const top10 = rng(0, Math.max(wins, Math.floor(matches * 0.3)));
  const score = rng(matches * 30, matches * 150);
  return {
    matches,
    wins,
    kills,
    kd: +kd.toFixed(2),
    winRate: matches ? +((wins * 100) / matches).toFixed(2) : 0,
    top10,
    score,
  };
}

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
  const team = String(teamType || "").toLowerCase();
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

exports.getStats = async (req, res) => {
  try {
    const name = String(req.query.name || "").trim();
    const platform = String(req.query.platform || "epic").toLowerCase();
    // NEW: scope + season (defaults for season stats)
    const scope = String(req.query.scope || "season").toLowerCase();
    const season = String(req.query.season || "current").toLowerCase();
    // NEW: teamType and gamemode with sensible defaults
    const teamType = String(req.query.teamType || "solo").toLowerCase();
    const gamemode = String(req.query.gamemode || "zero_build").toLowerCase();
    if (!name) return res.status(400).json({ error: "Missing name" });
    const fioKey =
      process.env.FORTNITEAPI_IO_KEY || process.env.FORTNITE_IO_KEY;
    if (!fioKey) {
      if (ALLOW_STATS_MOCK)
        return res.json({
          name,
          platform,
          scope,
          season,
          teamType,
          gamemode,
          all: makeMockStats(name),
          modeStats: makeMockStats(name),
          note: "mocked (no FORTNITEAPI_IO_KEY)",
        });
      return res
        .status(502)
        .json({ error: "No FORTNITEAPI_IO_KEY configured" });
    }
    // 1) lookup account id
    const qp = new URLSearchParams({ username: name });
    if (platform === "xbl" || platform === "xbox") qp.set("platform", "xbl");
    else if (
      platform === "psn" ||
      platform === "ps" ||
      platform === "playstation"
    )
      qp.set("platform", "psn");
    const lookupUrl = `${FIO_BASE}/v1/lookup?${qp.toString()}`;
    let lookupResp;
    try {
      lookupResp = await doFetch(
        lookupUrl,
        { headers: { Authorization: fioKey, Accept: "application/json" } },
        5000
      );
    } catch (e) {
      if (ALLOW_STATS_MOCK)
        return res.json({
          name,
          platform,
          scope,
          season,
          teamType,
          gamemode,
          all: makeMockStats(name),
          modeStats: makeMockStats(name),
          note: `mocked (lookup network error: ${e.code || e.message})`,
        });
      return res.status(502).json({
        error: "Network error contacting fortniteapi.io (lookup)",
        code: e.code || null,
        message: e.message || String(e),
      });
    }
    if (!lookupResp.ok) {
      const msg = await lookupResp.text().catch(() => "");
      if (ALLOW_STATS_MOCK)
        return res.json({
          name,
          platform,
          scope,
          season,
          teamType,
          gamemode,
          all: makeMockStats(name),
          modeStats: makeMockStats(name),
          note: `mocked (lookup ${lookupResp.status})`,
          upstream: msg.slice(0, 300),
        });
      return res
        .status(lookupResp.status)
        .json({ error: "Lookup failed", details: msg.slice(0, 500) });
    }
    const lookup = await lookupResp.json();
    const accountId =
      lookup?.account_id ||
      lookup?.accountId ||
      lookup?.data?.account_id ||
      lookup?.data?.accountId;
    const resolvedName =
      lookup?.displayName || lookup?.name || lookup?.data?.name || name;
    if (!accountId) {
      if (ALLOW_STATS_MOCK)
        return res.json({
          name,
          platform,
          scope,
          season,
          teamType,
          gamemode,
          all: makeMockStats(name),
          modeStats: makeMockStats(name),
          note: "mocked (account not found)",
        });
      return res.status(404).json({ error: "Account not found" });
    }
    // 2) stats by account id (SEASON by default)
    const statsQ = new URLSearchParams({ account: accountId });
    if (scope === "season") statsQ.set("season", season);
    const statsUrl = `${FIO_BASE}/v1/stats?${statsQ.toString()}`;
    let statsResp;
    try {
      statsResp = await doFetch(
        statsUrl,
        { headers: { Authorization: fioKey, Accept: "application/json" } },
        6000
      );
    } catch (e) {
      if (ALLOW_STATS_MOCK)
        return res.json({
          name: resolvedName,
          platform,
          scope,
          season,
          teamType,
          gamemode,
          all: makeMockStats(name),
          modeStats: makeMockStats(name),
          note: `mocked (stats network error: ${e.code || e.message})`,
        });
      return res.status(502).json({
        error: "Network error contacting fortniteapi.io (stats)",
        code: e.code || null,
        message: e.message || String(e),
      });
    }
    const payload = await statsResp.json();
    const isPrivate =
      payload?.code === "PRIVATE_ACCOUNT" ||
      payload?.error?.code === "PRIVATE_ACCOUNT" ||
      (payload?.result === false && /private/i.test(payload?.message || ""));
    if (isPrivate) {
      if (ALLOW_STATS_MOCK) {
        return res.json({
          name: resolvedName,
          platform,
          scope,
          season,
          teamType,
          gamemode,
          all: makeMockStats(name),
          modeStats: makeMockStats(name),
          note: "mocked (private account)",
          raw: { accountId },
        });
      }
      return res.status(403).json({
        error: "Private account",
        message: payload?.message || "This account is private",
        raw: { accountId },
      });
    }
    if (!statsResp.ok) {
      const msg =
        typeof payload === "string" ? payload : JSON.stringify(payload);
      if (ALLOW_STATS_MOCK)
        return res.json({
          name: resolvedName,
          platform,
          scope,
          season,
          teamType,
          gamemode,
          all: makeMockStats(name),
          modeStats: makeMockStats(name),
          note: `mocked (stats ${statsResp.status})`,
          upstream: msg.slice(0, 300),
        });
      return res
        .status(statsResp.status)
        .json({ error: "Stats fetch failed", details: msg.slice(0, 500) });
    }
    // Parse aggregate stats
    const all = parseFioStats(payload);
    // Extract mode‑specific stats
    const gs = payload?.global_stats || payload?.global || payload?.stats || {};
    const key = findStatsKey(gs, teamType, gamemode);
    let modeStats = key && gs[key] ? gs[key] : {};
    /*
     * The upstream Fortnite API does not always provide separate buckets for
     * every gamemode/team combination.  In particular, there is often only
     * one set of stats per team (e.g. "solo", "duo", "squad"), and no
     * specific key for modes like Zero Build.  When the lookup above
     * returns an empty object (no matches, wins or kills), fall back to
     * a second pass that ignores the gamemode entirely.  If that still
     * yields no usable data, use the aggregate of all modes so that the
     * client sees some meaningful numbers instead of zeros.
     */
    const hasData = modeStats && Object.keys(modeStats).some((k) => {
      const keyLower = k.toLowerCase();
      return [
        "matchesplayed",
        "matches_played",
        "matches",
        "placetop1",
        "wins",
        "kills",
      ].includes(keyLower);
    });
    if (!hasData) {
      // First try again without the gamemode filter
      const fallbackKey = findStatsKey(gs, teamType, null);
      if (fallbackKey && gs[fallbackKey]) {
        modeStats = gs[fallbackKey];
      } else {
        // As a last resort use an aggregate of all modes
        modeStats = aggregateGlobalStats(gs);
      }
    }
    return res.json({
      name: resolvedName,
      platform,
      scope,
      season: scope === "season" ? season : "global",
      teamType,
      gamemode,
      all,
      modeStats,
      raw: { accountId },
    });
  } catch (err) {
    console.error("getStats error:", err);
    res
      .status(500)
      .json({ error: "Internal", message: err?.message || String(err) });
  }
};