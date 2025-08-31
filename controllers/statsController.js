// controllers/statsController.js
const { doFetch } = require("../utils/doFetch");

// allow ALLOW_STATS_MOCK or ALLOW_STAT_MOCK
const RAW_ALLOW =
  process.env.ALLOW_STATS_MOCK ?? process.env.ALLOW_STAT_MOCK ?? "true";
const ALLOW_STATS_MOCK = String(RAW_ALLOW).toLowerCase() === "true";
const FIO_BASE = (
  process.env.FORTNITEAPI_IO_BASE || "https://fortniteapi.io"
).replace(/\/+$/, "");

function num(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/,/g, "").replace(/%/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// Sum helper
function add(a, b) {
  return num(a) + num(b);
}

// Build an aggregate across modes if “all/overall” is missing
function aggregateGlobalStats(gs = {}) {
  // known buckets that often exist
  const buckets = [
    "all",
    "overall",
    "keyboardmouse",
    "gamepad",
    "touch", // sometimes present
    "solo",
    "duo",
    "squad",
    "ltm",
    "trio",
    "pairs",
    "rumble",
  ];

  // Prefer a single “all/overall/*input*” if present
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

  // Else, aggregate whatever buckets exist
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

exports.getStats = async (req, res) => {
  try {
    const name = String(req.query.name || "").trim();
    const platform = String(req.query.platform || "epic").toLowerCase();
    if (!name) return res.status(400).json({ error: "Missing name" });

    const fioKey =
      process.env.FORTNITEAPI_IO_KEY || process.env.FORTNITE_IO_KEY;
    if (!fioKey) {
      if (ALLOW_STATS_MOCK)
        return res.json({
          name,
          platform,
          all: makeMockStats(name),
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
          all: makeMockStats(name),
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
          all: makeMockStats(name),
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
          all: makeMockStats(name),
          note: "mocked (account not found)",
        });
      return res.status(404).json({ error: "Account not found" });
    }

    // 2) stats by account id
    const statsUrl = `${FIO_BASE}/v1/stats?account=${encodeURIComponent(
      accountId
    )}`;
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
          all: makeMockStats(name),
          note: `mocked (stats network error: ${e.code || e.message})`,
        });
      return res.status(502).json({
        error: "Network error contacting fortniteapi.io (stats)",
        code: e.code || null,
        message: e.message || String(e),
      });
    }

    const payload = await statsResp.json();

    // PRIVATE account: Fortnite privacy setting
    const isPrivate =
      payload?.code === "PRIVATE_ACCOUNT" ||
      payload?.error?.code === "PRIVATE_ACCOUNT" ||
      (payload?.result === false && /private/i.test(payload?.message || ""));
    if (isPrivate) {
      if (ALLOW_STATS_MOCK) {
        return res.json({
          name: resolvedName,
          platform,
          all: makeMockStats(name),
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
          all: makeMockStats(name),
          note: `mocked (stats ${statsResp.status})`,
          upstream: msg.slice(0, 300),
        });
      return res
        .status(statsResp.status)
        .json({ error: "Stats fetch failed", details: msg.slice(0, 500) });
    }

    const all = parseFioStats(payload);
    return res.json({ name: resolvedName, platform, all, raw: { accountId } });
  } catch (err) {
    console.error("getStats error:", err);
    res
      .status(500)
      .json({ error: "Internal", message: err?.message || String(err) });
  }
};
