// sockets/mapSocket.js
const { getLatest, newPick, getOrCreate } = require("../models/fortniteMap");

module.exports = function attachMapSocket(io) {
  io.on("connection", (socket) => {
    function joinMap(mapId = "current") {
      // leave all non-private rooms
      for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
      socket.join(mapId);

      // send current pick immediately (late joiners)
      const latest = getLatest(mapId);
      if (latest) socket.emit("update", latest);
    }

    // default room until client says otherwise
    joinMap("current");

    socket.on("joinMap", ({ mapId } = {}, ack) => {
      joinMap(mapId || "current");
      ack && ack({ ok: true });
    });

    socket.on("newRandom", ({ mapId } = {}, ack) => {
      const m = mapId || "current";
      const payload = newPick(m); // one server decision
      io.to(m).emit("update", payload); // broadcast same pick to everyone
      ack && ack({ ok: true });
    });

    // optional: on connect ensure there’s a pick (helps first visitor)
    socket.once("connect_init", ({ mapId } = {}) => {
      const payload = getOrCreate(mapId || "current");
      socket.emit("update", payload);
    });
  });
};
