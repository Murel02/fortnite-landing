 const express = require('express');
 const indexRoutes = require('./routes/index');
const app = express();

// Brug EJS som templatemotor
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Statiske filer (CSS)
app.use(express.static(__dirname + '/public'));




app.use('/', indexRoutes);


// Start server (vælg port 3003, så den ikke konflikter med andre apps)
const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`Landing picker klar på port ${port}`));
