// models/fortniteMap.js
const { doFetch } = require("../utils/doFetch");
const { list: listDevPois } = require("./devPoisStore");

// Map image (can be overridden)
const REMOTE_MAP_IMAGE =
  process.env.FORTNITE_MAP_IMAGE ||
  "https://media.fortniteapi.io/images/map.png?showPOI=false";

const LOCAL_FALLBACK_IMAGE = "/images/fortnite-map.png";

// Map nominal size for pixel-space normalization (usually 2048)
const MAP_SIZE = Number(process.env.FORTNITE_MAP_SIZE || 2048);

// Cache: { ts, imageUrl, pois: [{id,name,x,y}] }
let fortniteMapCache = { ts: 0, imageUrl: REMOTE_MAP_IMAGE, pois: [] };
let lastDebug = { status: null, reason: null, countRaw: 0, sampleKeys: [] }; // <-- add

// Small helpers
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const safeArr = (a) => (Array.isArray(a) ? a : []);

function pick(obj, paths) {
  for (const path of paths) {
    const parts = path.split(".");
    let v = obj;
    for (const p of parts) {
      if (v == null) break;
      v = v[p];
    }
    if (v != null) return v;
  }
  return undefined;
}

// --- Name normalization ---
function canonName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’'`]/g, "") // apostrophes
    .replace(/\./g, "") // dots (so "O.X.R." → "oxr")
    .replace(/[^a-z0-9]+/g, " ") // collapse punctuation to spaces
    .trim()
    .replace(/\s+/g, " ");
}

// --- Old API name → New map name (complete table for current season) ---
const NAME_REMAP = new Map([
  ["magic mosses", "Supernova Academy"],
  ["seaport city", "Dystopia City"],
  ["masked meadows", "Deamon's Debris"],
  ["brutal boxcars", "Swarmy Stash"],
  ["crime city", "Ranger's Run"],
  ["lonewolf lair", "The Hive"],
  ["vader samurais solitude", "Shogun's Solitude"],
  // If "Flooded Frogs" maps to a current POI, add it here. Otherwise it will be dropped in strict mode.
  // ["flooded frogs", "Some New Name"],
]);

// --- Current-season POIs (new names only) ---
const NEW_POI_CANON = new Set([
  "resistance base",
  "the hive",
  "swarmy stash",
  "supernova academy",
  "first order base",
  "shiny shafts",
  "outlaw oasis",
  "rangers run",
  "foxy floodgate",
  "dystopia city",
  "oxr hq",
  "shining span",
  "kappa kappa factory",
  "demons debris",
  "outpost enclave",
  "canyon crossing",
  "shoguns solitude",
]);

// Decide if the POI belongs to the current season:
// 1) take incoming name
// 2) normalize
// 3) remap old→new (normalized)
// 4) check against NEW_POI_CANON
function isCurrentSeasonPoi(p) {
  const raw = p.name || p.displayName || p.label || "";
  const c = canonName(raw);
  const remappedPretty = NAME_REMAP.get(c) || raw;
  const cFinal = canonName(remappedPretty);
  return NEW_POI_CANON.has(cFinal);
}

