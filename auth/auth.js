const widget = document.getElementById('telegramWidget');
const hint = document.getElementById('hint');
const sticker = document.getElementById('authSticker');

const TELEGRAM_BOT_USERNAME = 'glnt_auth_bot';
const API_ORIGIN = 'https://api.galenite.ru';
const ALLOWED_RETURN_ORIGINS = new Set([
  window.location.origin,
  'https://operator.galenite.ru',
  'https://health.galenite.ru',
]);

requestAnimationFrame(() => {
  document.documentElement.classList.add('loaded');
});

function setHint(text = '', isError = false) {
  if (!hint) return;
  hint.textContent = text;
  hint.classList.toggle('error', isError);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeReturnUrl(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value, window.location.origin);
    if (!ALLOWED_RETURN_ORIGINS.has(parsed.origin)) return null;
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') return null;
    return parsed.origin === window.location.origin
      ? parsed.pathname + parsed.search + parsed.hash
      : parsed.href;
  } catch {
    return null;
  }
}

function getReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = normalizeReturnUrl(params.get('return') || params.get('next'));
  if (fromQuery) {
    sessionStorage.setItem('glnt_auth_return', fromQuery);
    return fromQuery;
  }

  const saved = normalizeReturnUrl(sessionStorage.getItem('glnt_auth_return'));
  if (saved) return saved;

  try {
    const fromReferrer = normalizeReturnUrl(document.referrer);
    if (fromReferrer && !String(fromReferrer).includes('/auth')) return fromReferrer;
  } catch {}

  return '/';
}

function saveUser(user) {
  if (!user) return;
  localStorage.setItem('glnt_user', JSON.stringify(user));
  localStorage.setItem('glnt_logged_in', 'true');
}

function saveAccountCompatibility(account) {
  if (!account) return;
  saveUser({
    id: account.telegramUserId || account.id,
    first_name: account.firstName || 'Telegram',
    last_name: account.lastName || '',
    username: account.username || '',
    photo_url: account.photoUrl || '',
  });
}

function redirectAfterLogin() {
  const target = getReturnUrl();
  sessionStorage.removeItem('glnt_auth_return');
  window.location.href = target;
}

async function loadScript(src) {
  if (window.lottie?.loadAnimation) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    const timeoutId = window.setTimeout(() => reject(new Error('Lottie timeout')), 8000);
    script.onload = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error('Lottie load failed'));
    };
    document.head.appendChild(script);
  });
}

async function renderSticker() {
  if (!sticker) return;

  try {
    const jsonResponse = await fetchWithTimeout('./images/auth.json?v=20260807_1', { cache: 'no-store' }, 4000);
    const contentType = jsonResponse.headers.get('content-type') || '';
    if (jsonResponse.ok && contentType.includes('application/json')) {
      const animationData = await jsonResponse.json();
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.13.0/lottie.min.js');
      if (window.lottie?.loadAnimation) {
        sticker.replaceChildren();
        window.lottie.loadAnimation({
          container: sticker,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData,
        });
        sticker.dataset.format = 'lottie';
        return;
      }
    }
  } catch {}

  try {
    const svgResponse = await fetchWithTimeout('./images/auth.svg?v=20260807_1', {
      method: 'HEAD',
      cache: 'no-store',
    }, 3500);
    if (svgResponse.ok) {
      const image = document.createElement('img');
      image.src = './images/auth.svg?v=20260807_1';
      image.alt = 'Galenite Auth';
      sticker.replaceChildren(image);
      sticker.dataset.format = 'svg';
      return;
    }
  } catch {}

  const image = document.createElement('img');
  image.src = './images/auth.png';
  image.alt = 'Galenite Auth';
  sticker.replaceChildren(image);
  sticker.dataset.format = 'gif-fallback';
}

function renderWidget() {
  if (!widget || widget.querySelector('iframe, script')) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-radius', '17');
  script.setAttribute('data-userpic', 'false');
  script.setAttribute('data-request-access', 'write');
  script.setAttribute('data-lang', 'ru');
  script.setAttribute('data-onauth', 'onTelegramAuth(user)');
  widget.appendChild(script);
}

window.onTelegramAuth = async function onTelegramAuth(user) {
  try {
    setHint('Авторизация…');
    const response = await fetchWithTimeout(`${API_ORIGIN}/api/auth/telegram`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(user || {}),
    });

    if (!response.ok) {
      setHint(
        response.status === 503
          ? 'Сервер Galenite Auth пока не настроен.'
          : 'Не удалось подтвердить вход через Telegram.',
        true,
      );
      return;
    }

    const payload = await response.json().catch(() => ({}));
    saveAccountCompatibility(payload.account);
    setHint('Готово.');
    window.setTimeout(redirectAfterLogin, 220);
  } catch (error) {
    console.error(error);
    setHint('Ошибка сети при авторизации Telegram.', true);
  }
};

async function init() {
  getReturnUrl();
  void renderSticker();

  try {
    const response = await fetchWithTimeout(`${API_ORIGIN}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
    if (response.ok) {
      const payload = await response.json().catch(() => ({}));
      saveAccountCompatibility(payload.account);
      redirectAfterLogin();
      return;
    }
  } catch {
    // The login widget remains a usable fallback when the session check fails.
  }

  renderWidget();
}

void init();
