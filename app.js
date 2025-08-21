 const express = require('express');
const app = express();

// Brug EJS som templatemotor
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Statiske filer (CSS)
app.use(express.static(__dirname + '/public'));

// Liste med mulige landing spots
const spots = [
  { name: 'The Hive' },
  { name: 'Swarmy Stash' },
  { name: 'Ranger\'s Ruin' },
  { name: 'O.X.R. HQ' },
  { name: 'Supernova Academy' },
  { name: 'First Order Base' },
  { name: 'Shining Span' },
  { name: 'Utopia City' },
  { name: 'Foxy Floodgate' },
  { name: 'Shiny Shafts' },
  { name: 'Outlaw Oasis' },
  { name: 'Resistance Base' },
  { name: 'Canyon Crossing' },
  { name: 'Outpost Enclave' },
  { name: 'Kappa Kappa Factory' },
  { name: 'Shogun\'s Solitude' },
  { name: 'Demon\'s Debris' }
];

app.get('/', (req, res) => {
  res.render('index', { spots });
});

// Start server (vælg port 3003, så den ikke konflikter med andre apps)
const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`Landing picker klar på port ${port}`));
