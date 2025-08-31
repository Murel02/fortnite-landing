const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "dev-pois.json");

// Struktur: { pois: [{ id, name, x, y }], updatedAt }
function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(
      FILE,
      JSON.stringify({ pois: [], updatedAt: Date.now() }, null, 2)
    );
  }
}
function readAll() {
  ensureFile();
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}
function writeAll(data) {
  ensureFile();
  data.updatedAt = Date.now();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  return data;
}

exports.list = () => readAll().pois;
exports.saveAll = (pois) => writeAll({ pois }).pois;

exports.add = (poi) => {
  const data = readAll();
  const id =
    poi.id ||
    (poi.name || "poi").toLowerCase().replace(/\s+/g, "-") +
      "-" +
      Date.now().toString(36);
  const entry = {
    id,
    name: poi.name || id,
    x: Number(poi.x),
    y: Number(poi.y),
  };
  data.pois.push(entry);
  writeAll(data);
  return entry;
};

exports.update = (id, patch) => {
  const data = readAll();
  const i = data.pois.findIndex((p) => p.id === id);
  if (i === -1) return null;
  data.pois[i] = {
    ...data.pois[i],
    ...patch,
    x: Number(patch.x ?? data.pois[i].x),
    y: Number(patch.y ?? data.pois[i].y),
  };
  writeAll(data);
  return data.pois[i];
};

exports.remove = (id) => {
  const data = readAll();
  const before = data.pois.length;
  data.pois = data.pois.filter((p) => p.id !== id);
  writeAll(data);
  return data.pois.length !== before;
};
