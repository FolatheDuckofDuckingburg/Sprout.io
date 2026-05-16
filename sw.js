// This file runs in the background and makes the app work offline
// It also allows the device to install it as a real app!

const CACHE_NAME = 'sprout-app-v1';
const urlsToCache = [
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return the cached version if found, otherwise download it from the internet
        return response || fetch(event.request);
      })
  );
});
