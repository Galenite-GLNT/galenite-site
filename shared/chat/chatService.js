import { getStorageAdapter } from "../storage/storageAdapter.js";

function resolveUid(uid) {
  return uid || "guest";
}

export async function listChats(uid) {
  const adapter = getStorageAdapter();
  return adapter.listChats(resolveUid(uid));
}

export async function createChat(uid, chatPayload = {}) {
  const adapter = getStorageAdapter();
  return adapter.createChat(resolveUid(uid), chatPayload);
}

export async function getChat(chatId) {
  const adapter = getStorageAdapter();
  return adapter.getChat(chatId);
}

export async function deleteChat(chatId) {
  const adapter = getStorageAdapter();
  return adapter.deleteChat(chatId);
}

export async function listMessages(chatId) {
  const adapter = getStorageAdapter();
  return adapter.listMessages(chatId);
}

export async function addMessage(chatId, message) {
  const adapter = getStorageAdapter();
  return adapter.addMessage(chatId, message);
}

export async function updateChat(chatId, partial) {
  const adapter = getStorageAdapter();
  return adapter.updateChat(chatId, partial);
}