function getRawXY(p) {
  const xr =
    pick(p, ["x", "posX", "position.x", "location.x", "coords.x"]) ??
    (Array.isArray(p.position) ? p.position[0] : undefined) ??
    (Array.isArray(p.xy) ? p.xy[0] : undefined);
  const yr =
    pick(p, ["y", "posY", "position.y", "location.y", "coords.y"]) ??
    (Array.isArray(p.position) ? p.position[1] : undefined) ??
    (Array.isArray(p.xy) ? p.xy[1] : undefined);

  const x = Number(xr),
    y = Number(yr);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

// Optional metadata readers for filtering
function readFlags(p) {
  const active = pick(p, [
    "active",
    "enabled",
    "isActive",
    "is_enabled",
    "state.active",
  ]);
  const isActive =
    active === true || active === 1 || active === "true"
      ? true
      : active == null
      ? null
      : false;
  return { active: isActive };
}
function readChapterSeason(p) {
  const ch = Number(
    p.chapter ?? p?.map?.chapter ?? p?.season?.chapter ?? p.chapterNumber
  );
  const se = Number(
    p.season ?? p?.map?.season ?? p.seasonNumber ?? p?.season?.season
  );
  return {
    chapter: Number.isFinite(ch) ? ch : null,
    season: Number.isFinite(se) ? se : null,
  };
}

async function refreshFortniteMap(force = false) {
  const TEN_MIN = 10 * 60 * 1000;
  const now = Date.now();

  if (
    !force &&
    now - fortniteMapCache.ts < TEN_MIN &&
    fortniteMapCache.imageUrl
  ) {
    return fortniteMapCache;
  }

  // API key (required for POIs)
  const apiKey =
    process.env.FORTNITE_IO_KEY ||
    process.env.FORTNITEAPI_IO_KEY || // alias if you ever used it
    process.env.FORTNITE_API_IO_KEY; // legacy alias

  const lang = process.env.FORTNITE_LANG || "en";
  const basePois =
    process.env.FORTNITE_POIS_ENDPOINT || "https://fortniteapi.io/v2/game/poi";

  const poisUrl = `${basePois}?lang=${encodeURIComponent(lang)}&_=${now}`;

  // Default state (image only)
  let imageUrl = REMOTE_MAP_IMAGE;
  const empty = { ts: now, imageUrl, pois: [] };

  if (!apiKey) {
    console.warn("[map] No API key; using image only, no POIs.");
    fortniteMapCache = empty;
    return fortniteMapCache;
  }

  try {
    const resp = await doFetch(
      poisUrl,
      { headers: { Authorization: apiKey, Accept: "application/json" } },
      8000
    );
    lastDebug = {
      status: resp.status,
      reason: null,
      countRaw: 0,
      sampleKeys: [],
    }; // <-- capture status

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      lastDebug.reason = txt.slice(0, 200); // <-- capture error body
      console.warn(
        "[map] POIs upstream error:",
        resp.status,
        txt.slice(0, 200)
      );
      fortniteMapCache = empty;
      return fortniteMapCache;
    }

    const payload = await resp.json();

    // Accept several possible containers
    let raw = [];
    if (Array.isArray(payload?.data)) raw = payload.data;
    else if (Array.isArray(payload?.pois)) raw = payload.pois;
    else if (Array.isArray(payload?.list)) raw = payload.list;
    else if (Array.isArray(payload)) raw = payload;

    lastDebug.countRaw = Array.isArray(raw) ? raw.length : 0; // <-- how many upstream items
    lastDebug.sampleKeys = raw[0] ? Object.keys(raw[0]).slice(0, 12) : []; // <-- first item keys

    const strict =
      (process.env.FORTNITE_POI_STRICT || "").toLowerCase() === "true";
    if (strict) {
      const before = raw.length;
      const rawStrict = raw.filter(isCurrentSeasonPoi);
      if (!rawStrict.length) {
        console.warn(
          "[map] strict filter removed all POIs; falling back to unfiltered"
        );
        // keep the unfiltered list so the app still works
        // (do nothing; leave `raw` as-is)
      } else {
        console.log(
          `[map] strict filter kept ${rawStrict.length}/${before} POIs`
        );
        raw = rawStrict;
      }
    }

    // --------- (optional) filter to current chapter/season & active ----------
    const forceCh = Number(process.env.FORTNITE_CHAPTER || "");
    const forceSe = Number(process.env.FORTNITE_SEASON || "");

    const enriched = raw.map((p) => {
      const { active } = readFlags(p);
      const { chapter, season } = readChapterSeason(p);
      return { p, active, chapter, season };
    });

    let filtered = enriched.filter(
      ({ active }) => active === null || active === true
    );
    if (
      Number.isFinite(forceCh) &&
      Number.isFinite(forceSe) &&
      forceCh &&
      forceSe
    ) {
      const before = filtered.length;
      filtered = filtered.filter(
        ({ chapter, season }) => chapter === forceCh && season === forceSe
      );
      if (filtered.length === 0) filtered = enriched; // fallback if feed lacks fields
      if (before && filtered.length === 0) {
        console.warn(
          "[map] season filter removed all items; falling back to unfiltered list"
        );
      }
    }
    raw = filtered.map((e) => e.p);
    // ------------------------------------------------------------------------

    // --- Normalize coordinates ---
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    const rawXY = [];
    for (const p of raw) {
      const xy = getRawXY(p);
      if (!xy) continue;
      rawXY.push({ p, ...xy });
      if (xy.x < minX) minX = xy.x;
      if (xy.x > maxX) maxX = xy.x;
      if (xy.y < minY) minY = xy.y;
      if (xy.y > maxY) maxY = xy.y;
    }

    // Decide coord model
    const hasNegative = minX < 0 || minY < 0;
    const rangeGuess = Math.max(
      Math.abs(maxX),
      Math.abs(maxY),
      Math.abs(minX),
      Math.abs(minY)
    );
    const PIX = rangeGuess > 3000 ? 4096 : MAP_SIZE; // auto-detect; default to MAP_SIZE (2048)

    function to01_topLeft(x, y) {
      return { x: x / PIX, y: y / PIX };
    }
    function to01_centered(x, y) {
      const h = PIX / 2;
      return { x: (x + h) / PIX, y: (h - y) / PIX };
    }

    const parsedPois = [];
    for (let i = 0; i < rawXY.length; i++) {
      const { p, x, y } = rawXY[i];

      let nx, ny;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        nx = x;
        ny = y; // already normalized top-left
      } else if (!hasNegative) {
        ({ x: nx, y: ny } = to01_topLeft(x, y));
      } else {
        ({ x: nx, y: ny } = to01_centered(x, y));
      }

      nx = clamp01(nx);
      ny = clamp01(ny);

      // Orientation fix (env: FORTNITE_POI_ROTATE=cw|ccw|none)
      const ROTATE = (process.env.FORTNITE_POI_ROTATE || "none").toLowerCase();
      let x2 = nx,
        y2 = ny;
      if (ROTATE === "cw") {
        // rotate 90° clockwise: (x',y')=(1-y, x)
        const t = x2;
        x2 = 1 - y2;
        y2 = t;
      } else if (ROTATE === "ccw") {
        // 90° counter-clockwise: (x',y')=(y, 1-x)
        const t = x2;
        x2 = y2;
        y2 = 1 - t;
      } // "none" → no change

      const id = p.id || p.slug || p.uid || p.name || `poi-${i}`;
      const originalName = p.name || p.displayName || p.label || id;
      const pretty = NAME_REMAP.get(canonName(originalName)) || originalName;

      parsedPois.push({ id, name: pretty, x: x2, y: y2 });
    }

    fortniteMapCache = { ts: now, imageUrl, pois: parsedPois };

    // --- DEV MERGE / STRICT OVERRIDES ---
    // Hvis strict=true, så vil dev-POIs overskrive (samme id/navn) eller blive tilføjet.
    // Hvis strict=false, kan du styre om dev skal merges via FORTNITE_DEV_MERGE=true
    const allowDevMerge =
      String(process.env.FORTNITE_DEV_MERGE || "true").toLowerCase() === "true";

    let finalPois = parsedPois;
    const strictEnv =
      (process.env.FORTNITE_POI_STRICT || "").toLowerCase() === "true";
    if (strictEnv) {
      finalPois = mergePois(parsedPois, true);
    } else if (allowDevMerge) {
      finalPois = mergePois(parsedPois, false);
    }

    fortniteMapCache = { ts: now, imageUrl, pois: finalPois };
    return fortniteMapCache;
  } catch (err) {
    lastDebug = {
      status: "network_error",
      reason: err?.message || String(err),
      countRaw: 0,
      sampleKeys: [],
    }; // <--
    console.error(
      "[map] refreshFortniteMap network error:",
      err?.code || "",
      err?.message || err
    );
    fortniteMapCache = { ts: now, imageUrl: LOCAL_FALLBACK_IMAGE, pois: [] };
    return fortniteMapCache;
  }
}

