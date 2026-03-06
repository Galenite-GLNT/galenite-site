import { getQueryParam } from '/shared/utils.js?v=20260306_4';

const widget = document.getElementById('telegramWidget');
const hint = document.getElementById('hint');
const TELEGRAM_BOT_USERNAME = 'glnt_auth_bot';
const API_BASE_URL = 'https://galenite.ilyasch2020.workers.dev';

requestAnimationFrame(() => {
  document.documentElement.classList.add('loaded');
});

function setHint(text = '') {
  if (hint) hint.textContent = text;
}

function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const sid = localStorage.getItem('glnt_session_id');
  if (!sid || !normalizedPath.startsWith('/api/auth/')) return `${API_BASE_URL}${normalizedPath}`;
  const [pathname, query = ''] = normalizedPath.split('?');
  const params = new URLSearchParams(query);
  params.set('session_id', sid);
  return `${API_BASE_URL}${pathname}?${params.toString()}`;
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

async function postTelegramAuth(user) {
  const body = new URLSearchParams();
  Object.entries(user || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) body.set(k, String(v));
  });

  return fetch(apiUrl('/api/auth/telegram'), {
    method: 'POST',
    credentials: 'include',
    body,
  });
}

window.onTelegramAuth = async function onTelegramAuth(user) {
  try {
    let response = await postTelegramAuth(user);

    if (!response.ok) {
      // fallback: GET with query params, avoids preflight in stricter environments
      const qs = new URLSearchParams();
      Object.entries(user || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      });
      response = await fetch(`${apiUrl('/api/auth/telegram')}&${qs.toString()}`.replace('?&', '?'), {
        method: 'GET',
        credentials: 'include',
      });
    }

    if (!response.ok) {
      console.error('Telegram login failed', response.status);
      setHint(`Не удалось авторизоваться через Telegram (${response.status}).`);
      return;
    }

    const payload = await response.json().catch(() => ({}));
    if (payload.session_id) {
      localStorage.setItem('glnt_session_id', payload.session_id);
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
    const meResponse = await fetch(apiUrl('/api/auth/me'), {
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
