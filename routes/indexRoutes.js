// routes/index.js
const express = require("express");
const router = express.Router();
// Redirect root to /app (preserve query string if present)
router.get("/", (req, res) => {
  const query = req.url.split("?")[1];
  res.redirect("/app" + (query ? `?${query}` : ""));
});
module.exports = router;