function getLastDebug() {
  return lastDebug;
}

// small helpers used by sockets/controllers
function getPoiList() {
  return fortniteMapCache.pois || [];
}

// Valgfrit: nem læser af hele cache-objektet
function getMapCache() {
  return fortniteMapCache;
}

function mergePois(apiPois, strict = false) {
  const devPois = listDevPois();
  if (strict) {
    // Strict: hvis en dev-poi har samme navn/id som api, overskriv – ellers tilføj
    const byKey = new Map(apiPois.map((p) => [p.id || p.name, p]));
    devPois.forEach((d) => byKey.set(d.id || d.name, d));
    return Array.from(byKey.values());
  }
  // Ikke strict: bare concat (eller vis dev markører kun i dev-UI)
  return [...apiPois, ...devPois];
}

function getRandomDynamicLocation() {
  // Brug dev-POIs hvis der findes nogen; ellers API-listen
  const dev = listDevPois();
  const pool = Array.isArray(dev) && dev.length ? dev : getPoiList();

  if (!pool.length) return { id: "Center", name: "Center", x: 0.5, y: 0.5 };
  return pool[Math.floor(Math.random() * pool.length)];
}

const MAP_IDS = ["current"];
const stateByMap = {
  current: {
    mapId: "current",
    location: { id: "Spawn", name: "Spawn", x: 0.5, y: 0.5 },
  },
};

module.exports = {
  fortniteMapCache,
  refreshFortniteMap,
  getPoiList,
  getRandomDynamicLocation,
  MAP_IDS,
  stateByMap,
  getLastDebug,
  getMapCache,
};
