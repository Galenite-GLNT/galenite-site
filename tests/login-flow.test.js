import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';

function waitForServer(proc) {
  return new Promise((resolve) => {
    proc.stdout.on('data', (d) => {
      if (String(d).includes('Server running')) resolve();
    });
  });
}

test('telegram login flow creates session cookie', async () => {
  const botToken = '123:abc';
  const proc = spawn('node', ['server/index.js'], { env: { ...process.env, PORT: '3301', DATABASE_URL: './data/test-login.db', TELEGRAM_BOT_TOKEN: botToken } });
  await waitForServer(proc);

  const payload = {
    id: '777',
    first_name: 'Test',
    username: 'tester',
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  const dataCheckString = Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const res = await fetch('http://localhost:3301/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, hash }),
  });

  assert.equal(res.status, 200);
  assert.match(res.headers.get('set-cookie'), /glnt_session=/);
  proc.kill('SIGTERM');
});
