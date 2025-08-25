// app.js (only the middle section shown)

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

// Static (PUBLIC) with SW no-cache
app.use(
  express.static(__dirname + "/public", {
    maxAge: "7d",
    setHeaders: (res, p) => {
      if (p.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

app.use(express.urlencoded({ extended: true }));

// ---- PUBLIC APP SHELL ----
app.get("/app", (req, res) => {
  const loc = getRandomLocation("current");
  res.render("index", { location: loc, currentMap: "current" });
});

// ---- BASIC AUTH (protect everything else) ----
function basicAuth(req, res, next) {
  const auth = { user: "fortnite", pass: "Medina" };
  const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
  const [login, password] = Buffer.from(b64auth, "base64").toString().split(":");
  if (login === auth.user && password === auth.pass) return next();
  res.set("WWW-Authenticate", 'Basic realm="Fortnite Random Drop"');
  res.status(401).send("Authentication required.");
}

// Protect Socket.IO HTTP endpoints (handshake/polling)
app.use("/socket.io", basicAuth);

// Protect API + root page(s)
app.use("/api", basicAuth);
app.use("/", basicAuth);

//Keep separate state per map/room
const MAP_IDS = ["current", "og"];
const stateByMap = Object.fromEntries(
  MAP_IDS.map((id) => [id, { mapId: id, location: getRandomLocation(id) }])
);

// Quick API (PROTECTED) — keep this single definition
app.get("/api/current", (req, res) => {
  const mapId = req.query.mapId || "current";
  const state = stateByMap[mapId] || stateByMap.current;
  res.json(state);
});

// Socket.IO
io.on("connection", (socket) => {
  let joinedMap = null;

  socket.on("joinMap", ({ mapId = "current" } = {}) => {
    if (joinedMap) socket.leave(joinedMap);
    joinedMap = MAP_IDS.includes(mapId) ? mapId : "current";
    socket.join(joinedMap);
    const { location } = stateByMap[joinedMap];
    socket.emit("update", { ...location, mapId: joinedMap });
  });

  socket.on("newRandom", ({ mapId = joinedMap || "current" } = {}) => {
    const room = MAP_IDS.includes(mapId) ? mapId : "current";
    const location = getRandomLocation(room);
    stateByMap[room].location = location;
    io.to(room).emit("update", { ...location, mapId: room });
  });
});

// Share target → redirect to PUBLIC shell (fix)
app.post("/share", (req, res) => {
  const seed = (req.body.text || req.body.title || "").trim();
  res.redirect(`/app?seed=${encodeURIComponent(seed)}`);
});

// Page routes (PROTECTED)
app.use("/", indexRoutes);

const port = process.env.PORT || 3003;
server.listen(port, () => console.log(`Landing picker klar på port ${port}`));
