// controllers/mapController.js
const fortniteMap = require("../models/fortniteMap");

// --- Small helpers ---
function safeArray(a, fallback = []) {
  return Array.isArray(a) ? a : fallback;
}
function safeObj(o, fallback = {}) {
  return o && typeof o === "object" ? o : fallback;
}

// --- Accept query overrides (lang/chapter/season/rotate/endpoint) ---
function applyQueryOverrides(req) {
  let changed = false;
  const set = (k, v) => {
    if (v != null && process.env[k] !== String(v)) {
      process.env[k] = String(v);
      changed = true;
    }
  };
  const q = req.query || {};
  if (q.strict !== undefined) {
    // /api/pois?strict=true | false
    const v = String(q.strict).toLowerCase();
    process.env.FORTNITE_POI_STRICT = v === "true" ? "true" : "false";
    changed = true;
  }

  if (q.lang) set("FORTNITE_LANG", q.lang);
  if (q.chapter) set("FORTNITE_CHAPTER", q.chapter);
  if (q.season) set("FORTNITE_SEASON", q.season);
  if (q.rotate) set("FORTNITE_POI_ROTATE", String(q.rotate).toLowerCase()); // cw|ccw|none
  if (q.endpoint) set("FORTNITE_POIS_ENDPOINT", q.endpoint);
  return changed;
}

/**
 * GET /app
 * Render the page. If overrides are present, force+await a refresh so it applies immediately.
 */
exports.showMap = async (req, res) => {
  try {
    const fm = safeObj(fortniteMap);
    const mapId = String(
      (req.query && req.query.mapId) || "current"
    ).toLowerCase();

    const MAP_IDS = safeArray(fm.MAP_IDS, ["current"]);
    const validMap = MAP_IDS.indexOf(mapId) !== -1 ? mapId : "current";

    const overridesChanged = applyQueryOverrides(req);

    if (validMap === "current" && typeof fm.refreshFortniteMap === "function") {
      if (overridesChanged) {
        await fm.refreshFortniteMap(true); // apply new env immediately
      } else {
        fm.refreshFortniteMap().catch((e) =>
          console.error("[showMap] bg refresh error:", e?.message || e)
        );
      }
    }

    const getLoc =
      typeof fm.getRandomDynamicLocation === "function"
        ? fm.getRandomDynamicLocation
        : () => ({ id: "Center", name: "Center", x: 0.5, y: 0.5 });

    const location = getLoc();

    // Fallback image if cache not ready
    const cache = safeObj(fm.fortniteMapCache);
    const defaultImage =
      process.env.FORTNITE_MAP_IMAGE ||
      "https://media.fortniteapi.io/images/map.png?showPOI=false";

    const mapImage =
      validMap === "current"
        ? cache.imageUrl || defaultImage
        : "/images/fortniteOG.png";

    res.render("index", { location, currentMap: validMap, mapImage });
  } catch (err) {
    console.error("showMap error:", err);
    res.status(500).send("Internal Server Error");
  }
};

/** POST /share */
exports.handleShare = (req, res) => {
  const title = (req.body && req.body.title) || "";
  const text = (req.body && req.body.text) || "";
  const url = (req.body && req.body.url) || "";
  const seed = (text || title || url || "").trim();
  const qs = seed ? `?seed=${encodeURIComponent(seed)}` : "";
  res.redirect("/app" + qs);
};

/** GET /api/current */
exports.getCurrentState = async (req, res) => {
  try {
    const fm = safeObj(fortniteMap);
    const mapId = String(
      (req.query && req.query.mapId) || "current"
    ).toLowerCase();

    const MAP_IDS = safeArray(fm.MAP_IDS, ["current"]);
    const validMap = MAP_IDS.indexOf(mapId) !== -1 ? mapId : "current";

    const overridesChanged = applyQueryOverrides(req);

    if (validMap === "current" && typeof fm.refreshFortniteMap === "function") {
      if (overridesChanged) {
        await fm.refreshFortniteMap(true);
      } else {
        fm.refreshFortniteMap().catch((e) =>
          console.error("[getCurrentState] bg refresh error:", e?.message || e)
        );
      }
    }

    const stateByMap = safeObj(fm.stateByMap, {
      current: {
        mapId: "current",
        location: { id: "Spawn", name: "Spawn", x: 0.5, y: 0.5 },
      },
    });
    const state = safeObj(stateByMap[validMap], stateByMap.current);

    const cache = safeObj(fm.fortniteMapCache);
    res.json({
      ...state,
      mapImage:
        validMap === "current"
          ? cache.imageUrl || process.env.FORTNITE_MAP_IMAGE || ""
          : undefined,
    });
  } catch (err) {
    console.error("getCurrentState error:", err);
    res
      .status(500)
      .json({ error: "Internal", message: err?.message || String(err) });
  }
};

/** GET /api/fortnite/map */
exports.getFortniteMapData = async (req, res) => {
  try {
    const fm = safeObj(fortniteMap);
    applyQueryOverrides(req);
    if (typeof fm.refreshFortniteMap === "function") {
      await fm.refreshFortniteMap(true);
    }
    const cache = safeObj(fm.fortniteMapCache, {
      imageUrl: "",
      pois: [],
      ts: Date.now(),
    });
    res.json({
      imageUrl: cache.imageUrl || process.env.FORTNITE_MAP_IMAGE || "",
      pois: cache.pois,
      ts: cache.ts,
    });
  } catch (err) {
    console.error("getFortniteMapData error:", err);
    res
      .status(500)
      .json({ error: "Internal", message: err?.message || String(err) });
  }
};

/**
 * GET /api/pois
 * Forces a fresh fetch and returns normalized/oriented POIs.
 * Supports ?lang=, ?chapter=, ?season=, ?rotate=, ?endpoint=
 */
exports.getPois = async (req, res) => {
  try {
    const fm = safeObj(fortniteMap);
    applyQueryOverrides(req);
    if (typeof fm.refreshFortniteMap === "function") {
      await fm.refreshFortniteMap(true);
    }
    const cache = safeObj(fm.fortniteMapCache, { imageUrl: "", pois: [] });
    const debug =
      typeof fm.getLastDebug === "function" ? fm.getLastDebug() : null;
    res.json({
      imageUrl: cache.imageUrl || process.env.FORTNITE_MAP_IMAGE || "",
      count: safeArray(cache.pois).length,
      pois: safeArray(cache.pois),
      debug,
      options: {
        lang: process.env.FORTNITE_LANG || null,
        chapter: process.env.FORTNITE_CHAPTER || null,
        season: process.env.FORTNITE_SEASON || null,
        rotate: process.env.FORTNITE_POI_ROTATE || null,
        endpoint: process.env.FORTNITE_POIS_ENDPOINT || null,
      },
    });
  } catch (err) {
    console.error("getPois error:", err);
    res
      .status(500)
      .json({ error: "Internal", message: err?.message || String(err) });
  }
};
