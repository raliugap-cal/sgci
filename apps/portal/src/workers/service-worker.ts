// ═══════════════════════════════════════════════════════════
// SERVICE WORKER — Portal Paciente PWA
// Offline-first: citas, expediente, recetas, diario adicciones
// ═══════════════════════════════════════════════════════════

const CACHE_VERSION = 'sgci-portal-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Recursos que siempre se cachean al instalar el SW
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/dashboard',
  '/citas',
  '/mi-salud',
  '/resultados',
  '/recetas',
  '/mensajes',
  '/diario',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Endpoints de API que se cachean con estrategia network-first
const CACHEABLE_API_PATTERNS = [
  /\/api\/v1\/patients\/\w+\/prefetch/,
  /\/api\/v1\/patients\/\w+\/appointments/,
  /\/api\/v1\/patients\/\w+\/diagnoses/,
  /\/api\/v1\/patients\/\w+\/allergies/,
  /\/api\/v1\/patients\/\w+\/prescriptions/,
  /\/api\/v1\/patients\/\w+\/results/,
  /\/api\/v1\/patients\/\w+\/messages/,
  /\/api\/v1\/patients\/\w+\/diary/,
  /\/api\/v1\/catalogs\//,
];

// ─── Instalación ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Pre-cacheando assets estáticos');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting()),
  );
});

// ─── Activación ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('sgci-portal-') && k !== STATIC_CACHE && k !== DYNAMIC_CACHE && k !== API_CACHE)
          .map((k) => {
            console.log('[SW] Eliminando caché obsoleto:', k);
            return caches.delete(k);
          }),
      ),
    ).then(() => self.clients.claim()),
  );
});

// ─── Interceptar requests ─────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar GET y POST (POST solo para sync)
  if (request.method === 'PUT' || request.method === 'DELETE') return;

  // Solicitudes de API
  if (url.pathname.startsWith('/api/')) {
    // POST de sincronización offline — siempre necesita red
    if (request.method === 'POST' && url.pathname.includes('/sync')) {
      event.respondWith(networkOnlyWithOfflineQueue(request));
      return;
    }

    // GET de API con datos cacheables — network-first
    const isCacheable = CACHEABLE_API_PATTERNS.some((p) => p.test(url.pathname));
    if (isCacheable) {
      event.respondWith(networkFirstWithCache(request, API_CACHE, 300)); // TTL 5 min
      return;
    }

    // Otras llamadas API — network only (agendar cita, pagar, etc.)
    return;
  }

  // Assets estáticos — cache first
  if (
    url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/) ||
    url.pathname.startsWith('/_next/')
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Páginas — network first con fallback a caché
  event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE, 3600));
});

// ─── Estrategia: Network First con caché ─────────────────
async function networkFirstWithCache(request, cacheName, maxAgeSeconds) {
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(cacheName);
      // Agregar header de timestamp para TTL
      const responseToCache = response.clone();
      cache.put(request, addTimestampHeader(responseToCache));
    }
    return response;
  } catch (err) {
    // Sin red — buscar en caché
    const cached = await getCachedIfFresh(request, cacheName, maxAgeSeconds);
    if (cached) {
      console.log('[SW] Sirviendo desde caché:', request.url);
      return cached;
    }

    // Si es una página HTML — mostrar página offline
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/offline');
    }

    throw err;
  }
}

// ─── Estrategia: Cache First ─────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Asset no disponible offline', { status: 503 });
  }
}

// ─── Cola de operaciones offline (Background Sync) ────────
async function networkOnlyWithOfflineQueue(request) {
  try {
    return await fetch(request);
  } catch (err) {
    // Encolar para Background Sync
    if ('SyncManager' in self) {
      await self.registration.sync.register('offline-sync-queue');
    }
    return new Response(JSON.stringify({ queued: true, message: 'Sincronizará cuando haya conexión' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Background Sync ─────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-sync-queue') {
    event.waitUntil(processOfflineQueue());
  }
});

async function processOfflineQueue() {
  // Notificar a los clientes para que ejecuten el sync
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'BACKGROUND_SYNC', action: 'PROCESS_QUEUE' });
  }
}

// ─── Push Notifications ──────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.tag ?? 'sgci-notif',
    requireInteraction: data.requireInteraction ?? false,
    data: { url: data.url ?? '/dashboard' },
    actions: data.actions ?? [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.registration.scope));
      if (existing) {
        existing.focus();
        existing.navigate(url);
      } else {
        self.clients.openWindow(url);
      }
    }),
  );
});

// ─── Helpers ────────────────────────────────────────────
function addTimestampHeader(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cached-at', Date.now().toString());
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function getCachedIfFresh(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (!cached) return null;

  const cachedAt = cached.headers.get('sw-cached-at');
  if (!cachedAt) return cached; // Sin timestamp — servir igual

  const age = (Date.now() - parseInt(cachedAt)) / 1000;
  if (age > maxAgeSeconds) {
    console.log(`[SW] Caché expirado (${Math.round(age)}s > ${maxAgeSeconds}s):`, request.url);
    return null;
  }

  return cached;
}
