(() => {
  function withDev(url) {
    const u = new URL(url, location.origin);
    const params = new URLSearchParams(location.search);
    if (params.has("dev")) u.searchParams.set("dev", params.get("dev"));
    u.searchParams.set("_", Date.now()); // cache-buster
    return u.toString();
  }

  async function readError(res) {
    try {
      return await res.text();
    } catch {
      return `${res.status}`;
    }
  }

  // Debounce helper
  function debounce(fn, ms = 400) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // --- QoL helpers ---
  const SNAP = 0.01; // 1% grid
  const snap = (v) => Math.round(v / SNAP) * SNAP;
  let snapOn = true; // styres af checkbox #devSnap

  // Simpel undo (kun i UI – reloader ikke filen)
  let pois = []; // DEV-pois (redigérbare)
  let apiPois = []; // API-pois (read-only indtil promote)
  let showAll = false;
  let markersVisible = true;

  const history = [];
  const pushHistory = () => {
    try {
      history.push(JSON.stringify(pois));
      if (history.length > 50) history.shift();
    } catch {}
  };
  document.addEventListener("keydown", (e) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "z" &&
      history.length
    ) {
      try {
        pois = JSON.parse(history.pop());
        render();
        drawMarkers();
      } catch {}
    }
  });

  const listEl = document.getElementById("devList");
  const nameEl = document.getElementById("devName");
  const exportBtn = document.getElementById("devExport");
  const importFile = document.getElementById("devImportFile");
  const toggleBtn = document.getElementById("devToggleMarkers");
  const snapChk = document.getElementById("devSnap");
  const bulkBtn = document.getElementById("devBulkPaste");
  const copyJsBtn = document.getElementById("devCopyJS");
  const showAllBtn = document.getElementById("devShowAll");

  snapChk?.addEventListener("change", () => {
    snapOn = !!snapChk.checked;
  });

  // Antag kortet har id="mapImg"
  const mapImg =
    document.getElementById("mapImg") ||
    document.getElementById("mapImage") ||
    document.querySelector("[data-map-img]");
  if (!mapImg) return;

  // marker-lag (skal være klar før drawMarkers)
  const markerLayer = document.createElement("div");
  markerLayer.className = "devMarkerLayer";
  mapImg.parentElement.style.position = "relative";
  mapImg.parentElement.appendChild(markerLayer);
  if (!mapImg.complete) {
    mapImg.addEventListener("load", () => drawMarkers(), { once: true });
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, Number(v) || 0));
  }

  function xyFromEvent(ev) {
    const rect = mapImg.getBoundingClientRect();
    // brug clientX/Y hvis tilgængelig, ellers fallback til touches
    const cx =
      ev.clientX ?? ev.touches?.[0]?.clientX ?? ev.changedTouches?.[0]?.clientX;
    const cy =
      ev.clientY ?? ev.touches?.[0]?.clientY ?? ev.changedTouches?.[0]?.clientY;
    const x = clamp01((cx - rect.left) / rect.width);
    const y = clamp01((cy - rect.top) / rect.height);
    return { x, y };
  }

  // Vis coords i tooltip ved hover
  mapImg.addEventListener("mousemove", (e) => {
    const { x, y } = xyFromEvent(e);
    mapImg.title = `(${x.toFixed(3)}, ${y.toFixed(3)})`;
  });

  async function fetchPois() {
    const r = await fetch(withDev("/api/dev/pois"), { cache: "no-store" });
    if (!r.ok) {
      console.error(
        "[dev] GET /api/dev/pois failed",
        r.status,
        await readError(r)
      );
      return;
    }
    const j = await r.json();
    pois = j.pois || [];
    render();
    drawMarkers();
  }

  async function fetchAllPois() {
    const r = await fetch(withDev("/api/dev/map/pois"), { cache: "no-store" });
    if (!r.ok) {
      console.error(
        "[dev] GET /api/dev/map/pois failed",
        r.status,
        await readError(r)
      );
      return;
    }
    const j = await r.json();
    apiPois = Array.isArray(j.apiPois) ? j.apiPois : [];
    pois = Array.isArray(j.devPois) ? j.devPois : pois;
    render();
    drawMarkers();
  }

  // --- API-calls ---
  async function addPoi(poi) {
    if (snapOn) {
      poi.x = snap(poi.x);
      poi.y = snap(poi.y);
    }
    const r = await fetch(withDev("/api/dev/pois"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(poi),
      cache: "no-store",
    });
    if (!r.ok) {
      console.error(
        "[dev] POST /api/dev/pois failed",
        r.status,
        await readError(r)
      );
      alert("Kunne ikke gemme POI (se console).");
      return;
    }
    const j = await r.json();
    if (j.poi) {
      pushHistory();
      pois.push(j.poi);
    } else {
      console.warn("[dev] POST ok, men ingen {poi} i svaret", j);
    }
    render();
    drawMarkers();
  }

  async function updatePoi(id, patch) {
    if (typeof patch.x === "number")
      patch.x = clamp01(snapOn ? snap(patch.x) : patch.x);
    if (typeof patch.y === "number")
      patch.y = clamp01(snapOn ? snap(patch.y) : patch.y);
    const r = await fetch(withDev(`/api/dev/pois/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    if (!r.ok) {
      console.error(
        "[dev] PATCH /api/dev/pois/:id failed",
        r.status,
        await readError(r)
      );
      // ingen alert her ved typing, for ikke at spamme – log er nok
      return;
    }
    const j = await r.json();
    const i = pois.findIndex((p) => p.id === id);
    if (i !== -1 && j.poi) {
      pois[i] = j.poi; // opdater i hukommelsen – ingen full redraw nødvendigt
      renderRowInline(domRowForId(id), j.poi); // hold fokus i input
    }
  }

  async function removePoi(id) {
    const r = await fetch(withDev(`/api/dev/pois/${id}`), {
      method: "DELETE",
      cache: "no-store",
    });
    if (!r.ok) {
      console.error(
        "[dev] DELETE /api/dev/pois/:id failed",
        r.status,
        await readError(r)
      );
      alert("Kunne ikke slette POI (se console).");
      return;
    }
    pushHistory();
    pois = pois.filter((p) => p.id !== id);
    render();
    drawMarkers();
  }

  async function promoteApiPoi(p, x, y, newName) {
    const nx = clamp01(snapOn ? snap(x) : x);
    const ny = clamp01(snapOn ? snap(y) : y);
    const body = { id: p.id, name: newName ?? p.name, x: nx, y: ny };
    const r = await fetch(withDev("/api/dev/pois/promote"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!r.ok) {
      console.error("[dev] promote failed", r.status, await readError(r));
      alert("Kunne ikke gøre POI permanent (se console).");
      return null;
    }
    const j = await r.json();
    if (j.poi) {
      // fjern fra api, tilføj til dev
      apiPois = apiPois.filter((ap) => (ap.id ?? ap.name) !== (p.id ?? p.name));
      pois.push(j.poi);
      return j.poi;
    }
    return null;
  }

  // --- DOM helpers til listen ---
  function domRowForId(id) {
    return listEl.querySelector(`tr[data-id="${id}"]`);
  }

  function renderRowInline(tr, data) {
    if (!tr || !data) return;
    const nameInp = tr.querySelector(".devNameInput");
    const xInp = tr.querySelector(".devX");
    const yInp = tr.querySelector(".devY");
    if (nameInp && document.activeElement !== nameInp)
      nameInp.value = data.name || "";
    if (xInp && document.activeElement !== xInp)
      xInp.value = Number(data.x).toFixed(4);
    if (yInp && document.activeElement !== yInp)
      yInp.value = Number(data.y).toFixed(4);
  }

  // --- Draw markers (med labels & inline edit) ---
  function drawMarkers() {
    markerLayer.innerHTML = "";
    if (!markersVisible) return;

    const rect = mapImg.getBoundingClientRect();

    // DEV markører (redigérbare)
    pois.forEach((p) => {
      const m = document.createElement("div");
      m.className = "devMarker";
      m.style.left = p.x * rect.width + "px";
      m.style.top = p.y * rect.height + "px";
      m.dataset.id = p.id;
      m.dataset.source = "dev";

      const label = document.createElement("div");
      label.className = "devLabel";
      label.textContent = p.name || "";
      label.title = `${p.name} (${p.x.toFixed(3)}, ${p.y.toFixed(3)})`;
      label.contentEditable = "true";
      label.spellcheck = false;

      // stop map-klik (ellers tilføjer den nye POI ved skriv)
      ["pointerdown", "mousedown", "click"].forEach((ev) => {
        label.addEventListener(ev, (e) => {
          e.stopPropagation();
        });
      });

      // debounced gem ved skriv
      const debUpdate = debounce((value) => {
        const id = m.dataset.id;
        if (!id) return;
        const i = pois.findIndex((q) => q.id === id);
        if (i !== -1) pois[i].name = value; // optimistisk
        updatePoi(id, { name: value });
      }, 400);

      label.addEventListener("input", () => {
        const v = label.textContent.trim();
        label.classList.add("editing");
        debUpdate(v);
      });
      label.addEventListener("blur", () => {
        label.classList.remove("editing");
      });

      // Drag hele markøren
      let dragging = false;
      m.addEventListener("pointerdown", (e) => {
        if (e.target === label) return; // skrivning, ikke drag
        dragging = true;
        m.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      m.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const { x, y } = xyFromEvent(e);
        m.style.left = x * rect.width + "px";
        m.style.top = y * rect.height + "px";
        label.title = `${label.textContent} (${x.toFixed(3)}, ${y.toFixed(3)})`;
      });
      m.addEventListener("pointerup", async (e) => {
        if (!dragging) return;
        dragging = false;
        const { x, y } = xyFromEvent(e);
        await updatePoi(p.id, { x, y });
        // opdater listen inline
        const row = domRowForId(p.id);
        if (row) renderRowInline(row, { ...p, x, y });
      });

      m.appendChild(label);
      markerLayer.appendChild(m);
    });

    // API markører (klik/drag promoverer til dev)
    if (showAll) {
      apiPois.forEach((p) => {
        const m = document.createElement("div");
        m.className = "devMarker devMarker--api";
        m.style.left = p.x * rect.width + "px";
        m.style.top = p.y * rect.height + "px";
        m.dataset.id = p.id;
        m.dataset.source = "api";

        const label = document.createElement("div");
        label.className = "devLabel devLabel--api";
        label.textContent = p.name || "";
        label.title = `[API] ${p.name} (${p.x.toFixed(3)}, ${p.y.toFixed(
          3
        )}) — klik/drag for at gøre permanent`;
        label.contentEditable = "true";
        label.spellcheck = false;

        ["pointerdown", "mousedown", "click"].forEach((ev) => {
          label.addEventListener(ev, (e) => e.stopPropagation());
        });

        // Når man begynder at skrive i en API-label → promote med nyt navn
        const debPromoteRename = debounce(async (value) => {
          const created = await promoteApiPoi(p, p.x, p.y, value);
          if (!created) return;
          // Erstat markør-klassen og dataset til dev, opdatér liste/DOM uden full redraw
          m.classList.remove("devMarker--api");
          m.dataset.source = "dev";
          m.dataset.id = created.id;
          label.classList.remove("devLabel--api");
          label.textContent = created.name || value;
          // opdatér listen
          render();
          // hold tegningen som er, da vi allerede står på samme sted
        }, 400);

        label.addEventListener("input", () => {
          label.classList.add("editing");
          debPromoteRename(label.textContent.trim());
        });
        label.addEventListener("blur", () => {
          label.classList.remove("editing");
        });

        // Drag for at promovere på ny placering
        let dragging = false;
        m.addEventListener("pointerdown", (e) => {
          if (e.target === label) return;
          dragging = true;
          m.setPointerCapture(e.pointerId);
          e.preventDefault();
        });
        m.addEventListener("pointermove", (e) => {
          if (!dragging) return;
          const { x, y } = xyFromEvent(e);
          m.style.left = x * rect.width + "px";
          m.style.top = y * rect.height + "px";
          label.title = `[API] ${label.textContent} (${x.toFixed(
            3
          )}, ${y.toFixed(3)}) — slip for at gøre permanent`;
        });
        m.addEventListener("pointerup", async (e) => {
          if (!dragging) return;
          dragging = false;
          const { x, y } = xyFromEvent(e);
          const created = await promoteApiPoi(
            p,
            x,
            y,
            label.textContent.trim()
          );
          if (!created) return;
          // skift til dev-tilstand uden full redraw
          m.classList.remove("devMarker--api");
          m.dataset.source = "dev";
          m.dataset.id = created.id;
          label.classList.remove("devLabel--api");
          label.textContent = created.name || label.textContent;
          render(); // opdatér listen
        });

        m.appendChild(label);
        markerLayer.appendChild(m);
      });
    }
  }

  function render() {
    const sorted = [...pois].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
    listEl.innerHTML = sorted
      .map(
        (p) => `
      <tr data-id="${p.id}">
        <td><input class="devNameInput" value="${p.name || ""}" /></td>
        <td><input class="devX" value="${p.x.toFixed(4)}" /></td>
        <td><input class="devY" value="${p.y.toFixed(4)}" /></td>
        <td class="devActions">
          <button class="btn btn-xs devCenter">Center</button>
          <button class="btn btn-xs devDelete">Slet</button>
        </td>
      </tr>
    `
      )
      .join("");
  }

  // Klik på kort for at tilføje ny DEV-POI
  mapImg.addEventListener("click", async (e) => {
    if (e.target.closest && e.target.closest(".devLabel")) return; // skrivning → ignorér kort-klik
    const { x, y } = xyFromEvent(e);
    const name = (nameEl.value || "Ny lokation").trim();
    await addPoi({ name, x: snapOn ? snap(x) : x, y: snapOn ? snap(y) : y });
    nameEl.value = "";
  });

  // Liste: redigér/slet/center
  // Debounce navn-opdatering fra listen
  const debUpdateNameFromList = debounce(
    (id, value) => updatePoi(id, { name: value }),
    350
  );

  listEl.addEventListener("input", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id;
    if (e.target.classList.contains("devNameInput")) {
      const value = e.target.value;
      const i = pois.findIndex((p) => p.id === id);
      if (i !== -1) pois[i].name = value;
      debUpdateNameFromList(id, value);
    } else if (
      e.target.classList.contains("devX") ||
      e.target.classList.contains("devY")
    ) {
      const x = clamp01(parseFloat(tr.querySelector(".devX").value));
      const y = clamp01(parseFloat(tr.querySelector(".devY").value));
      updatePoi(id, { x, y });
      // opdater markerens position live
      const rect = mapImg.getBoundingClientRect();
      const marker = markerLayer.querySelector(`.devMarker[data-id="${id}"]`);
      if (marker) {
        marker.style.left = x * rect.width + "px";
        marker.style.top = y * rect.height + "px";
      }
    }
  });

  listEl.addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id;
    if (e.target.classList.contains("devDelete")) {
      removePoi(id);
    } else if (e.target.classList.contains("devCenter")) {
      const p = pois.find((p) => p.id === id);
      if (!p) return;
      const m = markerLayer.querySelector(`.devMarker[data-id="${id}"]`);
      if (m) {
        m.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
        m.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.4)" },
            { transform: "scale(1)" },
          ],
          { duration: 500 }
        );
      }
    }
  });

  // Export/Import
  exportBtn?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ pois }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dev-pois.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  importFile?.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const json = JSON.parse(text);
      const r = await fetch(withDev("/api/dev/pois/import"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
        cache: "no-store",
      });
      await r.json();
      await fetchPois();
    } catch {
      alert("Kunne ikke importere JSON.");
    } finally {
      importFile.value = "";
    }
  });

  // Vis/skjul markører
  toggleBtn?.addEventListener("click", () => {
    markersVisible = !markersVisible;
    drawMarkers();
  });

  // Vis alle (API+DEV) toggle
  showAllBtn?.addEventListener("click", async () => {
    showAll = !showAll;
    showAllBtn.textContent = showAll ? "Skjul API-POIs" : "Vis alle POIs";
    if (showAll && apiPois.length === 0) await fetchAllPois();
    drawMarkers();
  });

  // Redraw on resize
  window.addEventListener("resize", drawMarkers);

  // Init
  fetchPois();
})();
