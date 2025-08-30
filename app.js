// app.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");
const FortniteAPI = require("fortnite-api-io");

// If you use your own routes for "/", keep this:
const indexRoutes = require("./routes/index");
const { getRandomLocation } = require("./models/locations");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  transports: ["websocket"],
  pingInterval: 10000, // send a ping every 10s
  pingTimeout: 25000, // consider dead if no pong in 25s
});

// Instantiate with API Credentials
const client = new FortniteAPI(process.env.FORTNITEAPI_IO_KEY, {
  defaultLanguage: process.env.FORTNITE_LANG || "en",
  ignoreWarnings: false,
});
// Minimal fetch fallback for Node < 18 (GET only)
async function doFetch(url, { headers } = {}) {
  if (typeof fetch === "function") return fetch(url, { headers });
  const https = require("https");
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        method: "GET",
        hostname: u.hostname,
        path: u.pathname + (u.search || ""),
        headers: headers || {},
      },
      (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => {
          const rawHeaders = res.headers || {};
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: {
              get: (name) => {
                if (!name) return null;
                const key = String(name).toLowerCase();
                const entry = Object.entries(rawHeaders).find(
                  ([k]) => k.toLowerCase() === key
                );
                return entry ? entry[1] : null;
              },
            },
            text: async () => data,
            json: async () => {
              try {
                return JSON.parse(data || "null");
              } catch (e) {
                throw e;
              }
            },
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

// --- View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- Static (PUBLIC) with SW no-cache
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "7d",
    setHeaders: (res, p) => {
      if (p.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache");
      if (p.endsWith(".css")) res.setHeader("Cache-Control", "no-cache");
      if (p.endsWith(".webmanifest"))
        res.setHeader("Content-Type", "application/manifest+json");
    },
  })
);

// To parse share_target POSTs (PUBLIC)
app.use(express.urlencoded({ extended: true }));

// ===========================
// PUBLIC ROUTES (no auth)
// ===========================

