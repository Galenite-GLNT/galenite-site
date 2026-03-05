import crypto from 'node:crypto';
import { db } from './db.js';

const cookieName = 'glnt_session';
const ttlMs = 1000 * 60 * 60 * 24 * 7;

export function createSession(userId) {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare('INSERT INTO sessions(id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(id, userId, now, now + ttlMs);
  return id;
}

export function getSessionUser(sessionId) {
  if (!sessionId) return null;
  const row = db.prepare('SELECT s.user_id, u.telegram_user_id, u.username, u.first_name, u.last_name, u.photo_url FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?').get(sessionId, Date.now());
  return row || null;
}

export function destroySession(sessionId) {
  if (!sessionId) return;
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, chunk) => {
    const [k, ...v] = chunk.trim().split('=');
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join('='));
    return acc;
  }, {});
}

export function setSessionCookie(res, sessionId) {
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  res.setHeader('Set-Cookie', `${cookieName}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; ${secure}SameSite=Lax; Max-Age=${Math.floor(ttlMs / 1000)}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
}

export function getSessionCookieName() {
  return cookieName;
}
