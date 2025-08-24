const express = require("express");
const indexRoutes = require("./routes/index");
const { getRandomLocation } = require("./models/locations");

const app = express();

// Brug EJS som templatemotor
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

// shared state for random drop
let currentLocation = getRandomLocation();

// API route: get the current location
app.get("/api/current", (req, res) => {
  res.json(currentLocation);
});

// API route: request a new random location
app.post("/api/random", (req, res) => {
  currentLocation = getRandomLocation();
  res.json(currentLocation);
});

// mount your page routes
app.use("/", indexRoutes);

// start server
const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`Landing picker klar på port ${port}`));
