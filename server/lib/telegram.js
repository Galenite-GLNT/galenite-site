import crypto from 'node:crypto';

export function verifyTelegramHash(payload, botToken) {
  const { hash, ...rest } = payload;
  if (!hash || !botToken) return false;

  const dataCheckString = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const a = Buffer.from(computedHash);
  const b = Buffer.from(String(hash));
  if (a.length != b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function isTelegramAuthFresh(authDateSeconds, maxAgeSeconds = 86400) {
  const authDate = Number(authDateSeconds);
  if (!Number.isFinite(authDate)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds - authDate <= maxAgeSeconds;
}
