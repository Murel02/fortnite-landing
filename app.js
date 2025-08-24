 const express = require('express');
const app = express();

// Brug EJS som templatemotor
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Statiske filer (CSS)
app.use(express.static(__dirname + '/public'));

// Liste med mulige landing spots
const location = [
  { name: 'The Hive',            x: 40, y: 45 },
  { name: 'Swarmy Stash',        x: 58, y: 42 },
  { name: "Ranger's Ruin",       x: 25, y: 65 },
  { name: 'O.X.R. HQ',           x: 60, y: 48 },
  { name: 'Supernova Academy',   x: 55, y: 15 },
  { name: 'First Order Base',    x: 85, y: 20 },
  { name: 'Shining Span',        x: 85, y: 55 },
  { name: 'Utopia City',         x: 70, y: 62 },
  { name: 'Foxy Floodgate',      x: 50, y: 70 },
  { name: 'Shiny Shafts',        x: 30, y: 48 },
  { name: 'Outlaw Oasis',        x: 15, y: 50 },
  { name: 'Resistance Base',     x: 10, y: 20 },
  { name: 'Canyon Crossing',     x: 35, y: 78 },
  { name: 'Outpost Enclave',     x: 88, y: 85 },
  { name: 'Kappa Kappa Factory', x: 75, y: 67 },
  { name: "Shogun's Solitude",   x: 20, y: 90 },
  { name: "Demon's Debris",      x: 55, y: 80 }
];

app.get('/', (req, res) => {
  res.render('index', { location });
});


// Start server (vælg port 3003, så den ikke konflikter med andre apps)
const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`Landing picker klar på port ${port}`));
