// routes/mapRoutes.js
const express = require("express");
const router = express.Router();
const { getOrCreate, refreshFortniteMap } = require("../models/fortniteMap");

router.get("/", async (req, res, next) => {
  try {
    const mapId = "current";
    // keep map image fresh (optional; uses cache)
    await refreshFortniteMap(false);
    const payload = getOrCreate(mapId);
    res.render("index", {
      location: payload, // has x,y,name,id
      currentMap: mapId,
      mapImage: payload.mapImage || "", // EJS already reads this
      __owner: !!req.owner,
      __dev: !!req.dev,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
