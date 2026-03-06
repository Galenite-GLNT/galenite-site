const DEFAULT_API_BASE_URL = 'https://galenite.ilyasch2020.workers.dev';
const rawBase = String(window.API_BASE_URL || DEFAULT_API_BASE_URL).trim();
const normalizedBase = rawBase.replace(/\/$/, '');

export const API_BASE = normalizedBase.startsWith('http') ? normalizedBase : DEFAULT_API_BASE_URL;

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
