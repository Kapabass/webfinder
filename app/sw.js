// Service worker нужен ради одного: чтобы значок на домашнем экране открывался
// мгновенно и в метро. Ничего не перехватывает за пределами своей папки —
// запросы к ya.ru идут мимо.

const CACHE = 'webfinder-v1';

const SHELL = [
  './',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Переходы — из сети, с откатом в кеш. Наоборот нельзя: правка страницы
  // иначе не доедет до тех, у кого приложение уже стоит.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        // ignoreSearch обязателен: запускается приложение по адресу с ?vid=,
        // а в кеше лежит страница без параметров.
        caches.match('./', { ignoreSearch: true })
      )
    );
    return;
  }

  // Остальное — из кеша сразу, обновление в фоне к следующему запуску.
  // Чистый cache-first здесь уже подвёл: правленый манифест не доезжал,
  // пока не сменишь имя кеша руками. Выкладка не должна этого требовать.
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((hit) => {
        const fresh = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => hit);           // нет сети — довольствуемся кешем

        // waitUntil обязателен. Без него браузер вправе усыпить воркер сразу
        // после ответа из кеша, и фоновая загрузка не доживёт до cache.put —
        // проверено, обновление так и не доезжало.
        event.waitUntil(fresh);

        return hit || fresh;
      })
    )
  );
});
