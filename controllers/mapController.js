// controllers/mapController.js
const {
  refreshFortniteMap,
  getRandomDynamicLocation,
  fortniteMapCache,
} = require("../models/fortniteMap");
const { getRandomLocation } = require("../models/locations");

exports.showMap = async (req, res) => {
  const mapId = req.query.mapId || "current";
  // Pick a random location for the requested map
  let location;
  if (mapId === "current") {
    try {
      await refreshFortniteMap();
    } catch (e) {
      console.error(e);
    }
    location = getRandomDynamicLocation();
  } else {
    location = getRandomLocation(mapId);
  }
  // Determine which map image to use
  let mapImage;
  if (mapId === "current") mapImage = fortniteMapCache.imageUrl;
  else if (mapId === "og") mapImage = "/images/fortniteOG.png";
  res.render("index", { location, currentMap: mapId, mapImage });
};

exports.getFortniteMapData = async (req, res) => {
  try {
    await refreshFortniteMap();
    res.json({
      imageUrl: fortniteMapCache.imageUrl,
      pois: fortniteMapCache.pois,
      ts: fortniteMapCache.ts,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Internal", message: err.message || String(err) });
  }
};

exports.handleShare = (req, res) => {
  // Common web share target fields
  const title = (req.body && req.body.title) || "";
  const text = (req.body && req.body.text) || "";
  const url = (req.body && req.body.url) || "";

  const seed = (text || title || url || "").trim();
  const qs = seed ? `?seed=${encodeURIComponent(seed)}` : "";
  res.redirect("/app" + qs);
};

exports.getCurrentState = async (req, res) => {
  const mapId = req.query.mapId || "current";
  if (mapId === "current") {
    try {
      await refreshFortniteMap();
    } catch (e) {
      console.error(e);
    }
  }
  const state = stateByMap[mapId] || stateByMap.current;
  res.json({
    ...state,
    mapImage: mapId === "current" ? fortniteMapCache.imageUrl : undefined,
  });
};
