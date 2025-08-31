// models/locations.js
// OPTIONAL: kept only as a last-resort fallback (rarely used now)
function getRandomLocation(_mapId = "current") {
  // One neutral fallback if POIs unavailable
  return { id: "Center", name: "Center", x: 0.5, y: 0.5 };
}

module.exports = { getRandomLocation };
