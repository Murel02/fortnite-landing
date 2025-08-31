// sockets/mapSocket.js
// IMPORTANT: don't destructure from the model to avoid circular require issues.
const fortniteMap = require("../models/fortniteMap");

module.exports = (io) => {
  io.on("connection", (socket) => {
    const log = (...args) => console.log("[socket]", socket.id, ...args);

    async function sendUpdate(where = "init", force = false) {
      try {
        if (typeof fortniteMap.refreshFortniteMap === "function") {
          await fortniteMap.refreshFortniteMap(force);
        }

        const getLoc =
          typeof fortniteMap.getRandomDynamicLocation === "function"
            ? fortniteMap.getRandomDynamicLocation
            : () => ({ id: "Center", name: "Center", x: 0.5, y: 0.5 });

        const loc = getLoc();
        const imageUrl =
          (fortniteMap.fortniteMapCache &&
            fortniteMap.fortniteMapCache.imageUrl) ||
          "";

        const payload = {
          ...loc,
          mapId: "current",
          mapImage: imageUrl,
        };

        socket.emit("update", payload);
        log("update → client", where, payload.id, payload.x, payload.y);
        return payload;
      } catch (e) {
        log("sendUpdate error", e?.message || e);
        return null;
      }
    }

    // First payload
    sendUpdate("connect");

    // Join (kept for future multi-map support)
    socket.on("joinMap", async (_data = {}, ack) => {
      const payload = await sendUpdate("joinMap");
      if (typeof ack === "function") ack({ ok: !!payload, payload });
    });

    // New random drop
    socket.on("newRandom", async (_data = {}, ack) => {
      const payload = await sendUpdate("newRandom");
      if (typeof ack === "function") ack({ ok: !!payload, payload });
    });

    // Optional health ping
    socket.on("ping:alive", (ack) => {
      if (typeof ack === "function") ack({ ok: true, ts: Date.now() });
    });
  });
};
