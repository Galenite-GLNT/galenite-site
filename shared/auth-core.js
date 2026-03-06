import { apiFetch } from '/shared/config.js';

export async function getCurrentUser() {
  try {
    const resp = await apiFetch('/api/auth/me');
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.user || null;
  } catch {
    return null;
  }
}

export function watchAuth(callback) {
  let active = true;
  async function tick() {
    if (!active) return;
    callback(await getCurrentUser());
  }
  tick();
  const intervalId = setInterval(tick, 15000);
  return () => {
    active = false;
    clearInterval(intervalId);
  };
}

export async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('glnt_session_id');
  } catch {
    // ignore network failures on logout action
  }
}
