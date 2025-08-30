// routes/index.js
const express = require("express");
const router = express.Router();

// Redirect root to the live map app
router.get("/", (req, res) => {
  const q = req.url.split("?")[1];
  res.redirect("/app" + (q ? `?${q}` : ""));
});

module.exports = router;
