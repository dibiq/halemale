const CACHE_VERSION = "v1";
const PRECACHE_NAME = `halemale-precache-${CACHE_VERSION}`;
const RUNTIME_NAME = `halemale-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = ["/", "/index.html", "/game.js"]; // core shell

const CDN_HOSTS = [
  "https://halemale.onrender.com",
  "https://cushi-assets.onrender.com",
  "https://cdn.jsdelivr.net",
  "https://cdn.socket.io",
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("halemale-") &&
                ![PRECACHE_NAME, RUNTIME_NAME].includes(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCdnRequest(url) {
  return CDN_HOSTS.some((host) => url.startsWith(host));
}

function isStaticAsset(request) {
  return ["image", "audio", "font"].includes(request.destination);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = request.url;
  const isNavigate = request.mode === "navigate";

  if (isNavigate) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((res) => res || caches.match("/")),
        ),
    );
    return;
  }

  if (isCdnRequest(url) || isStaticAsset(request)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(RUNTIME_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => undefined);
      }),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => response)
      .catch(() => caches.match(request)),
  );
});
