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

// Optional: expose current (last rolled) location
let currentLocation = getRandomLocation("current");
let currentMapId = "current";
app.get("/api/current", (_req, res) =>
  res.json({ ...currentLocation, mapId: currentMapId })
);

// Socket.IO: new roll per requested map; broadcast to all clients
io.on("connection", (socket) => {
  // Send the current state to the newly connected client (optional)
  socket.emit("update", { ...currentLocation, mapId: currentMapId });

  socket.on("newRandom", ({ mapId = "current" } = {}) => {
    currentMapId = mapId;
    currentLocation = getRandomLocation(mapId); // { id, x, y }
    io.emit("update", { ...currentLocation, mapId }); // sync everyone
  });
});

// Page routes
app.use("/", indexRoutes);

// Start HTTP server
const port = process.env.PORT || 3003;
server.listen(port, () => console.log(`Landing picker klar på port ${port}`));
