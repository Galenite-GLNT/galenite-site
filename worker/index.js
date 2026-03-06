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
  const defaults = ['https://galenite.ru', 'https://www.galenite.ru'];
  const allowed = [...new Set([...configured, ...defaults])];

  if (!origin) return {};
  const allowAny = allowed.includes('*');
  const isAllowed = allowAny || allowed.includes(origin);
  if (!isAllowed) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
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

async function handleFoodSearch(url, env) {
  const q = url.searchParams.get('q')?.trim();
  if (!q) return json({ items: [] });
  const offUrl = `${getApiBase(env)}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&json=1&page_size=24`;
  const resp = await fetch(offUrl, { headers: { 'User-Agent': 'galenite-worker/1.0' } });
  if (!resp.ok) return json({ error: 'OpenFoodFacts unavailable' }, 502);
  const data = await resp.json();
  const items = (data.products || []).map(normalizeOffProduct).filter((i) => i.name && i.name !== 'Unknown');
  return json({ items });
}

async function handleFoodBarcode(url, env) {
  const code = url.searchParams.get('code')?.trim();
  if (!code) return json({ item: null });
  const offUrl = `${getApiBase(env)}/api/v2/product/${encodeURIComponent(code)}.json`;
  const resp = await fetch(offUrl, { headers: { 'User-Agent': 'galenite-worker/1.0' } });
  if (!resp.ok) return json({ item: null });
  const data = await resp.json();
  if (data.status !== 1 || !data.product) return json({ item: null });
  return json({ item: normalizeOffProduct(data.product) });
}

function getSessionIdFromRequest(request, url) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  return cookies.glnt_session || url.searchParams.get('session_id') || '';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toLogDTO(row) {
  let meta = {};
  try { meta = JSON.parse(row.meta || '{}'); } catch { meta = {}; }
  return {
    id: Number(row.id),
    type: row.type,
    value: Number(row.value || 0),
    datetime: row.created_at,
    ...meta,
  };
}

