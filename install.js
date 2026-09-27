(() => {
  const panel = document.getElementById('install-panel');
  if (!panel || !window.isSecureContext || location.protocol === 'file:') return;
  const button = document.getElementById('btn-install');
  const hint = document.getElementById('install-hint');
  const offer = document.getElementById('install-offer');
  const help = document.getElementById('install-help');
  const display = window.matchMedia('(display-mode: standalone)');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const key = 'pilotspace-install-dismissed-until';
  let pending = null, installed = false, ready = false, busy = false, dismissedUntil = 0;
  try { dismissedUntil = Number(localStorage.getItem(key)) || 0; } catch {}
  function render() {
    panel.hidden = installed || display.matches || navigator.standalone === true;
    offer.hidden = panel.hidden || !ready || Date.now() < dismissedUntil;
    button.textContent = pending ? 'Установить PilotSpace' : ios ? 'Добавить на главный экран' : 'Как установить PilotSpace';
    button.disabled = busy;
    hint.textContent = ios
      ? 'На iPhone и iPad откройте сайт в Safari: «Поделиться» → «На экран “Домой”» → «Добавить». Если есть переключатель «Открывать как веб-приложение», оставьте его включённым.'
      : 'Откройте меню браузера и найдите «Установить приложение» или «Добавить на главный экран». На компьютере также может быть значок установки в адресной строке. Если этих пунктов нет, откройте сайт в Chrome или Edge. Во встроенном браузере мессенджера сначала выберите «Открыть в браузере».';
  }
  function dismiss() {
    dismissedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
    try { localStorage.setItem(key, String(dismissedUntil)); } catch {}
    render();
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); // Keep installation user-initiated, outside the training screen.
    pending = event;
    render();
  });
  window.addEventListener('appinstalled', () => { installed = true; pending = null; render(); });
  window.addEventListener('pilotspace-offline-ready', event => { ready = event.detail === true; render(); });
  display.addEventListener('change', render);
  document.getElementById('btn-dismiss-install').addEventListener('click', dismiss);
  button.addEventListener('click', async () => {
    if (!pending) { help.hidden = !help.hidden; button.setAttribute('aria-expanded', String(!help.hidden)); return; }
    const prompt = pending;
    busy = true; render();
    try {
      await prompt.prompt();
      await prompt.userChoice;
      dismiss();
    } catch {
      help.hidden = false;
      button.setAttribute('aria-expanded', 'true');
    } finally {
      pending = null; busy = false;
      // The actual appinstalled event, not accepting the dialog, confirms installation.
      render();
    }
  });
  render();
})();
