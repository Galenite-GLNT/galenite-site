import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { parseCookies, setCookie, verifyTelegramLogin } from '../worker/index.js';
import crypto from 'node:crypto';

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
  const dataCheckString = Object.entries(payload)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto.createHash('sha256').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
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
