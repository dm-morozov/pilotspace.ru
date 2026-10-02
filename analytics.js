(() => {
  // Only the public site contributes statistics; offline and local previews stay independent.
  if (window.pilotspaceAnalytics || location.protocol !== 'https:' || !['pilotspace.ru', 'www.pilotspace.ru'].includes(location.hostname) || !navigator.onLine) return;
  const id = 113331527, url = 'https://mc.yandex.ru/metrika/tag.js?id=113331527';
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = window.ym.l || Date.now();
  if (![...document.scripts].some(script => script.src === url)) {
    const script = document.createElement('script'); script.async = true; script.src = url;
    document.head.append(script);
  }
  window.ym(id, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:'dataLayer', referrer:document.referrer, url:location.href, accurateTrackBounce:true, trackLinks:true});
  const goals = new Set(['training_start', 'training_complete', 'lesson_open', 'offline_download_start', 'offline_download_complete']);
  let downloadPending = false;
  window.pilotspaceAnalytics = (goal) => {
    if (!navigator.onLine || !goals.has(goal)) return;
    if (goal === 'offline_download_start') downloadPending = true;
    try { window.ym(id, 'reachGoal', goal); } catch { /* Analytics must never interrupt training. */ }
  };
  window.addEventListener('pilotspace-offline-ready', event => {
    if (event.detail === true && downloadPending) { downloadPending = false; window.pilotspaceAnalytics('offline_download_complete'); }
  });
  if (/^\/lessons\/[^/]+\.html$/.test(location.pathname)) window.pilotspaceAnalytics('lesson_open');
})();
