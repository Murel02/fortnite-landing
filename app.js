// app.js
require("dotenv").config();

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const devGuard = require("./middleware/devGuard");
const devRoutes = require("./routes/dev");
const cookieParser = require("cookie-parser");

const app = express();

// --- View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(cookieParser());
app.use(devGuard);

// --- Static (PUBLIC) with SW no-cache
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "7d",
    setHeaders: (res, p) => {
      if (p.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

// Body parsing for forms/share target
app.use(express.urlencoded({ extended: true }));

// --- Create HTTP server BEFORE Socket.IO
const server = http.createServer(app);

// --- Socket.IO
const io = socketIo(server, {
  transports: ["websocket"],
  pingInterval: 10000,
  pingTimeout: 25000,
});

// Register socket handlers
require("./sockets/mapSocket")(io);

// --- Routes
const basicAuth = require("./middleware/basicAuth");
const indexRoutes = require("./routes/indexRoutes");
const mapRoutes = require("./routes/mapRoutes");
const apiRoutes = require("./routes/apiRoutes");

// Public routes (no auth: allow PWA install and direct /app access)
app.use("/", mapRoutes);

app.use(devRoutes);
app.get("/__dev", (req, res) =>
  res.json({ dev: !!res.locals.__dev, cookie: req.cookies.dev })
);


// Protected routes (require Basic Auth)
app.use("/api", basicAuth, apiRoutes);
app.use("/", basicAuth, indexRoutes);

// Health & noise
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
app.get("/favicon.ico", (_req, res) => res.status(204).end());

// --- Start
const port = process.env.PORT || 3003;
server.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
