const express = require("express");
const router = express.Router();
const mapController = require("../controllers/mapController");
const statsController = require("../controllers/statsController");

router.get("/current", mapController.getCurrentState);
router.get("/fortnite/map", mapController.getFortniteMapData);
router.get("/stats", statsController.getStats);
router.get("/pois", mapController.getPois);

module.exports = router;
