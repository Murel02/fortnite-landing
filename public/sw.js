// /public/sw.js
const CACHE = "drop-picker-v4"; // <-- bump this
const ASSETS = [
  "/", // keep the shell
  "/images/fortnite-map.png",
  "/images/fortniteOG.png",
  "/manifest.webmanifest",
  "/socket.io/socket.io.js",
];

// Install & cache (no CSS here on purpose)
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: cleanup + navigation preload
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      );
      if (self.registration.navigationPreload)
        await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })()
  );
});

// Fetch: network-first for navigations/API, cache-first for static
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

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
            (await caches.match("/")) ||
            new Response("Offline", { status: 503 })
          );
        }
      })()
    );
    return;
  }

  // CSS → network-first (so style changes appear at once)
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

  // API: network-first
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/share")) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Static: cache-first
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
