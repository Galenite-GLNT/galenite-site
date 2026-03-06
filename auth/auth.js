import { getQueryParam } from '/shared/utils.js';

const widget = document.getElementById('telegramWidget');
const hint = document.getElementById('hint');
const TELEGRAM_BOT_USERNAME = 'glnt_auth_bot';
const API_BASE_URL = String(window.API_BASE_URL || 'https://galenite.ilyasch2020.workers.dev').replace(/\/$/, '');

requestAnimationFrame(() => {
  document.documentElement.classList.add('loaded');
});

function setHint(text = '') {
  if (hint) hint.textContent = text;
}

function authUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function renderWidget() {
  if (!widget) return;
  widget.innerHTML = '';
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-userpic', 'false');
  script.setAttribute('data-request-access', 'write');
  script.setAttribute('data-onauth', 'onTelegramAuth(user)');
  widget.appendChild(script);
}

function redirectToTarget() {
  const returnTo = getQueryParam('return') || '/health/';
  window.location.href = returnTo;
}

window.onTelegramAuth = async function onTelegramAuth(user) {
  try {
    const response = await fetch(authUrl('/api/auth/telegram'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(user),
    });

    if (!response.ok) {
      console.error('Telegram login failed', response.status);
      setHint('Не удалось авторизоваться через Telegram.');
      return;
    }

    redirectToTarget();
  } catch (error) {
    console.error(error);
    setHint('Ошибка сети при авторизации Telegram.');
  }
};

async function init() {
  renderWidget();

  try {
    const meResponse = await fetch(authUrl('/api/auth/me'), {
      credentials: 'include',
    });
    if (meResponse.ok) {
      redirectToTarget();
    }
  } catch {
    setHint('API временно недоступен. Попробуйте снова.');
  }
}

init();
