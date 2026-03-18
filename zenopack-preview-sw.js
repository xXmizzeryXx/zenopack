const fileStore = new Map();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('message', e => {
  const { type, gameId, filesMeta, buffers } = e.data || {};
  const port = e.ports[0];

  if (type === 'REGISTER') {
    if (!gameId || !filesMeta || !buffers) { port?.postMessage({ type: 'ERROR' }); return; }
    filesMeta.forEach((meta, i) => {
      fileStore.set(`/zenopack-preview/${gameId}/${meta.path}`, { buffer: buffers[i], mimeType: meta.mimeType });
    });
    port?.postMessage({ type: 'REGISTERED', gameId });

  } else if (type === 'UNREGISTER') {
    const prefix = `/zenopack-preview/${gameId}/`;
    for (const key of [...fileStore.keys()]) {
      if (key.startsWith(prefix)) fileStore.delete(key);
    }
    port?.postMessage({ type: 'UNREGISTERED', gameId });

  } else if (type === 'CLEAR') {
    fileStore.clear();
    port?.postMessage({ type: 'CLEARED' });
  }
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (!url.pathname.startsWith('/zenopack-preview/')) return;
  e.respondWith(serve(url.pathname));
});

function serve(path) {
  if (fileStore.has(path)) {
    const { buffer, mimeType } = fileStore.get(path);
    return new Response(buffer, { status: 200, headers: { 'Content-Type': mimeType, 'Cache-Control': 'no-store' } });
  }
  const parts = path.split('/');
  if (parts.length >= 3) {
    const fallback = `/zenopack-preview/${parts[2]}/index.html`;
    if (fileStore.has(fallback)) {
      const { buffer, mimeType } = fileStore.get(fallback);
      return new Response(buffer, { status: 200, headers: { 'Content-Type': mimeType, 'Cache-Control': 'no-store' } });
    }
  }
  return new Response('404', { status: 404 });
}
