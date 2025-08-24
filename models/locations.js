// models/locations.js

// Named locations per map. Coords are normalized (0..1) to the image you show.
const locationsByMap = {
  current: [
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
  ],

  // ⚠️ Fill these with your OG named POIs + coords for /images/fortniteOG.png
  og: [
    { id: "Junk Junction", x: 0.19, y: 0.14 },
    { id: "Haunted Hills", x: 0.13, y: 0.22 },
    { id: "Pleasant Park", x: 0.28, y: 0.31 },
    { id: "Lazy Links", x: 0.53, y: 0.23 },
    { id: "Risky Reels", x: 0.74, y: 0.21 },
    { id: "Tomato Town", x: 0.66, y: 0.34 },
    { id: "Wailing Woods", x: 0.82, y: 0.31 },
    { id: "Lonely Lodge", x: 0.89, y: 0.43 },
    { id: "Dusty Divot", x: 0.6, y: 0.52 },
    { id: "Tilted Towers", x: 0.37, y: 0.51 },
    { id: "Shifty Shafts", x: 0.36, y: 0.65 },
    { id: "Greasy Grove", x: 0.22, y: 0.64 },
    { id: "Snobby Shores", x: 0.07, y: 0.47 },
    { id: "Flush Factory", x: 0.35, y: 0.89 },
    { id: "Lucky Landing", x: 0.57, y: 0.94 },
    { id: "Fatal Fields", x: 0.6, y: 0.79 },
    { id: "Retail Row", x: 0.75, y: 0.55 },
    { id: "Paradise Palms", x: 0.81, y: 0.76 },
    { id: "Racetack", x: 0.89, y: 0.62 },
    { id: "Salty Springs", x: 0.57, y: 0.64 },
  ],
};

function getRandomLocation(mapId = "current") {
  const list = locationsByMap[mapId] || locationsByMap.current;
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = { getRandomLocation, locationsByMap };
