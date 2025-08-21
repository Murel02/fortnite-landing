 const express = require('express');
const app = express();

// Brug EJS som templatemotor
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Statiske filer (CSS)
app.use(express.static(__dirname + '/public'));

// Liste med mulige landing spots
 const spots = [
  { name: 'The Hive', x: 43, y: 39 },
  { name: 'Swarmy Stash', x: 61, y: 39 },
  { name: 'Ranger\'s Ruin', x: 29, y: 69 },
  { name: 'O.X.R. HQ', x: 63, y: 44 },
  { name: 'Supernova Academy', x: 60, y: 13 },
  { name: 'First Order Base', x: 83, y: 20 },
  { name: 'Shining Span', x: 83, y: 56 },
  { name: 'Utopia City', x: 72, y: 56 },
  { name: 'Foxy Floodgate', x: 48, y: 66 },
  { name: 'Shiny Shafts', x: 26, y: 47 },
  { name: 'Outlaw Oasis', x: 16, y: 50 },
  { name: 'Resistance Base', x: 13, y: 19 },
  { name: 'Canyon Crossing', x: 42, y: 85 },
  { name: 'Outpost Enclave', x: 89, y: 85 },
  { name: 'Kappa Kappa Factory', x: 81, y: 65 },
  { name: 'Shogun\'s Solitude', x: 20, y: 91 },
  { name: 'Demon\'s Debris', x: 56, y: 81 }
];

app.get('/', (req, res) => {
  res.render('index', { spots });
});


// Start server (vælg port 3003, så den ikke konflikter med andre apps)
const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`Landing picker klar på port ${port}`));
