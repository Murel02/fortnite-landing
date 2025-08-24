// routes/index.js
const express = require("express");
const router = express.Router();
const mapController = require("../controllers/mapController");

// just handle the root page
router.get("/", mapController.showRandomLocation);

module.exports = router;