async function ensureHealthSchema(env) {
  if (!env.DB) return false;
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS health_goals (
      user_id TEXT PRIMARY KEY,
      calories REAL NOT NULL DEFAULT 2200,
      protein REAL NOT NULL DEFAULT 140,
      fat REAL NOT NULL DEFAULT 70,
      carbs REAL NOT NULL DEFAULT 240,
      water REAL NOT NULL DEFAULT 2500,
      sleep REAL NOT NULL DEFAULT 8,
      weight REAL NOT NULL DEFAULT 70,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS health_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      meta TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_health_logs_user_type_date ON health_logs(user_id, type, created_at DESC);

    CREATE TABLE IF NOT EXISTS health_profile (
      user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '',
      age INTEGER NOT NULL DEFAULT 0,
      height_cm REAL NOT NULL DEFAULT 0,
      activity_level TEXT NOT NULL DEFAULT '',
      current_weight REAL NOT NULL DEFAULT 0,
      target_weight REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS health_food_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      product_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, product_key)
    );
  `);
  return true;
}

function goalsDefaults() {
  return { calories: 2200, protein: 140, fat: 70, carbs: 240, water: 2500, sleep: 8, weight: 70 };
}

function profileDefaults() {
  return { display_name: '', gender: '', age: 0, height_cm: 0, activity_level: '', current_weight: 0, target_weight: 0 };
}

async function getGoals(env, userId) {
  const row = await env.DB.prepare('SELECT calories, protein, fat, carbs, water, sleep, weight FROM health_goals WHERE user_id=?').bind(userId).first();
  return row ? {
    calories: Number(row.calories || 0),
    protein: Number(row.protein || 0),
    fat: Number(row.fat || 0),
    carbs: Number(row.carbs || 0),
    water: Number(row.water || 0),
    sleep: Number(row.sleep || 0),
    weight: Number(row.weight || 0),
  } : goalsDefaults();
}

async function getProfile(env, userId) {
  const row = await env.DB.prepare('SELECT display_name, gender, age, height_cm, activity_level, current_weight, target_weight FROM health_profile WHERE user_id=?').bind(userId).first();
  return row ? {
    display_name: row.display_name || '',
    gender: row.gender || '',
    age: Number(row.age || 0),
    height_cm: Number(row.height_cm || 0),
    activity_level: row.activity_level || '',
    current_weight: Number(row.current_weight || 0),
    target_weight: Number(row.target_weight || 0),
  } : profileDefaults();
}

async function getFavorites(env, userId) {
  const rows = await env.DB.prepare('SELECT payload FROM health_food_favorites WHERE user_id=? ORDER BY created_at DESC LIMIT 30').bind(userId).all();
  return (rows.results || []).map((x) => {
    try { return JSON.parse(x.payload || '{}'); } catch { return {}; }
  }).filter((x) => x.name);
}

async function getRecentFoods(env, userId) {
  const rows = await env.DB.prepare(`
    SELECT meta, MAX(created_at) as created_at
    FROM health_logs
    WHERE user_id=? AND type='calories'
    GROUP BY json_extract(meta, '$.name'), json_extract(meta, '$.brand')
    ORDER BY created_at DESC
    LIMIT 12
  `).bind(userId).all();

  return (rows.results || []).map((x) => {
    try {
      const meta = JSON.parse(x.meta || '{}');
      return {
        name: meta.name || '',
        brand: meta.brand || '',
        image: meta.image || '',
        calories_100g: Number(meta.calories_100g || 0),
        protein_100g: Number(meta.protein_100g || 0),
        fat_100g: Number(meta.fat_100g || 0),
        carbs_100g: Number(meta.carbs_100g || 0),
        barcode: meta.barcode || '',
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function getLogsByDate(env, userId, dateIso = todayIso()) {
  const rows = await env.DB.prepare('SELECT id, type, value, meta, created_at FROM health_logs WHERE user_id=? AND created_at LIKE ? ORDER BY created_at ASC').bind(userId, `${dateIso}%`).all();
  const logs = { water: [], sleep: [], weight: [], calories: [] };

  for (const row of (rows.results || [])) {
    const dto = toLogDTO(row);
    if (dto.type === 'water') logs.water.push({ id: dto.id, datetime: dto.datetime, ml: dto.value, ...dto });
    if (dto.type === 'sleep') logs.sleep.push({ id: dto.id, datetime: dto.datetime, start_time: dto.start_time || '', end_time: dto.end_time || '', minutes: dto.minutes || dto.value });
    if (dto.type === 'weight') logs.weight.push({ id: dto.id, datetime: dto.datetime, kg: dto.value });
    if (dto.type === 'calories') logs.calories.push({ id: dto.id, datetime: dto.datetime, ...dto, kcal: dto.kcal || dto.value });
  }
  return logs;
}

async function loadUserHealthState(env, userId, dateIso = todayIso()) {
  const hasDb = await ensureHealthSchema(env);
  if (!hasDb) return { goals: goalsDefaults(), profile: profileDefaults(), logs: { water: [], sleep: [], weight: [], calories: [] }, favorites: [], recentFoods: [] };

  const [goals, profile, logs, favorites, recentFoods] = await Promise.all([
    getGoals(env, userId),
    getProfile(env, userId),
    getLogsByDate(env, userId, dateIso),
    getFavorites(env, userId),
    getRecentFoods(env, userId),
  ]);

  return { goals, profile, logs, favorites, recentFoods, date: dateIso };
}

function prepareLog(payload) {
  const type = String(payload.type || '');
  if (!['water', 'sleep', 'weight', 'calories'].includes(type)) return { error: 'Unsupported log type' };

  let value = 0;
  let meta = {};

  if (type === 'water') value = Number(payload.ml || 0);
  if (type === 'sleep') {
    value = Number(payload.minutes || 0);
    meta = { start_time: payload.start_time || '', end_time: payload.end_time || '', minutes: value };
  }
  if (type === 'weight') value = Number(payload.kg || 0);
  if (type === 'calories') {
    value = Number(payload.kcal || 0);
    meta = {
      name: String(payload.name || ''),
      brand: String(payload.brand || ''),
      image: String(payload.image || ''),
      barcode: String(payload.barcode || ''),
      meal: String(payload.meal || 'snacks'),
      grams: Number(payload.grams || 0),
      calories_100g: Number(payload.calories_100g || 0),
      protein_100g: Number(payload.protein_100g || 0),
      fat_100g: Number(payload.fat_100g || 0),
      carbs_100g: Number(payload.carbs_100g || 0),
      kcal: Number(payload.kcal || 0),
      protein: Number(payload.protein || 0),
      fat: Number(payload.fat || 0),
      carbs: Number(payload.carbs || 0),
    };
  }

  if (!Number.isFinite(value) || value <= 0) return { error: 'Invalid value' };
  return { type, value, meta };
}

async function insertLog(env, userId, payload) {
  const hasDb = await ensureHealthSchema(env);
  if (!hasDb) return { error: 'Health DB not configured' };

  const prepared = prepareLog(payload);
  if (prepared.error) return prepared;
  const dt = payload.date ? `${payload.date}T${new Date().toISOString().slice(11)}` : new Date().toISOString();

  const result = await env.DB.prepare('INSERT INTO health_logs (user_id, type, value, meta, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(userId, prepared.type, prepared.value, JSON.stringify(prepared.meta), dt)
    .run();
  return { ok: true, id: Number(result.meta?.last_row_id || 0) };
}

async function updateLog(env, userId, id, payload) {
  const hasDb = await ensureHealthSchema(env);
  if (!hasDb) return { error: 'Health DB not configured' };
  const row = await env.DB.prepare('SELECT id FROM health_logs WHERE id=? AND user_id=?').bind(id, userId).first();
  if (!row) return { error: 'Log not found' };

  const prepared = prepareLog(payload);
  if (prepared.error) return prepared;
  const dt = payload.date ? `${payload.date}T${new Date().toISOString().slice(11)}` : new Date().toISOString();

  await env.DB.prepare('UPDATE health_logs SET type=?, value=?, meta=?, created_at=? WHERE id=? AND user_id=?')
    .bind(prepared.type, prepared.value, JSON.stringify(prepared.meta), dt, id, userId)
    .run();

  return { ok: true };
}

async function deleteLogById(env, userId, id) {
  await env.DB.prepare('DELETE FROM health_logs WHERE id=? AND user_id=?').bind(id, userId).run();
  return { ok: true };
}

async function callAiCoach(env, payload) {
  const base = String(env.AI_WORKER_URL || '').replace(/\/$/, '');
  if (!base) return { ok: false, error: 'AI worker URL is not configured' };

  const token = String(env.AI_INTERNAL_TOKEN || '');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Internal-Token'] = token;
  }

  const response = await fetch(`${base}/v1/health/coach`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) return { ok: false, error: `AI upstream error: ${response.status}` };
  const data = await response.json();
  return {
    ok: true,
    tips: Array.isArray(data?.tips) ? data.tips.map((x) => String(x)) : [],
    summary: String(data?.summary || ''),
    meta: typeof data?.meta === 'object' && data.meta ? data.meta : {},
  };
}

async function readTelegramPayload(request, url) {
  if (request.method === 'GET') return Object.fromEntries(url.searchParams.entries());
  const contentType = (request.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    try {
      const raw = await request.text();
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    try {
      const form = await request.clone().formData();
      const payload = {};
      for (const [k, v] of form.entries()) payload[k] = String(v);
      if (Object.keys(payload).length) return payload;
    } catch {
      // no-op
    }
  }

  try {
    const raw = await request.text();
    if (!raw) return {};
    const params = new URLSearchParams(raw);
    if ([...params.keys()].length) return Object.fromEntries(params.entries());
    if (raw.trim().startsWith('{')) return JSON.parse(raw);
  } catch {
    return {};
  }

  return {};
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

    if (url.pathname === '/api/food/barcode' && request.method === 'GET') {
      const res = await handleFoodBarcode(url, env);
      Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    if (url.pathname === '/api/auth/telegram' && (request.method === 'POST' || request.method === 'GET')) {
      const payload = await readTelegramPayload(request, url);
      if (!payload || !payload.id || !payload.auth_date || !payload.hash) return json({ error: 'Bad auth payload format' }, 400, corsHeaders);

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

    if (url.pathname.startsWith('/api/health/')) {
      const sessionId = getSessionIdFromRequest(request, url);
      const session = await getSession(env, sessionId);
      if (!session) return json({ error: 'Unauthorized' }, 401, corsHeaders);
      const userId = session.user.telegram_user_id;

      if (url.pathname === '/api/health/state' && request.method === 'GET') {
        const date = url.searchParams.get('date') || todayIso();
        const data = await loadUserHealthState(env, userId, date);
        return json({ ok: true, ...data }, 200, corsHeaders);
      }

      if (url.pathname === '/api/health/profile' && request.method === 'POST') {
        await ensureHealthSchema(env);
        const body = await request.json().catch(() => ({}));
        await env.DB.prepare(`
          INSERT INTO health_profile (user_id, display_name, gender, age, height_cm, activity_level, current_weight, target_weight, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            display_name=excluded.display_name,
            gender=excluded.gender,
            age=excluded.age,
            height_cm=excluded.height_cm,
            activity_level=excluded.activity_level,
            current_weight=excluded.current_weight,
            target_weight=excluded.target_weight,
            updated_at=excluded.updated_at
        `).bind(
          userId,
          String(body.display_name || ''),
          String(body.gender || ''),
          Number(body.age || 0),
          Number(body.height_cm || 0),
          String(body.activity_level || ''),
          Number(body.current_weight || 0),
          Number(body.target_weight || 0),
          new Date().toISOString(),
        ).run();
        return json({ ok: true }, 200, corsHeaders);
      }

      if (url.pathname === '/api/health/goals' && request.method === 'POST') {
        await ensureHealthSchema(env);
        const body = await request.json().catch(() => ({}));
        const values = { ...goalsDefaults(), ...body };
        await env.DB.prepare(`
          INSERT INTO health_goals (user_id, calories, protein, fat, carbs, water, sleep, weight, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            calories=excluded.calories,
            protein=excluded.protein,
            fat=excluded.fat,
            carbs=excluded.carbs,
            water=excluded.water,
            sleep=excluded.sleep,
            weight=excluded.weight,
            updated_at=excluded.updated_at
        `).bind(
          userId,
          Number(values.calories || 0),
          Number(values.protein || 0),
          Number(values.fat || 0),
          Number(values.carbs || 0),
          Number(values.water || 0),
          Number(values.sleep || 0),
          Number(values.weight || 0),
          new Date().toISOString(),
        ).run();
        return json({ ok: true }, 200, corsHeaders);
      }

      if (url.pathname === '/api/health/logs' && request.method === 'GET') {
        const type = String(url.searchParams.get('type') || 'water');
        const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 10)));
        const date = url.searchParams.get('date') || todayIso();
        const rows = await env.DB.prepare('SELECT id, type, value, meta, created_at FROM health_logs WHERE user_id=? AND type=? AND created_at LIKE ? ORDER BY created_at DESC LIMIT ?')
          .bind(userId, type, `${date}%`, limit).all();
        return json({ ok: true, items: (rows.results || []).map(toLogDTO) }, 200, corsHeaders);
      }

      if (url.pathname === '/api/health/logs' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const result = await insertLog(env, userId, body);
        if (result.error) return json({ error: result.error }, 400, corsHeaders);
        return json(result, 200, corsHeaders);
      }

      if (url.pathname === '/api/health/logs' && request.method === 'PATCH') {
        const body = await request.json().catch(() => ({}));
        const result = await updateLog(env, userId, Number(body.id || 0), body);
        if (result.error) return json({ error: result.error }, 400, corsHeaders);
        return json(result, 200, corsHeaders);
      }

      if (url.pathname === '/api/health/logs' && request.method === 'DELETE') {
        const id = Number(url.searchParams.get('id') || 0);
        if (!id) return json({ error: 'id required' }, 400, corsHeaders);
        const result = await deleteLogById(env, userId, id);
        return json(result, 200, corsHeaders);
      }

      if (url.pathname === '/api/health/favorites' && (request.method === 'POST' || request.method === 'DELETE')) {
        await ensureHealthSchema(env);
        const body = await request.json().catch(() => ({}));
        const key = `${String(body.barcode || '').trim()}::${String(body.name || '').trim()}::${String(body.brand || '').trim()}`;
        if (!String(body.name || '').trim()) return json({ error: 'name required' }, 400, corsHeaders);

        if (request.method === 'POST') {
          await env.DB.prepare('INSERT OR REPLACE INTO health_food_favorites (user_id, product_key, payload, created_at) VALUES (?, ?, ?, ?)')
            .bind(userId, key, JSON.stringify(body), new Date().toISOString()).run();
          return json({ ok: true }, 200, corsHeaders);
        }

        await env.DB.prepare('DELETE FROM health_food_favorites WHERE user_id=? AND product_key=?').bind(userId, key).run();
        return json({ ok: true }, 200, corsHeaders);
      }

      if (url.pathname === '/api/health/coach' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const question = String(body.question || '').trim();
        if (!question) return json({ error: 'Question is required' }, 400, corsHeaders);

        const date = url.searchParams.get('date') || todayIso();
        const health = await loadUserHealthState(env, userId, date);
        const ai = await callAiCoach(env, {
          question,
          date,
          user: {
            telegram_user_id: session.user.telegram_user_id,
            username: session.user.username || '',
            first_name: session.user.first_name || '',
            last_name: session.user.last_name || '',
          },
          goals: health.goals,
          profile: health.profile,
          logs: health.logs,
        });

        if (!ai.ok) return json({ ok: false, error: ai.error || 'AI unavailable', tips: [], summary: '', meta: {} }, 502, corsHeaders);
        return json({ ok: true, tips: ai.tips, summary: ai.summary, meta: ai.meta }, 200, corsHeaders);
      }
    }

    return json({ error: 'Not found' }, 404, corsHeaders);
  },
};
