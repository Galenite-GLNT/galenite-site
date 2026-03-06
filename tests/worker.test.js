import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { parseCookies, setCookie, verifyTelegramLogin } from '../worker/index.js';
import crypto from 'node:crypto';

function makeHash(payload, botToken) {
  const dataCheckString = Object.entries(payload)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  return crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
}

test('cookie helpers', () => {
  const parsed = parseCookies('a=1; glnt_session=abc123');
  assert.equal(parsed.a, '1');
  assert.equal(parsed.glnt_session, 'abc123');
  const cookie = setCookie('glnt_session', 'xyz', { secure: false });
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
});

test('telegram verification works', async () => {
  const botToken = '123:abc';
  const payload = {
    id: '42',
    first_name: 'Ada',
    username: 'ada',
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  const hash = makeHash(payload, botToken);
  assert.equal(await verifyTelegramLogin({ ...payload, hash }, botToken, 86400), true);
  assert.equal(await verifyTelegramLogin({ ...payload, hash: 'bad' }, botToken, 86400), false);
});

test('ping endpoint responds', async () => {
  const req = new Request('https://api.example.com/api/ping');
  const res = await worker.fetch(req, { TELEGRAM_BOT_USERNAME: 'glnt_auth_bot', ALLOWED_ORIGINS: '*' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('cors allows galenite.ru by default', async () => {
  const req = new Request('https://api.example.com/api/ping', {
    headers: { Origin: 'https://galenite.ru' },
  });
  const res = await worker.fetch(req, { TELEGRAM_BOT_USERNAME: 'glnt_auth_bot' });
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://galenite.ru');
  assert.equal(res.headers.get('Access-Control-Allow-Credentials'), 'true');
});

test('auth/me accepts session_id query fallback', async () => {
  const botToken = '123:abc';
  const authPayload = {
    id: '777',
    first_name: 'Test',
    username: 'tester',
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  const hash = makeHash(authPayload, botToken);

  const loginRes = await worker.fetch(new Request('https://api.example.com/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://galenite.ru' },
    body: JSON.stringify({ ...authPayload, hash }),
  }), { TELEGRAM_BOT_TOKEN: botToken, TELEGRAM_BOT_USERNAME: 'glnt_auth_bot' });

  assert.equal(loginRes.status, 200);
  const loginBody = await loginRes.json();
  assert.ok(loginBody.session_id);

  const meRes = await worker.fetch(new Request(`https://api.example.com/api/auth/me?session_id=${encodeURIComponent(loginBody.session_id)}`, {
    headers: { Origin: 'https://galenite.ru' },
  }), { TELEGRAM_BOT_TOKEN: botToken, TELEGRAM_BOT_USERNAME: 'glnt_auth_bot' });

  assert.equal(meRes.status, 200);
  const meBody = await meRes.json();
  assert.equal(meBody.user.telegram_user_id, '777');
});


test('auth/telegram accepts urlencoded payload', async () => {
  const botToken = '123:abc';
  const authPayload = {
    id: '888',
    first_name: 'Form',
    username: 'formuser',
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  const hash = makeHash(authPayload, botToken);
  const body = new URLSearchParams({ ...authPayload, hash });

  const res = await worker.fetch(new Request('https://api.example.com/api/auth/telegram', {
    method: 'POST',
    headers: { Origin: 'https://galenite.ru', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
  }), { TELEGRAM_BOT_TOKEN: botToken, TELEGRAM_BOT_USERNAME: 'glnt_auth_bot' });

  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.user.telegram_user_id, '888');
  assert.ok(payload.session_id);
});
