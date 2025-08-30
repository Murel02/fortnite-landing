// routes/mapRoutes.js
const express = require("express");
const router = express.Router();
const mapController = require("../controllers/mapController");
router.get("/app", mapController.showMap);
router.post("/share", mapController.handleShare);
module.exports = router;
