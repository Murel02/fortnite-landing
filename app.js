const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const indexRoutes = require("./routes/index");
const { getRandomLocation } = require("./models/locations");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let currentLocation = getRandomLocation();

// View engine and static files
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
app.use(express.static(__dirname + "/public"));

// Simple Basic Auth
app.use((req, res, next) => {
  const auth = { user: "fortnite", pass: "Medina" }; // set your own creds

  const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
  const [login, password] = Buffer.from(b64auth, "base64")
    .toString()
    .split(":");

  if (login && password && login === auth.user && password === auth.pass) {
    return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="Fortnite Random Drop"');
  res.status(401).send("Authentication required.");
});

// Expose the current location via API if you still want polling
app.get("/api/current", (req, res) => {
  res.json(currentLocation);
});

// Socket.IO: on connection send the current location; on newRandom update and broadcast
io.on("connection", (socket) => {
  socket.emit("update", currentLocation);

  socket.on("newRandom", () => {
    currentLocation = getRandomLocation();
    io.emit("update", currentLocation);
  });
});

// Mount your page routes
app.use("/", indexRoutes);

// Start the HTTP server (not app.listen)
const port = process.env.PORT || 3003;
server.listen(port, () => console.log(`Landing picker klar på port ${port}`));
