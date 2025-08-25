// app.js
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

// If you use your own routes for "/", keep this:
const indexRoutes = require("./routes/index");
const { getRandomLocation } = require("./models/locations");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- Static (PUBLIC) with SW no-cache
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "7d",
    setHeaders: (res, p) => {
      if (p.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

// To parse share_target POSTs (PUBLIC)
app.use(express.urlencoded({ extended: true }));

// ===========================
// PUBLIC ROUTES (no auth)
// ===========================

// PWA shell (installable)
app.get("/app", (_req, res) => {
  const loc = getRandomLocation("current"); // default seed
  res.render("index", { location: loc, currentMap: "current" });
});

// Web Share Target -> redirect into app with seed
app.post("/share", (req, res) => {
  const seed = (req.body.text || req.body.title || "").trim();
  res.redirect(`/app?seed=${encodeURIComponent(seed)}`);
});

// ===========================
// BASIC AUTH (protect the rest)
// ===========================
function basicAuth(req, res, next) {
  const auth = { user: "fortnite", pass: "Medina" };
  const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
  const [login, password] = Buffer.from(b64auth, "base64")
    .toString()
    .split(":");
  if (login === auth.user && password === auth.pass) return next();
  res.set("WWW-Authenticate", 'Basic realm="Fortnite Random Drop"');
  res.status(401).send("Authentication required.");
}

// IMPORTANT: Socket.IO is PUBLIC to avoid blocking install prompt.
// If you want socket-level auth, use io.use(...) with a token instead.
// app.use("/socket.io", basicAuth); // <-- DO NOT enable this

// Protect API + root page(s)
app.use("/api", basicAuth);
app.use("/", basicAuth);

// ===========================
// App state + API (PROTECTED)
// ===========================

const MAP_IDS = ["current", "og"];
const stateByMap = Object.fromEntries(
  MAP_IDS.map((id) => [id, { mapId: id, location: getRandomLocation(id) }])
);

// Simple debug API to read current state
app.get("/api/current", (req, res) => {
  const mapId = req.query.mapId || "current";
  const state = stateByMap[mapId] || stateByMap.current;
  res.json(state);
});

// If you use your own index routes for "/"
app.use("/", indexRoutes);

// ===========================
// Socket.IO (PUBLIC endpoint)
// ===========================
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

// ===========================
// Start HTTP server
// ===========================
const port = process.env.PORT || 3003;
// Use 0.0.0.0 to be reachable behind proxies/containers
server.listen(port, "0.0.0.0", () =>
  console.log(`Landing picker klar på port ${port}`)
);
