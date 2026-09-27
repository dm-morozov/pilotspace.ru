/* Generated as sw.js by build_offline.cjs. Do not register this template. */
const BUNDLE = /* OFFLINE_BUNDLE */;
const PREFIX = 'pilotspace-offline-';
const CACHE = PREFIX + BUNDLE.version;
const assetURL = relative => new URL(relative, self.registration.scope).href;
const assetMap = new Map(BUNDLE.assets.map(asset => [assetURL(asset.url), asset]));
const infoURL = assetURL('offline-info.json');
let preparing = null;

async function notify(data) {
  const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
  for (const client of clients) if (client.url.startsWith(self.registration.scope)) client.postMessage({app:'pilotspace-offline', ...data});
}

async function prepare(cleanupOnFailure) {
  const cache = await caches.open(CACHE);
  let loaded = 0;
  try {
    // Sequential downloads limit memory use on phones. Every file must match the release.
    for (const asset of BUNDLE.assets) {
      const response = await fetch(assetURL(asset.url), {cache:'no-store', credentials:'same-origin'});
      if (!response.ok || response.redirected) throw new Error('download');
      // Git may normalize Windows line endings when publishing to GitHub Pages.
      const bytes = asset.text
        ? new TextEncoder().encode((await response.clone().text()).replace(/\r\n/g, '\n'))
        : await response.clone().arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
      if (hash !== asset.sha256) throw new Error('version');
      await cache.put(assetURL(asset.url), response);
      loaded += asset.bytes;
      await notify({type:'progress', loaded, total:BUNDLE.bytes});
    }
  } catch (error) {
    // The old version has its own cache and remains usable if an update fails.
    if (cleanupOnFailure) await caches.delete(CACHE);
    await notify({type:'failure', reason:error.name === 'QuotaExceededError' ? 'quota' : error.message});
    throw error;
  }
}

function download(cleanupOnFailure = true) {
  if (!preparing) preparing = prepare(cleanupOnFailure).finally(() => { preparing = null; });
  return preparing;
}

self.addEventListener('install', event => event.waitUntil(download()));
// No skipWaiting/claim: never switch the version beneath an open training tab.
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
})()));

async function complete() {
  const cache = await caches.open(CACHE);
  const urls = new Set((await cache.keys()).map(request => request.url));
  return BUNDLE.assets.every(asset => urls.has(assetURL(asset.url)));
}

self.addEventListener('message', event => {
  if (event.data?.type !== 'STATUS' && event.data?.type !== 'REPAIR') return;
  event.waitUntil((async () => {
    try {
      if (event.data.type === 'REPAIR') await download(false);
      event.ports[0]?.postMessage({complete:await complete(), version:BUNDLE.version, bytes:BUNDLE.bytes});
    } catch { event.ports[0]?.postMessage({complete:false}); }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  url.search = ''; url.hash = '';
  if (url.href === self.registration.scope) url.pathname += 'index.html';
  if (url.href === infoURL) {
    event.respondWith(Promise.resolve(new Response(JSON.stringify({version:BUNDLE.version,bytes:BUNDLE.bytes,files:BUNDLE.files}), {headers:{'Content-Type':'application/json'}})));
    return;
  }
  if (assetMap.has(url.href)) {
    event.respondWith((async () => {
      const cached = await (await caches.open(CACHE)).match(url.href);
      return cached || fetch(request);
    })());
  } else if (request.mode === 'navigate' && url.pathname.toLowerCase().endsWith('.pdf')) {
    // The full source PDF is deliberately not part of the offline download.
    event.respondWith(fetch(request).catch(() => new Response(
      '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PDF доступен с интернетом — PilotSpace</title><body style="font:18px/1.6 system-ui;max-width:36em;margin:10vh auto;padding:24px"><h1>Для открытия PDF нужен интернет</h1><p>Вопросы и изображения доступны в скачанном тренажёре. Полный исходный документ откроется, когда появится связь.</p><a href="./">Вернуться к тренировкам</a></body></html>',
      {status:503, headers:{'Content-Type':'text/html; charset=utf-8'}})));
  }
});
