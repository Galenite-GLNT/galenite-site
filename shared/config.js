const DEV_WORKER_API_BASE = 'https://galenite.ilyasch2020.workers.dev';

function resolveApiBase() {
  if (window.__API_BASE__) return String(window.__API_BASE__).replace(/\/$/, '');
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return DEV_WORKER_API_BASE;
  return '';
}

export const API_BASE = resolveApiBase();

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
    headers,
  });
}
