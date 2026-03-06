const DEFAULT_API_BASE_URL = 'https://galenite.ilyasch2020.workers.dev';

function normalizeBase(base) {
  return String(base || '').trim().replace(/\/$/, '');
}

function getApiBases() {
  const configured = normalizeBase(window.API_BASE_URL || DEFAULT_API_BASE_URL);
  const sameOrigin = normalizeBase(window.location.origin || '');
  return [...new Set([configured, sameOrigin].filter(Boolean))];
}

const API_BASES = getApiBases();
export const API_BASE = API_BASES[0] || DEFAULT_API_BASE_URL;

export function apiUrl(path, base = API_BASE) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function shouldRetryWithNextBase(path, response) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!normalizedPath.startsWith('/api/')) return false;
  return response.status === 404 || response.status === 405;
}

export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  let lastError = null;
  let lastResponse = null;

  for (let i = 0; i < API_BASES.length; i += 1) {
    const base = API_BASES[i];
    try {
      const response = await fetch(apiUrl(path, base), {
        credentials: 'include',
        ...options,
        headers,
      });
      lastResponse = response;

      if (i < API_BASES.length - 1 && shouldRetryWithNextBase(path, response)) {
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (i === API_BASES.length - 1) throw error;
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('apiFetch failed');
}