// PWA shell (installable)
app.get("/app", async (_req, res) => {
  try {
    await refreshFortniteMap();
  } catch {}
  const loc = getRandomDynamicLocation();
  res.render("index", {
    location: loc,
    currentMap: "current",
    mapImage: fortniteMapCache.imageUrl,
  });
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

// Cached Fortnite map + POIs from external API
let fortniteMapCache = { ts: 0, imageUrl: null, pois: [], etag: null };

async function refreshFortniteMap(force = false) {
  const now = Date.now();
  if (
    !force &&
    now - fortniteMapCache.ts < 10 * 60 * 1000 &&
    fortniteMapCache.imageUrl
  ) {
    return fortniteMapCache;
  }

  const key =
    process.env.FORTNITEAPI_IO_KEY ||
    process.env.FORTNITE_API_KEY ||
    process.env.FORTNITE_API_TOKEN;
  if (!key) throw new Error("Missing FORTNITEAPI_IO_KEY");

  // 1) Static map image from fortniteapi.io (POI labels shown)
  const imageUrl =
    process.env.FORTNITE_MAP_IMAGE ||
    "https://media.fortniteapi.io/images/map.png?showPOI=true";

  // 2) POIs from fortniteapi.io
  const lang = process.env.FORTNITE_LANG || "en";
  const poisUrl =
    (process.env.FORTNITE_POIS_ENDPOINT ||
      "https://fortniteapi.io/v2/game/poi") +
    `?lang=${encodeURIComponent(lang)}`;

  const resp = await doFetch(poisUrl, {
    headers: { Accept: "application/json", Authorization: key },
  });
  if (!resp.ok) throw new Error(`POIs upstream ${resp.status}`);
  const payload = await resp.json();
  // fortniteapi.io returns: { result: true, data: [ { name, x, y }, ... ] }
  const normPois = (payload?.data || [])
    .map((p) => ({
      id: p.name || p.id || "POI",
      x: typeof p.x === "number" ? p.x : undefined,
      y: typeof p.y === "number" ? p.y : undefined,
    }))
    .filter((p) => typeof p.x === "number" && typeof p.y === "number");

  fortniteMapCache = { ts: now, imageUrl, pois: normPois, etag: null };
  return fortniteMapCache;
}

function getRandomDynamicLocation() {
  const list = fortniteMapCache.pois;
  if (list && list.length) return list[Math.floor(Math.random() * list.length)];
  return getRandomLocation("current"); // your fallback
}

const stateByMap = {
  current: { mapId: "current", location: { id: "", x: 0.5, y: 0.5 } },
  og: { mapId: "og", location: getRandomLocation("og") },
};

// Simple debug API to read current state
app.get("/api/current", async (req, res) => {
  const mapId = req.query.mapId || "current";
  try {
    if (mapId === "current") await refreshFortniteMap();
  } catch {}
  const state = stateByMap[mapId] || stateByMap.current;
  res.json({
    ...state,
    mapImage: mapId === "current" ? fortniteMapCache.imageUrl : undefined,
  });
});

// Fortnite stats proxy
// Uses Tracker Network API if TRN_API_KEY is set, else falls back to deterministic mock
app.get("/api/stats", async (req, res) => {
  try {
    const name = String(req.query.name || "").trim();
    const platform = String(req.query.platform || "epic");
    if (!name) return res.status(400).json({ error: "Missing name" });

    const key = process.env.TRN_API_KEY || process.env.FORTNITE_TRN_KEY;
    if (key) {
      const trnPlatform = platform === "epic" ? "pc" : platform; // TRN expects pc/psn/xbl
      const url = `https://api.fortnitetracker.com/v1/profile/${encodeURIComponent(
        trnPlatform
      )}/${encodeURIComponent(name)}`;
      const resp = await doFetch(url, { headers: { "TRN-Api-Key": key } });
      if (!resp.ok) {
        const text = await resp.text();
        return res
          .status(resp.status)
          .json({ error: "Upstream error", details: text });
      }
      const data = await resp.json();

      // Map lifetime stats
      const mapLT = (label) => {
        const found = (data.lifeTimeStats || []).find(
          (s) => s.key === label || s.stat === label || s.label === label
        );
        return found
          ? String(
              found.value || found.rank || found.percentile || found
            ).replace(/,/g, "")
          : undefined;
      };

      const toNumber = (v) => {
        if (v == null) return undefined;
        const n = parseFloat(String(v).replace(/%/g, ""));
        return Number.isFinite(n) ? n : undefined;
      };

      const matches =
        toNumber(mapLT("Matches Played")) ?? toNumber(mapLT("Matches"));
      const wins = toNumber(mapLT("Wins"));
      const kills = toNumber(mapLT("Kills"));
      const kd = toNumber(mapLT("K/d")) ?? toNumber(mapLT("K/D"));
      const winRate = toNumber(mapLT("Win%"));
      const top10 = toNumber(mapLT("Top 10")) ?? toNumber(mapLT("Top10"));
      const score = toNumber(mapLT("Score"));

      return res.json({
        name: data.epicUserHandle || name,
        platform,
        all: { matches, wins, kills, kd, winRate, top10, score },
        raw: { accountId: data.accountId },
      });
    }

    // Fallback mock when no API key present
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) {
      h ^= name.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const rng = (min, max) => {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      const u = ((h >>> 0) % 10000) / 10000;
      return Math.floor(min + u * (max - min + 1));
    };
    const matches = rng(50, 1500);
    const wins = Math.max(
      0,
      Math.min(matches, rng(1, Math.max(5, Math.floor(matches * 0.2))))
    );
    const kills = rng(matches, matches * 6);
    const kd = kills / Math.max(1, matches - wins);
    const top10 = Math.max(
      wins,
      rng(Math.floor(matches * 0.1), Math.floor(matches * 0.5))
    );
    const score = rng(matches * 50, matches * 200);
    res.json({
      name,
      platform,
      all: {
        matches,
        wins,
        winRate: matches ? +((wins * 100) / matches).toFixed(2) : 0,
        kills,
        kd: +kd.toFixed(2),
        top10,
        score,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: "Internal",
      message: String((err && err.message) || err),
    });
  }
});

// Proxy Fortnite map info (auto-updating source)
// Optionally uses FORTNITE_API_KEY for higher limits
app.get("/api/fortnite/map", async (_req, res) => {
  try {
    await refreshFortniteMap();
    res.json({
      imageUrl: fortniteMapCache.imageUrl,
      pois: fortniteMapCache.pois,
      ts: fortniteMapCache.ts,
    });
  } catch (e) {
    res
      .status(500)
      .json({ error: "Internal", message: String(e?.message || e) });
  }
});

// If you use your own index routes for "/"
app.use("/", indexRoutes);

// ===========================
// Socket.IO (PUBLIC endpoint)
// ===========================
io.on("connection", (socket) => {
  let joinedMap = "current";
  socket.join(joinedMap);
  (async () => {
    try {
      if (joinedMap === "current") await refreshFortniteMap();
    } catch {}
    const loc =
      joinedMap === "current"
        ? getRandomDynamicLocation()
        : stateByMap[joinedMap].location;
    socket.emit("update", {
      ...loc,
      mapId: joinedMap,
      mapImage: joinedMap === "current" ? fortniteMapCache.imageUrl : undefined,
    });
  })();

  socket.on("joinMap", ({ mapId = "current" } = {}) => {
    socket.leave(joinedMap);
    joinedMap = MAP_IDS.includes(mapId) ? mapId : "current";
    socket.join(joinedMap);
    (async () => {
      try {
        if (joinedMap === "current") await refreshFortniteMap();
      } catch {}
      const loc =
        joinedMap === "current"
          ? getRandomDynamicLocation()
          : stateByMap[joinedMap].location;
      socket.emit("update", {
        ...loc,
        mapId: joinedMap,
        mapImage:
          joinedMap === "current" ? fortniteMapCache.imageUrl : undefined,
      });
    })();
  });

  socket.on("newRandom", ({ mapId = joinedMap } = {}) => {
    const room = MAP_IDS.includes(mapId) ? mapId : "current";
    (async () => {
      try {
        if (room === "current") await refreshFortniteMap();
      } catch {}
      const location =
        room === "current"
          ? getRandomDynamicLocation()
          : getRandomLocation(room);
      stateByMap[room].location = location;
      io.to(room).emit("update", {
        ...location,
        mapId: room,
        mapImage: room === "current" ? fortniteMapCache.imageUrl : undefined,
      });
    })();
  });

  socket.on("connect_error", () => {
    ensureConnected(); // try again if the radio/OS was flaky
    joinCurrentRoom(); // re-send room in case state got lost
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
