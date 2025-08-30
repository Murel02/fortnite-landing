// models/fortniteMap.js
const { doFetch } = require("../utils/doFetch");
const { getRandomLocation } = require("./locations");

// You can change this to any local file you have in /public/images
const DEFAULT_LOCAL_IMAGE = "/images/fortnite-map.png";

let fortniteMapCache = { ts: 0, imageUrl: DEFAULT_LOCAL_IMAGE, pois: [] };

async function refreshFortniteMap(force = false) {
  const TEN_MIN = 10 * 60 * 1000;

  // If we have a fresh cache and not forced, reuse it
  if (
    !force &&
    Date.now() - fortniteMapCache.ts < TEN_MIN &&
    fortniteMapCache.imageUrl
  ) {
    return fortniteMapCache;
  }

  // If you have a static override for the image, prefer it
  const staticImage = process.env.FORTNITE_MAP_IMAGE || DEFAULT_LOCAL_IMAGE;

  const apiKey =
    process.env.FORTNITEAPI_IO_KEY ||
    process.env.FORTNITE_IO_KEY || // <— new alias
    process.env.FORTNITE_API_IO_KEY;

  // No API key: just set image to static and clear POIs (safe fallback)
  if (!apiKey) {
    fortniteMapCache = {
      ts: Date.now(),
      imageUrl: staticImage,
      pois: [],
    };
    return fortniteMapCache;
  }

  // Try to fetch POIs; if it fails, gracefully fall back
  try {
    const basePois =
      process.env.FORTNITE_POIS_ENDPOINT ||
      "https://fortniteapi.io/v2/game/poi";
    const lang = process.env.FORTNITE_LANG || "en";
    const poisUrl = `${basePois}?lang=${encodeURIComponent(lang)}`;

    const resp = await doFetch(poisUrl, {
      headers: { Authorization: apiKey, Accept: "application/json" },
    });

    if (!resp.ok) {
      // Upstream unhappy – keep going with a fallback
      console.warn("POIs upstream error:", resp.status, await resp.text());
      fortniteMapCache = {
        ts: Date.now(),
        imageUrl: staticImage,
        pois: [],
      };
      return fortniteMapCache;
    }

    const payload = await resp.json();

    fortniteMapCache = {
      ts: Date.now(),
      imageUrl:
        // You may point this to the CDN if reachable; we stick to static to avoid DNS errors
        staticImage,
      pois: (payload?.data || [])
        .filter((p) => p.x != null && p.y != null)
        .map((p) => ({ id: p.name || "POI", x: p.x, y: p.y })),
    };
    return fortniteMapCache;
  } catch (err) {
    // Network/DNS error – DO NOT throw; keep app working
    console.error("refreshFortniteMap network error:", err?.message || err);
    fortniteMapCache = {
      ts: Date.now(),
      imageUrl: staticImage,
      pois: [],
    };
    return fortniteMapCache;
  }
}

function getRandomDynamicLocation() {
  const list = fortniteMapCache.pois;
  return list && list.length
    ? list[Math.floor(Math.random() * list.length)]
    : getRandomLocation("current"); // fallback to your static list
}

const MAP_IDS = ["current", "og"];
const stateByMap = {
  current: { mapId: "current", location: { id: "Spawn", x: 0.5, y: 0.5 } },
  og: { mapId: "og", location: getRandomLocation("og") },
};

module.exports = {
  fortniteMapCache,
  refreshFortniteMap,
  getRandomDynamicLocation,
  MAP_IDS,
  stateByMap,
};
