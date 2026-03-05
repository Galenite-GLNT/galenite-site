import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

function waitForServer(proc) {
  return new Promise((resolve) => {
    proc.stdout.on('data', (d) => {
      if (String(d).includes('Server running')) resolve();
    });
  });
}

test('health page is protected by auth redirect', async () => {
  const proc = spawn('node', ['server/index.js'], { env: { ...process.env, PORT: '3300', DATABASE_URL: './data/test.db' } });
  await waitForServer(proc);
  const res = await fetch('http://localhost:3300/health/', { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /\/auth\//);
  proc.kill('SIGTERM');
});
