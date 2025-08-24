// app.js (server)
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const indexRoutes = require("./routes/index");
const { getRandomLocation } = require("./models/locations");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// View engine and static files
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
app.use(express.static(__dirname + "/public"));

// Simple Basic Auth (protects dynamic routes below)
app.use((req, res, next) => {
  const auth = { user: "fortnite", pass: "Medina" };
  const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
  const [login, password] = Buffer.from(b64auth, "base64")
    .toString()
    .split(":");
  if (login === auth.user && password === auth.pass) return next();
  res.set("WWW-Authenticate", 'Basic realm="Fortnite Random Drop"');
  res.status(401).send("Authentication required.");
});

//Keep spearate state per map/room
const MAP_IDS = ["current", "og"];
const stateByMap = Object.fromEntries(
  MAP_IDS.map((id) => [id, { mapId: id, location: getRandomLocation(id) }])
);

// Optional: quick API for debugging
app.get("/api/current", (req, res) => {
  const mapId = req.query.mapId || "current";
  const state = stateByMap[mapId] || stateByMap.current;
  res.json(state);
});

// --- Socket.IO ---
io.on("connection", (socket) => {
  let joinedMap = null;

  // Client tells us which map they’re looking at
  socket.on("joinMap", ({ mapId = "current" } = {}) => {
    // leave previous room, join the new one
    if (joinedMap) socket.leave(joinedMap);
    joinedMap = MAP_IDS.includes(mapId) ? mapId : "current";
    socket.join(joinedMap);

    // send the current state of that map to just this client
    const { location } = stateByMap[joinedMap];
    socket.emit("update", { ...location, mapId: joinedMap });
  });

  // Roll a new random for the active map; broadcast only to that room
  socket.on("newRandom", ({ mapId = joinedMap || "current" } = {}) => {
    const room = MAP_IDS.includes(mapId) ? mapId : "current";
    const location = getRandomLocation(room);
    stateByMap[room].location = location;
    io.to(room).emit("update", { ...location, mapId: room });
  });

  // (Optional) allow a manual switch event
  socket.on("switchMap", ({ mapId }) => {
    socket.emit("ack", { switchedTo: mapId });
    socket.emit("update", { ...stateByMap[mapId]?.location, mapId });
  });
});

// Page routes
app.use("/", indexRoutes);

// Start HTTP server
const port = process.env.PORT || 3003;
server.listen(port, () => console.log(`Landing picker klar på port ${port}`));
