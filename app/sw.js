// Voyage service worker — app-shell caching so the installed PWA opens fast
// and works on a weak/no connection (e.g. abroad). Bump CACHE to force a refresh.
const CACHE = "voyage-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  // Only handle our own origin; let Supabase / other hosts go straight to network.
  if (url.origin !== self.location.origin) return;

  // HTML navigations: network-first (always get the latest), fall back to cache offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => { const c = r.clone(); caches.open(CACHE).then((ca) => ca.put(req, c)); return r; })
        .catch(() => caches.match(req).then((m) => m || caches.match("index.html")))
    );
    return;
  }

  // Hashed assets (js/css/img): cache-first — names change on each deploy, so this is safe.
  e.respondWith(
    caches.match(req).then((m) =>
      m || fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((ca) => ca.put(req, c)); return r; }).catch(() => m)
    )
  );
});
