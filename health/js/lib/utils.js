export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtNum(value, digits = 0) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(digits) : '0';
}

export function toDateTimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value) {
  if (!value) return '';
  return new Date(value).toISOString();
}

export function sleepDurationMinutes(startIso, endIso) {
  const start = new Date(startIso).getTime();
  let end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  if (end <= start) end += 24 * 60 * 60 * 1000;
  return Math.round((end - start) / 60000);
}

export function initials(displayName) {
  const parts = String(displayName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return parts.slice(0, 2).map((x) => x[0].toUpperCase()).join('');
}

export function buildDisplayName(user) {
  if (!user) return 'Профиль';
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  if (full) return full;
  if (user.username) return `@${user.username}`;
  return `User ${user.telegram_user_id || ''}`.trim();
}
