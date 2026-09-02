// ponytail: einfacher Cache-First fuer die App-Huelle, kein Update-Handling
// ueber Versions-Diffing. Upgrade wenn's stoert: Cache-Namen bei jedem Release
// hochzaehlen (cache-v2, ...) statt CACHE hart zu pflegen.
const CACHE = "cockpit-v55"; // bei jedem Release hochzaehlen, sonst kriegt das Handy die alte Version
const DATEIEN = ["index.html", "style.css", "app.js", "manifest.json",
                 "msal-browser.min.js", "jszip.min.js", "onedrive.js",
                 "logo.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Nur GET cachen; POST /update geht immer ans Netz.
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("daten/snapshot.json")) {
    // Snapshot: Netz zuerst (immer frisch, wenn der Server laeuft),
    // sonst letzter bekannter Stand - die App zeigt ohne Server dann
    // die Daten vom letzten Laden. Wie alt sie sind, steht sichtbar
    // in der Stand-Zeile ("Stand ...").
    e.respondWith(
      fetch(e.request).then((antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(CACHE).then((c) => c.put(e.request, kopie));
        }
        return antwort;
      }).catch(() => caches.match(e.request).then(
        (hit) => hit || new Response("", { status: 503 })))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
