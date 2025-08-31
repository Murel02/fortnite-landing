const express = require("express");
const {
  list, // dev list
  add, // create dev poi
  update, // update dev poi
  remove, // delete dev poi
  saveAll, // bulk replace
} = require("../models/devPoisStore");
const { getPoiList } = require("../models/fortniteMap");

const router = express.Router();

// JSON body
router.use(express.json());

// Hent ALLE DEV-POIs
router.get("/api/dev/pois", (_req, res) => {
  res.json({ pois: list() });
});

// Tilføj DEV-POI
router.post("/api/dev/pois", (req, res) => {
  try {
    const { name, x, y } = req.body || {};
    if (x == null || y == null) {
      return res.status(400).json({ error: "Missing x/y" });
    }
    const created = add({ name, x, y });
    res.json({ poi: created });
  } catch (e) {
    console.error("[dev] add error:", e);
    res.status(500).json({ error: "server_write_failed" });
  }
});

// Opdater DEV-POI
router.patch("/api/dev/pois/:id", (req, res) => {
  try {
    const updated = update(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ poi: updated });
  } catch (e) {
    console.error("[dev] update error:", e);
    res.status(500).json({ error: "server_write_failed" });
  }
});

// Slet DEV-POI
router.delete("/api/dev/pois/:id", (req, res) => {
  try {
    const ok = remove(req.params.id);
    res.json({ ok });
  } catch (e) {
    console.error("[dev] delete error:", e);
    res.status(500).json({ error: "server_write_failed" });
  }
});

// Bulk import (valgfrit)
router.post("/api/dev/pois/import", (req, res) => {
  try {
    const pois = Array.isArray(req.body?.pois) ? req.body.pois : null;
    if (!pois) return res.status(400).json({ error: "Missing pois[]" });
    const saved = saveAll(
      pois.map((p) => ({ ...p, x: Number(p.x), y: Number(p.y) }))
    );
    res.json({ pois: saved });
  } catch (e) {
    console.error("[dev] import error:", e);
    res.status(500).json({ error: "server_write_failed" });
  }
});

/**
 * VIS ALLE: API + DEV
 * Brug fortniteMap.getPoiList() som den samlede liste app’en bruger (API + evtl. merge),
 * og del den op i:
 *  - apiPois: dem der IKKE findes i DEV-listen
 *  - devPois: dine egne fra devPoisStore
 */
router.get("/api/dev/map/pois", (_req, res) => {
  try {
    const merged = Array.isArray(getPoiList?.()) ? getPoiList() : [];
    const devList = list();

    const key = (p) => (p.id && String(p.id)) || (p.name || "").toLowerCase();
    const devKeys = new Set(devList.map(key));
    const apiOnly = merged.filter((p) => !devKeys.has(key(p)));

    res.json({
      apiPois: apiOnly,
      devPois: devList,
      mergedPois: merged, // valgfrit til debug
    });
  } catch (e) {
    console.error("[dev] map/pois error:", e);
    res.status(500).json({ error: "server_failed" });
  }
});

/**
 * Promote: gør en API-POI permanent ved at oprette den i dev storage.
 * Hvis klienten sender samme id som API’en, bevares id’et (ellers genereres et).
 */
router.post("/api/dev/pois/promote", (req, res) => {
  try {
    const { id, name, x, y } = req.body || {};
    if (x == null || y == null)
      return res.status(400).json({ error: "Missing x/y" });
    const created = add({ id, name, x, y });
    res.json({ poi: created });
  } catch (e) {
    console.error("[dev] promote error:", e);
    res.status(500).json({ error: "server_write_failed" });
  }
});

router.post("/dev/toggle", (req, res) => {
  if (!res.locals.__owner) {
    return res.status(403).json({ error: "Owner required" });
  }
  const on =
    req.body?.on === "1" || req.body?.on === "true" || req.body?.on === "on";
  if (on) {
    res.cookie("dev", "1", {
      maxAge: 12 * 60 * 60 * 1000, // 12 timer
      httpOnly: false,
      sameSite: "Lax",
    });
  } else {
    res.clearCookie("dev");
  }
  return res.json({ ok: true, dev: on });
});

module.exports = router;
