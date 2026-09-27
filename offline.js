(() => {
  const $ = id => document.getElementById(id);
  const button = $('btn-offline'), status = $('offline-status'), progress = $('offline-progress');
  if (!button) return;
  let registration = null, busy = false, ready = false, failure = '', mode = 'download';
  const watched = new WeakSet();
  const scope = new URL('./', location.href).href;
  const supported = ['https:', 'http:'].includes(location.protocol) && window.isSecureContext && 'serviceWorker' in navigator && 'caches' in window;
  const sizeText = bytes => `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
  async function getInfo() {
    let response;
    try { response = await fetch(new URL('offline-info.json', scope), {cache:'no-store'}); }
    catch { throw new Error('info-unreachable'); }
    if (!response.ok) throw new Error(`info-http-${response.status}`);
    let info;
    try { info = await response.json(); } catch { throw new Error('info-invalid'); }
    if (!info || !Number.isFinite(info.bytes) || info.bytes <= 0 || typeof info.version !== 'string') throw new Error('info-invalid');
    return info;
  }
  function explainError(error) {
    if (error.message === 'space') return 'Для скачивания не хватает свободного места. Освободите память и повторите.';
    if (error.message.startsWith('info-http-')) return `Сервер не выдал описание офлайн-пакета (HTTP ${error.message.slice(10)}). Возможно, обновление сайта опубликовано не полностью. Попробуйте позже или сообщите автору.`;
    if (error.message === 'info-invalid') return 'Вместо описания офлайн-пакета сервер вернул другой файл. Нужно проверить настройку сайта или завершить публикацию обновления.';
    if (error.message === 'info-unreachable') return 'Не удалось получить описание офлайн-пакета. Проверьте, что сайт открыт по рабочему HTTP(S)-адресу и доступен с интернетом.';
    if (error.name === 'SecurityError' || error.name === 'NotAllowedError') return 'Браузер запретил сохранение сайта. Откройте PilotSpace в обычной вкладке по HTTPS и проверьте разрешение на хранение данных сайта.';
    return 'Не удалось включить офлайн-режим. Проверьте доступность сайта; если ошибка повторится, сообщите автору адрес страницы и браузер.';
  }
  function connection() {
    $('offline-connection').textContent = navigator.onLine ? '' : 'Нет подключения к сети';
    $('offline-connection').hidden = navigator.onLine;
  }
  function setButton(text, action, disabled = false) {
    button.textContent = text; mode = action; button.disabled = disabled;
  }
  function ask(worker, type) {
    return new Promise((resolve,reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {channel.port1.close(); reject(new Error('timeout'));}, type === 'REPAIR' ? 180000 : 10000);
      channel.port1.onmessage = event => {clearTimeout(timer); channel.port1.close(); resolve(event.data);};
      worker.postMessage({type}, [channel.port2]);
    });
  }
  async function refresh() {
    if (busy) return;
    progress.hidden = true;
    if (registration?.waiting) {
      status.textContent = 'Обновление скачано. После тренировки закройте все вкладки и окна PilotSpace, затем откройте сайт снова. До этого работает прежняя версия.';
      setButton('Обновление готово', 'waiting', true);
      return;
    }
    if (registration?.installing) {watch(registration.installing); return;}
    if (registration?.active) {
      try {
        const data = await ask(registration.active, 'STATUS');
        ready = data.complete;
        window.dispatchEvent(new CustomEvent('pilotspace-offline-ready', {detail: ready}));
        if (ready) {
          $('offline-size').textContent = sizeText(data.bytes);
          const controlled = !!navigator.serviceWorker.controller;
          status.textContent = controlled
            ? 'Готово: вопросы и изображения сохранены в этом браузере. Можно тренироваться без сети.'
            : 'Материалы скачаны. Откройте сохранённую версию кнопкой ниже — незавершённую тренировку можно будет продолжить.';
          setButton(controlled ? 'Проверить обновления' : 'Открыть офлайн-версию', controlled ? 'update' : 'reload', controlled && !navigator.onLine);
          if (failure) status.textContent += ' ' + failure;
          return;
        }
      } catch { ready = false; window.dispatchEvent(new CustomEvent('pilotspace-offline-ready', {detail: false})); }
      status.textContent = failure || 'Скачанная копия неполная или браузер очистил её. Скачайте материалы повторно перед поездкой.';
      setButton('Скачать повторно', 'repair', !navigator.onLine);
      return;
    }
    status.textContent = failure || 'Один раз скачайте материалы с интернетом. Потом открывайте PilotSpace по привычному адресу.';
    setButton('Скачать для офлайн', 'download', !navigator.onLine);
  }
  function watch(worker) {
    if (watched.has(worker)) return;
    watched.add(worker);
    busy = true; progress.hidden = false; progress.removeAttribute('value');
    setButton('Скачиваю материалы…', 'download', true);
    status.textContent = 'Сохраняю вопросы и изображения. Дождитесь подтверждения готовности.';
    worker.addEventListener('statechange', () => {
      if (['installed','activated','redundant'].includes(worker.state)) {
        busy = false;
        if (worker.state === 'redundant' && !failure) failure = 'Не удалось скачать пакет полностью. Проверьте связь и свободное место, затем повторите.';
        refresh();
      }
    });
  }
  function observe(reg) {
    registration = reg;
    reg.addEventListener('updatefound', () => {if (reg.installing) watch(reg.installing);});
    if (reg.installing) watch(reg.installing);
  }
  connection();
  window.addEventListener('online', () => {connection(); refresh();});
  window.addEventListener('offline', () => {connection(); refresh();});
  if (!supported) {
    status.textContent = location.protocol === 'file:'
      ? 'Сейчас открыт файл с компьютера. Чтобы скачать офлайн-пакет, откройте PilotSpace по HTTPS или через локальный сервер (localhost). Из файла эта функция не работает.'
      : 'Скачивание доступно при открытии сайта по HTTPS в браузере с поддержкой офлайн-режима. Для локальной проверки используйте localhost.';
    setButton('Офлайн недоступен', 'unsupported', true);
    return;
  }
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.app !== 'pilotspace-offline') return;
    if (event.data.type === 'progress') {
      busy = true; progress.hidden = false; progress.max = event.data.total; progress.value = event.data.loaded;
      setButton('Скачиваю материалы…', 'download', true);
      status.textContent = `Скачано ${sizeText(event.data.loaded)} из ${sizeText(event.data.total)}.`;
    }
    if (event.data.type === 'failure') {
      failure = event.data.reason === 'quota' ? 'Не хватило места. Освободите память устройства и попробуйте снова.'
        : event.data.reason === 'version' ? 'Файлы сайта обновляются. Повторите скачивание через несколько минут.'
          : 'Скачивание прервалось. Проверьте связь и повторите попытку.';
      busy = false; refresh();
    }
  });
  button.addEventListener('click', async () => {
    if (busy) return;
    if (mode === 'reload') {location.reload(); return;}
    failure = ''; busy = true; button.disabled = true;
    try {
      if (mode === 'download') {
        const info = await getInfo();
        const estimate = await navigator.storage?.estimate?.().catch(() => null);
        if (estimate?.quota && estimate.quota - estimate.usage < info.bytes * 1.2) throw new Error('space');
        observe(await navigator.serviceWorker.register('sw.js', {scope:'./', updateViaCache:'none'}));
      } else if (mode === 'repair') {
        await registration.update();
        if (!registration.installing && !registration.waiting) await ask(registration.active, 'REPAIR');
      } else if (mode === 'update') {
        status.textContent = 'Проверяю обновления…';
        await registration.update();
      }
    } catch (error) {
      failure = explainError(error);
    } finally {
      busy = !!registration?.installing;
      if (!busy) await refresh();
    }
  });
  // Do not register automatically: the first full download needs an explicit click.
  navigator.serviceWorker.getRegistration(scope).then(reg => {
    if (reg && reg.scope === scope) observe(reg);
    return refresh();
  }).catch(() => {failure = 'Браузер не разрешил сохранить офлайн-копию.'; refresh();});
  getInfo().then(info => {
    if (info) $('offline-size').textContent = sizeText(info.bytes);
  }).catch(() => {});
})();
