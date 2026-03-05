const LS_KEY = "galen_chat_v1";

function lsLoad() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{"chats":{},"order":[]}');
  } catch {
    return { chats: {}, order: [] };
  }
}

function lsSave(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function now() {
  return Date.now();
}

function makeTitle(text) {
  const t = (text || "").trim().replace(/\s+/g, " ");
  if (!t) return "New chat";
  return t.length > 34 ? `${t.slice(0, 34)}…` : t;
}

export async function listChats() {
  const data = lsLoad();
  return data.order.map((id) => ({
    id,
    title: data.chats[id]?.title || "New chat",
    updatedAt: data.chats[id]?.updatedAt || 0,
  }));
}

export async function createChat() {
  const data = lsLoad();
  const id = `c_${Math.random().toString(36).slice(2, 10)}`;
  data.chats[id] = { title: "New chat", messages: [], createdAt: now(), updatedAt: now() };
  data.order = [id, ...data.order.filter((x) => x !== id)];
  lsSave(data);
  return { id, title: "New chat" };
}

export async function loadMessages(_user, chatId) {
  const data = lsLoad();
  return (data.chats[chatId]?.messages || []).slice();
}

export async function appendMessage(_user, chatId, role, content) {
  const data = lsLoad();
  if (!data.chats[chatId]) {
    data.chats[chatId] = { title: "New chat", messages: [], createdAt: now(), updatedAt: now() };
  }

  data.chats[chatId].messages.push({ role, content, createdAt: now() });
  if (role === 'user' && (!data.chats[chatId].title || data.chats[chatId].title === 'New chat')) {
    data.chats[chatId].title = makeTitle(content);
  }
  data.chats[chatId].updatedAt = now();
  data.order = [chatId, ...data.order.filter((x) => x !== chatId)];
  lsSave(data);
}

export async function removeChat(_user, chatId) {
  const data = lsLoad();
  delete data.chats[chatId];
  data.order = data.order.filter((id) => id !== chatId);
  lsSave(data);
}
