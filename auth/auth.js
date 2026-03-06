import { apiFetch } from '/shared/config.js?v=20260306_5';
import { getQueryParam } from '/shared/utils.js?v=20260306_5';

const widget = document.getElementById('telegramWidget');
const hint = document.getElementById('hint');
const TELEGRAM_BOT_USERNAME = 'glnt_auth_bot';

requestAnimationFrame(() => {
  document.documentElement.classList.add('loaded');
});

function setHint(text = '') {
  if (hint) hint.textContent = text;
}

function redirectToTarget() {
  const returnTo = getQueryParam('return') || '/health/';
  window.location.href = returnTo;
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

window.onTelegramAuth = async function onTelegramAuth(user) {
  try {
    const response = await apiFetch('/api/auth/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(user || {}),
    });

    if (!response.ok) {
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
    const meResponse = await apiFetch('/api/auth/me', { method: 'GET' });
    if (meResponse.ok) {
      redirectToTarget();
    }
  } catch {
    setHint('API временно недоступен. Попробуйте снова.');
  }
}

init();
