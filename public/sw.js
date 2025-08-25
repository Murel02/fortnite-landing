const CACHE = "drop-picker-v2";
const ASSETS = [
  "/",
  "/app",
  "/css/style.css",
  "/images/fortnite-map.png",
  "/images/fortniteOG.png",
  "/manifest.webmanifest",
  "/socket.io/socket.io.js",
];

// Install & cache
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: cleanup + enable navigation preload (faster on Android Chrome)
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

// Fetch: network-first for HTML/API, cache-first for static
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // ignore socket transport
  if (url.pathname.startsWith("/socket.io")) return;

  // HTML navigations (shell)
  if (e.request.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          const resp = (await e.preloadResponse) || (await fetch(e.request));
          return resp;
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

  // API: network first
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/share")) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Static: cache first
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
