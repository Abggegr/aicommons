"use strict";

const CACHE_NAME = "ai-demand-scene-cards-2026-08-23-v2";
const MANAGED_CACHE_PREFIXES = [
  "ai-demand-scene-cards-",
  "boss-ai-demand-cards-"
];
const APP_URL = new URL("./index.html", self.registration.scope).href;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./assets/app-icon-180.png",
  "./assets/app-icon-192.png",
  "./assets/app-icon-512.png"
].map((path) => new URL(path, self.registration.scope).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && MANAGED_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const requestURL = new URL(request.url);
  if (requestURL.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const networkUpdate = fetch(request)
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_URL, response.clone());
        }
        return response;
      })
      .catch(() => null);

    event.waitUntil(networkUpdate.then(() => undefined));
    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreSearch: true })
        || await caches.match(APP_URL);
      if (cached) return cached;

      const response = await networkUpdate;
      if (response) return response;

      return new Response("离线内容尚未准备完成，请恢复网络后重新打开一次。", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    })());
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
