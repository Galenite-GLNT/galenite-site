import { getQueryParam } from '/shared/utils.js';
import { apiFetch } from '/shared/config.js';

const widget = document.getElementById('telegramWidget');
const hint = document.getElementById('hint');

function setHint(text = '') {
  hint.textContent = text;
}

function renderWidget(botUsername) {
  widget.innerHTML = '';
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  script.setAttribute('data-telegram-login', botUsername);
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-userpic', 'false');
  script.setAttribute('data-onauth', 'onTelegramAuth(user)');
  script.setAttribute('data-request-access', 'write');
  widget.appendChild(script);
}

async function redirectToTarget() {
  const returnTo = getQueryParam('return') || '/health/';
  window.location.href = returnTo;
}

window.onTelegramAuth = async function onTelegramAuth(user) {
  const response = await apiFetch('/api/auth/telegram', {
    method: 'POST',
    body: JSON.stringify(user),
  });

  if (!response.ok) {
    setHint('Не удалось авторизоваться через Telegram.');
    return;
  }

  await redirectToTarget();
};

async function init() {
  const meResponse = await apiFetch('/api/auth/me', { method: 'GET' });
  if (meResponse.ok) {
    await redirectToTarget();
    return;
  }

  const pingResponse = await apiFetch('/api/ping', { method: 'GET' });
  if (!pingResponse.ok) {
    setHint('Worker API недоступен.');
    return;
  }

  const ping = await pingResponse.json();
  const username = ping.telegram_bot_username || 'glnt_auth_bot';
  renderWidget(username);
}

init().catch(() => setHint('Ошибка инициализации авторизации.'));
