const CACHE_PREFIX = "doc-studio-";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((key) => key.startsWith(CACHE_PREFIX))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
