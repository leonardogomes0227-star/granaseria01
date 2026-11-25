// Service worker simples: deixa o app abrir rápido e funcionar sem rede, mas NUNCA segura uma versão velha.
// Páginas, ícones e logos: sempre a rede primeiro (a cópia guardada só serve se estiver sem internet).
// Arquivos com hash em /assets/ nunca mudam de conteúdo, então esses vêm direto da cópia. NUNCA mexe em /api.
const VERSAO = 'gs-v5';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(['/'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
        return res;
      }))
    );
    return;
  }
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok && req.mode !== 'navigate' && /\.(png|svg|ico|webmanifest)$/.test(url.pathname)) { const copia = res.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
  );
});
