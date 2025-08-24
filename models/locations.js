const locations = [];

const rows = 'ABCDEFGHIJ'.split('');
const cols = Array.from({ length: 10 }, (_, i) => i + 1);

for (const r of rows){
    for(const c of cols){
        locations.push({ id: `${r}${c}`, row: r, col: c});
    }
}

function getRandomLocations(){
    const index = Math.floor(Math.random() * locations.length);
    return locations[index];
}

module.exports = { getRandomLocations };