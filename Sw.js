// sw.js - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ
const CACHE_NAME = 'homework-tracker-v2.0'; // Обновленная версия
const RUNTIME_CACHE = 'runtime-cache-v2.0';

// ОПТИМИЗАЦИЯ: Минимальный набор для быстрого старта
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Установка SW
self.addEventListener('install', event => {
  console.log('[SW] Установка v2.0');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Кэширование критичных ресурсов');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Установка завершена');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Ошибка кэширования:', err);
      })
  );
});

// Активация SW
self.addEventListener('activate', event => {
  console.log('[SW] Активация v2.0');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => {
            // Удаляем все старые версии кеша
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map(cacheName => {
            console.log('[SW] Удаляем старый кэш:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('[SW] Активация завершена');
      return self.clients.claim();
    })
  );
});

// ОПТИМИЗАЦИЯ: Улучшенная стратегия кеширования
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Игнорируем запросы к chrome-extension и другим внешним источникам
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // === SUPABASE API - Network First с Fallback на кеш ===
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Кешируем только GET запросы с успешным ответом
          if (request.method === 'GET' && response && response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Если сеть недоступна, пытаемся достать из кеша
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            console.log('[SW] Возвращаем из кеша (offline):', request.url);
            return cachedResponse;
          }
          
          // Если в кеше нет, возвращаем пустой массив для GET запросов
          if (request.method === 'GET') {
            return new Response(JSON.stringify([]), {
              status: 200,
              headers: { 
                'Content-Type': 'application/json',
                'X-SW-Fallback': 'true'
              }
            });
          }
          
          // Для других методов возвращаем ошибку
          return new Response(JSON.stringify({ error: 'Нет соединения' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // === ИЗОБРАЖЕНИЯ - Cache First для ускорения загрузки ===
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // === HTML и СТАТИЧЕСКИЕ РЕСУРСЫ - Stale-While-Revalidate ===
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      const fetchPromise = fetch(request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Если сеть недоступна, возвращаем кешированную версию
          return cachedResponse || new Response('Нет соединения', { 
            status: 503,
            headers: { 
              'Content-Type': 'text/plain; charset=utf-8',
              'X-SW-Fallback': 'true'
            }
          });
        });

      // Возвращаем кешированную версию сразу, если есть
      return cachedResponse || fetchPromise;
    })
  );
});

// ОПТИМИЗАЦИЯ: Периодическая очистка старых кешей
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data === 'CLEAN_OLD_CACHES') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        const cachesToDelete = cacheNames.filter(name => 
          name !== CACHE_NAME && name !== RUNTIME_CACHE
        );
        return Promise.all(
          cachesToDelete.map(name => caches.delete(name))
        );
      })
    );
  }
});

// ОПТИМИЗАЦИЯ: Prefetch критичных ресурсов
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './manifest.json'
      ]);
    })
  );
});