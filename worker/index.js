const devSessionStore = new Map();

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

export function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, chunk) => {
    const [k, ...rest] = chunk.trim().split('=');
    if (!k) return acc;
    acc[k] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

export function setCookie(name, value, { maxAge = 1209600, secure = true, path = '/', httpOnly = true, sameSite = 'Lax' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `Max-Age=${maxAge}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(name, { secure = true, path = '/' } = {}) {
  return setCookie(name, '', { maxAge: 0, secure, path });
}

function timingSafeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function uint8ToHex(buffer) {
  return [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function sha256Bytes(value) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
}

async function hmacSha256Hex(message, keyBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return uint8ToHex(signature);
}

export async function verifyTelegramLogin(payload, botToken, maxAgeSeconds = 86400) {
  const { hash, ...rest } = payload || {};
  if (!hash || !botToken) return false;

  const dataCheckString = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = await sha256Bytes(botToken);
  const computedHash = await hmacSha256Hex(dataCheckString, secretKey);
  if (!timingSafeEqualHex(String(hash).toLowerCase(), computedHash.toLowerCase())) return false;

  const authDate = Number(rest.auth_date);
  if (!Number.isFinite(authDate)) return false;
  const now = Math.floor(Date.now() / 1000);
  return now - authDate <= Number(maxAgeSeconds || 86400);
}

function buildCorsHeaders(origin, env) {
  const configured = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const defaults = ['https://galenite.ru', 'https://www.galenite.ru', 'https://galenite.ilyasch2020.workers.dev'];
  const allowed = [...new Set([...configured, ...defaults])];

  if (!origin) return {};
  const allowAny = allowed.includes('*');
  const isAllowed = allowAny || allowed.includes(origin);
  if (!isAllowed) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    Vary: 'Origin',
  };
}

async function createSession(env, user) {
  const sessionId = crypto.randomUUID();
  const ttl = 60 * 60 * 24 * 14;
  const payload = JSON.stringify({ user, expires_at: Date.now() + ttl * 1000 });
  if (env.SESSIONS) await env.SESSIONS.put(sessionId, payload, { expirationTtl: ttl });
  else devSessionStore.set(sessionId, payload);
  return { sessionId, ttl };
}

async function getSession(env, sessionId) {
  if (!sessionId) return null;
  const raw = env.SESSIONS ? await env.SESSIONS.get(sessionId) : devSessionStore.get(sessionId);
  if (!raw) return null;
  const session = JSON.parse(raw);
  if (session.expires_at < Date.now()) {
    if (env.SESSIONS) await env.SESSIONS.delete(sessionId);
    else devSessionStore.delete(sessionId);
    return null;
  }
  return session;
}

async function deleteSession(env, sessionId) {
  if (!sessionId) return;
  if (env.SESSIONS) await env.SESSIONS.delete(sessionId);
  else devSessionStore.delete(sessionId);
}

function getApiBase(env) {
  return (env.OPENFOODFACTS_BASE_URL || 'https://world.openfoodfacts.net').replace(/\/$/, '');
}

function normalizeOffProduct(p) {
  return {
    name: p.product_name || p.product_name_en || 'Unknown',
    brand: p.brands || '',
    image: p.image_front_small_url || p.image_front_url || '',
    calories_100g: Number(p.nutriments?.['energy-kcal_100g']) || 0,
    protein_100g: Number(p.nutriments?.proteins_100g) || 0,
    fat_100g: Number(p.nutriments?.fat_100g) || 0,
    carbs_100g: Number(p.nutriments?.carbohydrates_100g) || 0,
    barcode: p.code || '',
  };
}

function getSessionIdFromRequest(request, url) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  return cookies.glnt_session || url.searchParams.get('session_id') || '';
}

async function handleFoodSearch(url, env) {
  const q = url.searchParams.get('q')?.trim();
  if (!q) return json({ items: [] });
  const offUrl = `${getApiBase(env)}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&json=1&page_size=20`;
  const resp = await fetch(offUrl, { headers: { 'User-Agent': 'galenite-worker/1.0' } });
  if (!resp.ok) return json({ error: 'OpenFoodFacts unavailable' }, 502);
  const data = await resp.json();
  const items = (data.products || []).map(normalizeOffProduct).filter((i) => i.name && i.name !== 'Unknown');
  return json({ items });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = buildCorsHeaders(request.headers.get('Origin'), env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    if (url.pathname === '/api/ping' && request.method === 'GET') {
      return json({ ok: true, service: 'galenite-worker-api', telegram_bot_username: env.TELEGRAM_BOT_USERNAME || '' }, 200, corsHeaders);
    }

    if (url.pathname === '/api/food/search' && request.method === 'GET') {
      const res = await handleFoodSearch(url, env);
      Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    if (url.pathname === '/api/auth/telegram' && request.method === 'POST') {
      const payload = await request.json();
      const valid = await verifyTelegramLogin(payload, env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_AUTH_MAX_AGE_SECONDS || '86400');
      if (!valid) return json({ error: 'Invalid Telegram auth payload' }, 401, corsHeaders);

      const user = {
        telegram_user_id: String(payload.id),
        username: payload.username || '',
        first_name: payload.first_name || '',
        last_name: payload.last_name || '',
        photo_url: payload.photo_url || '',
      };
      const { sessionId, ttl } = await createSession(env, user);
      const secure = url.protocol === 'https:';
      return json({ ok: true, user, session_id: sessionId }, 200, {
        ...corsHeaders,
        'Set-Cookie': setCookie('glnt_session', sessionId, { maxAge: ttl, secure }),
      });
    }

    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      const sessionId = getSessionIdFromRequest(request, url);
      const session = await getSession(env, sessionId);
      if (!session) return json({ error: 'Unauthorized' }, 401, corsHeaders);
      return json({ user: session.user }, 200, corsHeaders);
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const sessionId = getSessionIdFromRequest(request, url);
      await deleteSession(env, sessionId);
      const secure = url.protocol === 'https:';
      return json({ ok: true }, 200, {
        ...corsHeaders,
        'Set-Cookie': clearCookie('glnt_session', { secure }),
      });
    }

    return json({ error: 'Not found' }, 404, corsHeaders);
  },
};
