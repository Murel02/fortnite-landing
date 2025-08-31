require("dotenv").config();

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const cookieParser = require("cookie-parser");

const owner = require("./middleware/owner");
const devGuard = require("./middleware/devGuard");

const app = express();

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- ORDER MATTERS ---
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(owner);
app.use(devGuard);

// Static
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "7d",
    setHeaders: (res, p) => {
      if (p.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

// HTTP + IO
const server = http.createServer(app);
const io = socketIo(server, {
  transports: ["websocket"],
  pingInterval: 10000,
  pingTimeout: 25000,
});
require("./sockets/mapSocket")(io);

// Routes
const basicAuth = require("./middleware/basicAuth");
const indexRoutes = require("./routes/indexRoutes");
const mapRoutes = require("./routes/mapRoutes");
const apiRoutes = require("./routes/apiRoutes");
const devRoutes = require("./routes/dev");

// Public routes (ingen auth)
app.use("/", mapRoutes);

// Offentlig alias: /app → /
app.get("/app", (_req, res) => res.redirect("/"));

// Offentlig unlock-side (hvis du har routes/unlock.js)
try {
  app.use("/", require("./routes/unlock"));
} catch {}

// Dev/endpoints (owner/dev toggles + dev API'er)
app.use(devRoutes);

// PROTECTED (kræver Basic Auth — men owner bypasser nu)
app.use("/api", apiRoutes);
app.use("/", indexRoutes);

// Health
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
app.get("/favicon.ico", (_req, res) => res.status(204).end());

// Start
const port = process.env.PORT || 3003;
server.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
