// controllers/mapController.js
const { getRandomLocation } = require("../models/locations");

exports.showRandomLocation = (req, res) => {
  const currentMap = req.query.mapId || "current";
  const location = getRandomLocation(currentMap);
  res.render("index", { location, currentMap });
};
