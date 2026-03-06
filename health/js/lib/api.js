import { apiFetch } from '/shared/config.js';

async function asJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function fetchMe() {
  return asJson(await apiFetch('/api/auth/me', { method: 'GET' }));
}

export async function fetchHealthState(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return asJson(await apiFetch(`/api/health/state${query}`, { method: 'GET' }));
}

export async function saveGoals(payload) {
  return asJson(await apiFetch('/api/health/goals', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function saveProfile(payload) {
  return asJson(await apiFetch('/api/health/profile', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function createLog(payload) {
  return asJson(await apiFetch('/api/health/logs', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function updateLog(id, payload) {
  return asJson(await apiFetch('/api/health/logs', { method: 'PATCH', body: JSON.stringify({ id, ...payload }) }));
}

export async function deleteLog(id) {
  return asJson(await apiFetch(`/api/health/logs?id=${encodeURIComponent(id)}`, { method: 'DELETE' }));
}

export async function searchFoods(query) {
  return asJson(await apiFetch(`/api/food/search?q=${encodeURIComponent(query)}`, { method: 'GET' }));
}

export async function findFoodByBarcode(code) {
  return asJson(await apiFetch(`/api/food/barcode?code=${encodeURIComponent(code)}`, { method: 'GET' }));
}

export async function askCoach(question) {
  return asJson(await apiFetch('/api/health/coach', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ question }),
  }));
}

export async function toggleFavorite(product, isFavorite) {
  return asJson(await apiFetch('/api/health/favorites', {
    method: isFavorite ? 'DELETE' : 'POST',
    body: JSON.stringify(product),
  }));
}

export async function logout() {
  return asJson(await apiFetch('/api/auth/logout', { method: 'POST' }));
}
