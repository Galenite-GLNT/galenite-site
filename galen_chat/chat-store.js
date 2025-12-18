import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { db } from "/shared/firebase.js";

const LS_KEY = "galen_chat_v1";

let firestoreHealthy = true;

function lsLoad() {
  try {
    return JSON.parse(
      localStorage.getItem(LS_KEY) || '{"chats":{},"order":[]}'
    );
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
  return t.length > 34 ? t.slice(0, 34) + "…" : t;
}

function noteFirestoreError(err) {
  console.warn("Falling back to local chat storage:", err?.message || err);
  firestoreHealthy = false;
}

function localListChats() {
  const data = lsLoad();
  return data.order.map((id) => ({
    id,
    title: data.chats[id]?.title || "New chat",
    updatedAt: data.chats[id]?.updatedAt || 0,
  }));
}

function localCreateChat() {
  const data = lsLoad();
  const id = "c_" + Math.random().toString(36).slice(2, 10);
  data.chats[id] = { title: "New chat", messages: [], createdAt: now(), updatedAt: now() };
  data.order = [id, ...data.order.filter((x) => x !== id)];
  lsSave(data);
  return { id, title: data.chats[id].title };
}

function localLoadMessages(chatId) {
  const data = lsLoad();
  const msgs = (data.chats[chatId]?.messages || []).map((m) => ({
    id: m.id || "m_" + Math.random().toString(36).slice(2, 10),
    ...m,
  }));

  // сохраняем сгенерированные id, чтобы дальше можно было править
  if (msgs.some((m, idx) => !(data.chats[chatId]?.messages?.[idx]?.id))) {
    data.chats[chatId].messages = msgs;
    lsSave(data);
  }

  return msgs;
}

function localAppendMessage(chatId, role, content) {
  const data = lsLoad();
  if (!data.chats[chatId]) {
    data.chats[chatId] = { title: "New chat", messages: [], createdAt: now(), updatedAt: now() };
    data.order = [chatId, ...data.order.filter((x) => x !== chatId)];
  }
  const id = "m_" + Math.random().toString(36).slice(2, 10);
  data.chats[chatId].messages.push({ id, role, content, createdAt: now() });

  if (role === "user" && (data.chats[chatId].title === "New chat" || !data.chats[chatId].title)) {
    data.chats[chatId].title = makeTitle(content);
  }

  data.chats[chatId].updatedAt = now();
  data.order = [chatId, ...data.order.filter((x) => x !== chatId)];
  lsSave(data);
  return id;
}

function localUpdateMessage(chatId, messageId, content) {
  const data = lsLoad();
  const messages = data.chats[chatId]?.messages || [];
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx >= 0) {
    messages[idx] = { ...messages[idx], content, updatedAt: now() };
    lsSave(data);
  }
}

function localRemoveMessages(chatId, ids = []) {
  const data = lsLoad();
  if (!data.chats[chatId]) return;
  data.chats[chatId].messages = (data.chats[chatId].messages || []).filter(
    (m) => !ids.includes(m.id)
  );
  data.chats[chatId].updatedAt = now();
  lsSave(data);
}

function localRemoveChat(chatId) {
  const data = lsLoad();
  delete data.chats[chatId];
  data.order = data.order.filter((id) => id !== chatId);
  lsSave(data);
}

export async function listChats(user){
  if(!user || !firestoreHealthy){
    return localListChats();
  }

  try {
    const chatsRef = collection(db, "users", user.uid, "chats");
    const snap = await getDocs(query(chatsRef, orderBy("updatedAt","desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    noteFirestoreError(err);
    return localListChats();
  }
}

export async function createChat(user){
  if(!user || !firestoreHealthy){
    return localCreateChat();
  }

  try {
    const chatsRef = collection(db, "users", user.uid, "chats");
    const docRef = await addDoc(chatsRef, {
      title: "New chat",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, title: "New chat" };
  } catch (err) {
    noteFirestoreError(err);
    return localCreateChat();
  }
}

export async function loadMessages(user, chatId){
  if(!user || !firestoreHealthy){
    return localLoadMessages(chatId);
  }
  try {
    const msgsRef = collection(db, "users", user.uid, "chats", chatId, "messages");
    const snap = await getDocs(query(msgsRef, orderBy("createdAt","asc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    noteFirestoreError(err);
    return localLoadMessages(chatId);
  }
}

export async function appendMessage(user, chatId, role, content){
  if(!user || !firestoreHealthy){
    return localAppendMessage(chatId, role, content);
  }

  try {
    const chatRef = doc(db, "users", user.uid, "chats", chatId);
    const msgsRef = collection(db, "users", user.uid, "chats", chatId, "messages");

    const added = await addDoc(msgsRef, { role, content, createdAt: serverTimestamp() });

    const chatSnap = await getDoc(chatRef);
    const title = chatSnap.exists() ? chatSnap.data()?.title : "New chat";
    if(role === "user" && (title === "New chat" || !title)){
      await setDoc(chatRef, { title: makeTitle(content) }, { merge:true });
    }

    await setDoc(chatRef, { updatedAt: serverTimestamp() }, { merge:true });
    return added.id;
  } catch (err) {
    noteFirestoreError(err);
    return localAppendMessage(chatId, role, content);
  }
}

export async function updateMessage(user, chatId, messageId, content){
  if(!messageId){
    return;
  }

  if(!user || !firestoreHealthy){
    localUpdateMessage(chatId, messageId, content);
    return;
  }

  try {
    const chatRef = doc(db, "users", user.uid, "chats", chatId);
    const msgRef = doc(db, "users", user.uid, "chats", chatId, "messages", messageId);
    await setDoc(msgRef, { content, updatedAt: serverTimestamp() }, { merge: true });
    await setDoc(chatRef, { updatedAt: serverTimestamp() }, { merge:true });
  } catch (err) {
    noteFirestoreError(err);
    localUpdateMessage(chatId, messageId, content);
  }
}

export async function removeMessages(user, chatId, ids = []){
  if(!ids.length){
    return;
  }

  if(!user || !firestoreHealthy){
    localRemoveMessages(chatId, ids);
    return;
  }

  try {
    const chatRef = doc(db, "users", user.uid, "chats", chatId);
    const refs = ids.map((id) => doc(db, "users", user.uid, "chats", chatId, "messages", id));
    await Promise.all(refs.map((r) => deleteDoc(r)));
    await setDoc(chatRef, { updatedAt: serverTimestamp() }, { merge:true });
  } catch (err) {
    noteFirestoreError(err);
    localRemoveMessages(chatId, ids);
  }
}

export async function removeChat(user, chatId){
  if(!user || !firestoreHealthy){
    localRemoveChat(chatId);
    return;
  }

  try {
    const chatRef = doc(db, "users", user.uid, "chats", chatId);
    const msgsRef = collection(db, "users", user.uid, "chats", chatId, "messages");
    const msgsSnap = await getDocs(msgsRef);
    await Promise.all(msgsSnap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(chatRef);
  } catch (err) {
    noteFirestoreError(err);
    localRemoveChat(chatId);
  }
}
