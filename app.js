 const express = require('express');
const app = express();

// Brug EJS som templatemotor
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Statiske filer (CSS)
app.use(express.static(__dirname + '/public'));

// Liste med mulige landing spots
const spots = [
  { name: 'O.X.R HQ', description: 'Et af sæsonens hotteste spots med O.X.R-kister og Leadspitter 3000.' },
  { name: "Demon's Debris", description: 'Stor lokation med masser af kister, Swarmer Nests og Hive Stashes.' },
  { name: 'Rocky RVs', description: 'Nordøst for The Hive; mange kister, køretøjer, Launchpad og en Reboot Van.' },
  { name: 'Predator Peak', description: 'Bjerg nord for Canyon Crossing med kister, Slurp-tønder, Launchpad og zipline.' },
  { name: "Pumpin' Pipes", description: 'Syd for First Order Base; fyldt med kister, skjulesteder og god mobilitet.' },
  { name: 'Kappa Kappa Factory', description: 'Hjørnet af kortet; mange kister, pengeskabe og et Capture Point.' },
  { name: 'Lovely Lane', description: 'Nordvestligt hemmeligt sted; sikker og loot‑rig zone.' }
];

app.get('/', (req, res) => {
  const spot = spots[Math.floor(Math.random() * spots.length)];
  res.render('index', { spot });
});

// Start server (vælg port 3003, så den ikke konflikter med andre apps)
const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`Landing picker klar på port ${port}`));
