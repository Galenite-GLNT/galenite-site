export const API_BASE = (window.__API_BASE__ || '').replace(/\/$/, '');

export function apiUrl(path) {
  if (!path.startsWith('/')) return `${API_BASE}/${path}`;
  return `${API_BASE}${path}`;
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return response;
}
