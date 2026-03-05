import { getQueryParam } from '/shared/utils.js';

const widget = document.getElementById('telegramWidget');
const hint = document.getElementById('hint');

function setHint(text) {
  hint.textContent = text || '';
}

function scriptWidget(botUsername, redirectUrl) {
  widget.innerHTML = '';
  const script = document.createElement('script');
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  script.async = true;
  script.setAttribute('data-telegram-login', botUsername);
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-userpic', 'false');
  script.setAttribute('data-auth-url', redirectUrl || `${window.location.origin}/auth/`);
  script.setAttribute('data-request-access', 'write');
  widget.appendChild(script);
}

async function init() {
  const me = await fetch('/api/auth/me').then((r) => r.json());
  if (me.user) {
    const returnTo = getQueryParam('return') || '/health/';
    window.location.href = returnTo;
    return;
  }

  try {
    const cfg = await fetch('/api/config').then((r) => r.json());
    if (!cfg.telegramBotUsername) {
      setHint('Не задан TELEGRAM_BOT_USERNAME на сервере.');
      return;
    }
    scriptWidget(cfg.telegramBotUsername, cfg.telegramAuthRedirectUrl);
  } catch {
    setHint('Не удалось загрузить конфиг авторизации.');
  }
}

// Callback mode: Telegram can redirect with query params
async function maybeHandleTelegramCallback() {
  const id = getQueryParam('id');
  const hash = getQueryParam('hash');
  if (!id || !hash) return;

  const payload = Object.fromEntries(new URLSearchParams(window.location.search).entries());
  const resp = await fetch('/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    setHint('Telegram авторизация не прошла валидацию.');
    return;
  }

  const returnTo = getQueryParam('return') || '/health/';
  window.location.href = returnTo;
}

maybeHandleTelegramCallback().then(init);
