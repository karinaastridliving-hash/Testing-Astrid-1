// Astrid Living service worker: caches the app shell, never touches Supabase/API/map traffic.
const CACHE = "astrid-shell-v1";
const SHELL = [
  "./", "index.html", "styles.css", "config.js", "data.js", "app.js",
  "nearby.js", "auth.js", "feedback.js", "logo.png",
  "vendor/leaflet/leaflet.css", "vendor/leaflet/leaflet.js",
  "vendor/supabase/supabase.js", "icons/icon-192.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Only same-origin GETs. Supabase, geocoding, map tiles etc. go straight to the network.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Network first, cache as fallback: you always get the latest code when online.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
  );
});
