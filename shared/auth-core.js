export async function getCurrentUser() {
  const resp = await fetch('/api/auth/me');
  const data = await resp.json();
  return data.user || null;
}

export function watchAuth(callback) {
  let active = true;
  async function tick() {
    if (!active) return;
    const user = await getCurrentUser();
    callback(user);
  }
  tick();
  const i = setInterval(tick, 15000);
  return () => {
    active = false;
    clearInterval(i);
  };
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
}
