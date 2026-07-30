// Service worker mínimo pra habilitar instalação PWA (iOS + Android).
// Regina 30/07: NÃO cachear rotas de app — o sistema é dinâmico com dados
// sensíveis e mudança de plano/status precisa aparecer na hora. Só cacheia
// assets estáticos versionados pelo Next (que já mudam de URL a cada build,
// então não gera problema de "atualização não veio").

const CACHE_VERSION = "cp-system-v1";
const ASSET_PREFIX = "/_next/static/";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first só pros assets estáticos versionados do Next
  if (url.pathname.startsWith(ASSET_PREFIX)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(req).then(
          (cached) =>
            cached ||
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }
  // Todo o resto vai pra rede sempre (sem cache offline pra evitar dado stale)
});
