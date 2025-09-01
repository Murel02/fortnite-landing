// /public/sw.js
const CACHE = "drop-picker-v12"; // bump ved ændringer
const ASSETS = [
  "/", // shell
  "/app?source=pwa", // app-UI som offline fallback
  "/images/fortnite-map.png",
  "/images/fortniteOG.png",
  "/manifest.webmanifest",
  "/socket.io/socket.io.js",
];

// Install: precache basen (uden CSS, så styles kan opdatere hurtigt)
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: ryd gamle caches + navigation preload + tag kontrol
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      );
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {}
      }
      await self.clients.claim();
      // Fortæl klienter at der er ny SW (så UI kan reloade hvis man vil)
      const clients = await self.clients.matchAll({
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({ type: "SW_READY" });
      }
    })()
  );
});

// Hjælpere
function isImageRequest(url) {
  return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname);
}
function isIcon(url) {
  return url.pathname.startsWith("/icons/");
}

// Fetch: network-first for navigations og API; cache-first for statics; SWR for images/icons
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Skip alt der IKKE er GET (fx POST /owner/activate)
  if (e.request.method !== "GET") {
    // lad browseren håndtere den normalt (eller brug network-first hvis du vil)
    return;
  }

  // Don't interfere with socket transports
  if (url.pathname.startsWith("/socket.io")) return;

  // HTML navigations
  if (e.request.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          return (await e.preloadResponse) || (await fetch(e.request));
        } catch {
          return (
            (await caches.match("/app?source=pwa")) ||
            (await caches.match("/")) ||
            new Response("Offline", { status: 503 })
          );
        }
      })()
    );
    return;
  }

  // CSS → network-first
  if (url.pathname.startsWith("/css/")) {
    e.respondWith(
      fetch(e.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // API og formular-endpoints → network-first (GETs)
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/share") ||
    url.pathname.startsWith("/owner/") ||
    url.pathname.startsWith("/dev/")
  ) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Images & icons → stale-while-revalidate
  if (
    /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname) ||
    url.pathname.startsWith("/icons/")
  ) {
    e.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(e.request, { ignoreSearch: true });
        const networkPromise = fetch(e.request)
          .then((resp) => {
            cache.put(e.request, resp.clone());
            return resp;
          })
          .catch(() => null);
        return (
          cached || (await networkPromise) || new Response("", { status: 504 })
        );
      })()
    );
    return;
  }

  // Øvrige statics → cache-first
  e.respondWith(
    caches.match(e.request).then(
      (r) =>
        r ||
        fetch(e.request).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return resp;
        })
    )
  );
});

// Opdaterings-flow: tillad klient at spørge SW om at skipWaiting
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
