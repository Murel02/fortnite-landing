// sockets/mapSocket.js
const mapModel = require("../models/fortniteMap");
const locationsModel = require("../models/locations");

const SAFE_IMAGE = "/images/fortnite-map.png"; // same as DEFAULT_LOCAL_IMAGE

module.exports = (io) => {
  io.on("connection", (socket) => {
    let currentRoom = "current";
    socket.join(currentRoom);

    const safeImage = () => mapModel.fortniteMapCache.imageUrl || SAFE_IMAGE;

    // Send initial location
    (async () => {
      try {
        if (currentRoom === "current") await mapModel.refreshFortniteMap();
      } catch (e) {
        // refreshFortniteMap never throws now, but keep defensive
        console.error("initial refresh error:", e?.message || e);
      }
      const loc =
        currentRoom === "current"
          ? mapModel.getRandomDynamicLocation()
          : locationsModel.getRandomLocation(currentRoom);

      socket.emit("update", {
        ...loc,
        mapId: currentRoom,
        mapImage: currentRoom === "current" ? safeImage() : undefined,
      });
    })();

    socket.on("joinMap", async ({ mapId = "current" } = {}) => {
      socket.leave(currentRoom);
      currentRoom = mapModel.MAP_IDS.includes(mapId) ? mapId : "current";
      socket.join(currentRoom);

      try {
        if (currentRoom === "current") await mapModel.refreshFortniteMap();
      } catch (e) {
        console.error("joinMap refresh error:", e?.message || e);
      }

      const loc =
        currentRoom === "current"
          ? mapModel.getRandomDynamicLocation()
          : locationsModel.getRandomLocation(currentRoom);

      socket.emit("update", {
        ...loc,
        mapId: currentRoom,
        mapImage: currentRoom === "current" ? safeImage() : undefined,
      });
    });

    socket.on("newRandom", async ({ mapId } = {}) => {
      const room = mapModel.MAP_IDS.includes(mapId) ? mapId : currentRoom;

      try {
        if (room === "current") await mapModel.refreshFortniteMap();
      } catch (e) {
        console.error("newRandom refresh error:", e?.message || e);
      }

      const location =
        room === "current"
          ? mapModel.getRandomDynamicLocation()
          : locationsModel.getRandomLocation(room);

      mapModel.stateByMap[room].location = location;

      io.to(room).emit("update", {
        ...location,
        mapId: room,
        mapImage: room === "current" ? safeImage() : undefined,
      });
    });
  });
};
