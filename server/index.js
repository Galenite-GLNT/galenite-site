import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { db, migrate } from './lib/db.js';
import { verifyTelegramHash, isTelegramAuthFresh } from './lib/telegram.js';
import { createSession, parseCookies, getSessionUser, setSessionCookie, getSessionCookieName, destroySession, clearSessionCookie } from './lib/session.js';
import { getProductByBarcode } from './lib/product-lookup.js';
import { getHealthCoachAdvice } from './lib/ai-coach.js';

migrate();

const root = path.resolve('.');
const port = Number(process.env.PORT || 3000);

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? JSON.parse(raw) : {};
}

function getAuthUser(req) {
  const cookies = parseCookies(req);
  return getSessionUser(cookies[getSessionCookieName()]);
}

function requireAuth(req, res) {
  const user = getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }
  return user;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);


  if (url.pathname === '/api/config') {
    return sendJson(res, 200, {
      telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || '',
      telegramAuthRedirectUrl: process.env.TELEGRAM_AUTH_REDIRECT_URL || ''
    });
  }

  if (url.pathname === '/api/auth/me') {
    const user = getAuthUser(req);
    return sendJson(res, 200, { user });
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    const cookies = parseCookies(req);
    destroySession(cookies[getSessionCookieName()]);
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === '/api/auth/telegram' && req.method === 'POST') {
    const body = await readBody(req);
    const maxAge = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 86400);
    if (!verifyTelegramHash(body, process.env.TELEGRAM_BOT_TOKEN) || !isTelegramAuthFresh(body.auth_date, maxAge)) {
      return sendJson(res, 401, { error: 'Invalid Telegram auth payload' });
    }

    const existing = db.prepare('SELECT * FROM users WHERE telegram_user_id = ?').get(String(body.id));
    let userId = existing?.id;
    if (!existing) {
      const r = db.prepare('INSERT INTO users(telegram_user_id, username, first_name, last_name, photo_url) VALUES (?,?,?,?,?)')
        .run(String(body.id), body.username || '', body.first_name || '', body.last_name || '', body.photo_url || '');
      userId = Number(r.lastInsertRowid);
    } else {
      db.prepare('UPDATE users SET username=?, first_name=?, last_name=?, photo_url=? WHERE id=?')
        .run(body.username || '', body.first_name || '', body.last_name || '', body.photo_url || '', existing.id);
    }

    const sid = createSession(userId);
    setSessionCookie(res, sid);
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname.startsWith('/api/')) {
    const user = requireAuth(req, res);
    if (!user) return;

    if (url.pathname === '/api/health/summary') {
      const day = url.searchParams.get('date') || today();
      const calories = db.prepare('SELECT COALESCE(SUM(kcal),0) AS total FROM meal_items mi JOIN meals m ON mi.meal_id = m.id WHERE m.user_id = ? AND m.date = ?').get(user.user_id, day).total;
      const water = db.prepare('SELECT COALESCE(SUM(ml),0) AS total FROM water_logs WHERE user_id = ? AND substr(datetime,1,10)=?').get(user.user_id, day).total;
      const sleepRows = db.prepare('SELECT duration_minutes FROM sleep_logs WHERE user_id = ? ORDER BY datetime(start_datetime) DESC LIMIT 7').all(user.user_id);
      const weightRows = db.prepare('SELECT kg, datetime FROM weight_logs WHERE user_id = ? ORDER BY datetime(datetime) DESC LIMIT 30').all(user.user_id).reverse();
      return sendJson(res, 200, {
        day,
        calories: Number(calories || 0),
        water: Number(water || 0),
        sleepHours: Number((sleepRows[0]?.duration_minutes || 0) / 60),
        sleepTrend: sleepRows.reverse().map((r) => Number((r.duration_minutes / 60).toFixed(1))),
        weight: weightRows.at(-1)?.kg || 0,
        weightTrend: weightRows.map((r) => r.kg),
      });
    }

    if (url.pathname === '/api/products/barcode' && req.method === 'GET') {
      const barcode = url.searchParams.get('value');
      if (!barcode) return sendJson(res, 400, { error: 'Missing barcode' });
      const product = await getProductByBarcode(barcode);
      if (!product) return sendJson(res, 404, { error: 'Product not found' });
      return sendJson(res, 200, { product });
    }

    if (url.pathname === '/api/health/water' && req.method === 'POST') {
      const body = await readBody(req);
      db.prepare('INSERT INTO water_logs(user_id, datetime, ml, beverage_type) VALUES (?,?,?,?)').run(user.user_id, body.datetime || new Date().toISOString(), Number(body.ml || 0), body.beverage_type || null);
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === '/api/health/sleep' && req.method === 'POST') {
      const body = await readBody(req);
      db.prepare('INSERT INTO sleep_logs(user_id, start_datetime, end_datetime, duration_minutes, quality_tags) VALUES (?,?,?,?,?)').run(user.user_id, body.start_datetime || null, body.end_datetime || null, Number(body.duration_minutes || 0), body.quality_tags || null);
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === '/api/health/weight' && req.method === 'POST') {
      const body = await readBody(req);
      db.prepare('INSERT INTO weight_logs(user_id, datetime, kg) VALUES (?,?,?)').run(user.user_id, body.datetime || new Date().toISOString(), Number(body.kg || 0));
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === '/api/health/meal-item' && req.method === 'POST') {
      const body = await readBody(req);
      const date = body.date || today();
      let meal = db.prepare('SELECT id FROM meals WHERE user_id = ? AND date = ? AND meal_type = ?').get(user.user_id, date, body.meal_type || 'snack');
      if (!meal) {
        const r = db.prepare('INSERT INTO meals(user_id, date, meal_type) VALUES (?,?,?)').run(user.user_id, date, body.meal_type || 'snack');
        meal = { id: Number(r.lastInsertRowid) };
      }
      db.prepare('INSERT INTO meal_items(meal_id, product_id, custom_name, grams, kcal, p, f, c) VALUES (?,?,?,?,?,?,?,?)')
        .run(meal.id, body.product_id || null, body.custom_name || null, Number(body.grams || 0), Number(body.kcal || 0), Number(body.p || 0), Number(body.f || 0), Number(body.c || 0));
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === '/api/ai/health-coach' && req.method === 'POST') {
      const body = await readBody(req);
      const advice = await getHealthCoachAdvice(body);
      return sendJson(res, 200, { advice });
    }

    return sendJson(res, 404, { error: 'Not found' });
  }

  if (url.pathname === '/health' || url.pathname === '/health/') {
    const user = getAuthUser(req);
    if (!user) {
      res.writeHead(302, { Location: `/auth/?return=${encodeURIComponent('/health/')}` });
      return res.end();
    }
  }

  const filePath = path.join(root, url.pathname === '/' ? '/index.html' : url.pathname);
  let safe = filePath;
  if (fs.existsSync(safe) && fs.statSync(safe).isDirectory()) safe = path.join(safe, 'index.html');
  if (!safe.startsWith(root) || !fs.existsSync(safe)) {
    res.writeHead(404);
    return res.end('Not found');
  }

  const ext = path.extname(safe);
  const map = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
  res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
  fs.createReadStream(safe).pipe(res);
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
