const PROFILE_PREFIX = "glnt:userProfile:";
const CHATS_PREFIX = "glnt:chats:";
const MESSAGES_PREFIX = "glnt:messages:";
const CHAT_INDEX_PREFIX = "glnt:chatIndex:";

function now() {
  return Date.now();
}

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function chatStoreKey(uid) {
  return `${CHATS_PREFIX}${uid}`;
}

function chatIndexKey(chatId) {
  return `${CHAT_INDEX_PREFIX}${chatId}`;
}

function messageStoreKey(chatId) {
  return `${MESSAGES_PREFIX}${chatId}`;
}

function ensureChatStore(uid) {
  const key = chatStoreKey(uid);
  const data = loadJson(key, { order: [], chats: {} });
  if (!data.order || !data.chats) {
    return { order: [], chats: {} };
  }
  return data;
}

function makeTitle(text) {
  const t = (text || "").trim().replace(/\s+/g, " ");
  if (!t) return "New chat";
  return t.length > 34 ? `${t.slice(0, 34)}…` : t;
}

export class LocalStorageAdapter {
  async getUserProfile(uid) {
    if (!uid) return null;
    return loadJson(`${PROFILE_PREFIX}${uid}`, null);
  }

  async upsertUserProfile(profile) {
    if (!profile?.uid) return null;
    const existing = await this.getUserProfile(profile.uid);
    const merged = {
      uid: profile.uid,
      displayName: profile.displayName || existing?.displayName || "",
      avatarDataUrl: profile.avatarDataUrl || existing?.avatarDataUrl || "",
      avatarUrl: profile.avatarUrl || existing?.avatarUrl || "",
      bio: profile.bio || existing?.bio || "",
      updatedAt: profile.updatedAt || now(),
    };
    saveJson(`${PROFILE_PREFIX}${profile.uid}`, merged);
    return merged;
  }

  async listChats(uid) {
    if (!uid) return [];
    const data = ensureChatStore(uid);
    const order = data.order.length
      ? data.order
      : Object.keys(data.chats).sort(
          (a, b) => (data.chats[b]?.updatedAt || 0) - (data.chats[a]?.updatedAt || 0)
        );
    return order
      .map((id) => data.chats[id])
      .filter(Boolean)
      .map((chat) => ({ ...chat }));
  }

  async createChat(uid, chatPayload = {}) {
    if (!uid) return null;
    const data = ensureChatStore(uid);
    const chatId = makeId("chat");
    const createdAt = now();
    const title = chatPayload.title || "New chat";
    const chat = {
      chatId,
      uid,
      title,
      createdAt,
      updatedAt: createdAt,
    };
    data.chats[chatId] = chat;
    data.order = [chatId, ...data.order.filter((id) => id !== chatId)];
    saveJson(chatStoreKey(uid), data);
    saveJson(chatIndexKey(chatId), { uid });
    return { ...chat };
  }

  async getChat(chatId) {
    if (!chatId) return null;
    const index = loadJson(chatIndexKey(chatId), null);
    const uid = index?.uid;
    if (!uid) return null;
    const data = ensureChatStore(uid);
    return data.chats[chatId] ? { ...data.chats[chatId] } : null;
  }

  async deleteChat(chatId) {
    if (!chatId) return;
    const index = loadJson(chatIndexKey(chatId), null);
    const uid = index?.uid;
    if (!uid) return;
    const data = ensureChatStore(uid);
    delete data.chats[chatId];
    data.order = data.order.filter((id) => id !== chatId);
    saveJson(chatStoreKey(uid), data);
    localStorage.removeItem(messageStoreKey(chatId));
    localStorage.removeItem(chatIndexKey(chatId));
  }

  async updateChat(chatId, partial = {}) {
    const chat = await this.getChat(chatId);
    if (!chat) return null;
    const uid = chat.uid;
    const data = ensureChatStore(uid);
    const updated = {
      ...chat,
      ...partial,
      updatedAt: partial.updatedAt || now(),
    };
    data.chats[chatId] = updated;
    data.order = [chatId, ...data.order.filter((id) => id !== chatId)];
    saveJson(chatStoreKey(uid), data);
    return { ...updated };
  }

  async listMessages(chatId) {
    if (!chatId) return [];
    return loadJson(messageStoreKey(chatId), []);
  }

  async addMessage(chatId, message) {
    if (!chatId || !message) return null;
    const messages = loadJson(messageStoreKey(chatId), []);
    const entry = {
      messageId: message.messageId || makeId("msg"),
      chatId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt || now(),
      attachments: message.attachments || [],
    };
    messages.push(entry);
    saveJson(messageStoreKey(chatId), messages);

    const chat = await this.getChat(chatId);
    if (chat) {
      const updates = { updatedAt: entry.createdAt };
      if (
        entry.role === "user" &&
        (!chat.title || chat.title === "New chat")
      ) {
        updates.title = makeTitle(entry.content);
      }
      await this.updateChat(chatId, updates);
    }

    return entry;
  }
}
