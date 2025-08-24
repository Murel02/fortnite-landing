// models/locations.js

// List of named locations on the Fortnite map.
// x and y are relative coordinates (0–1) based on the 10×10 grid.
const locations = [
  { id: "Tennis banen", x: 0.78, y: 0.66 },
  { id: "Tank stationen", x: 0.25, y: 0.33 },
  { id: "Murel's favorit", x: 0.64, y: 0.17 },
  { id: "Resistance Base", x: 0.24, y: 0.22 },
  { id: "Supernova Academy", x: 0.54, y: 0.26 },
  { id: "First Order Base", x: 0.8, y: 0.18 },
  { id: "The Hive", x: 0.37, y: 0.33 },
  { id: "Swarmy Stash", x: 0.54, y: 0.35 },
  { id: "O.X.R. HQ", x: 0.65, y: 0.38 },
  { id: "Shiny Shafts", x: 0.23, y: 0.44 },
  { id: "Outlaw Oasis", x: 0.16, y: 0.55 },
  { id: "Ranger's Ruin", x: 0.32, y: 0.54 },
  { id: "Foxy Floodgate", x: 0.48, y: 0.58 },
  { id: "Utopia City", x: 0.69, y: 0.54 },
  { id: "Shining Span", x: 0.81, y: 0.53 },
  { id: "Kappa Kappa Factory", x: 0.84, y: 0.73 },
  { id: "Canyon Crossing", x: 0.31, y: 0.74 },
  { id: "Demon's Debris", x: 0.54, y: 0.75 },
  { id: "Shogun's Solitude", x: 0.2, y: 0.81 },
  { id: "Outpost Enclave", x: 0.77, y: 0.81 },
];
function getRandomLocation() {
  const index = Math.floor(Math.random() * locations.length);
  return locations[index];
}

module.exports = { getRandomLocation };
