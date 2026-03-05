import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyTelegramHash, isTelegramAuthFresh } from '../server/lib/telegram.js';

test('verifyTelegramHash validates official algorithm', () => {
  const botToken = '123:abc';
  const payload = {
    id: '42',
    first_name: 'Ada',
    username: 'ada',
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  const dataCheckString = Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  assert.equal(verifyTelegramHash({ ...payload, hash }, botToken), true);
  assert.equal(verifyTelegramHash({ ...payload, hash: 'bad' }, botToken), false);
});

test('isTelegramAuthFresh checks max age', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal(isTelegramAuthFresh(now - 10, 60), true);
  assert.equal(isTelegramAuthFresh(now - 120, 60), false);
});
