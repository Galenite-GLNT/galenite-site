import {
  collection,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
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
  return (data.chats[chatId]?.messages || []).slice();
}

function localAppendMessage(chatId, role, content) {
  const data = lsLoad();
  if (!data.chats[chatId]) {
    data.chats[chatId] = { title: "New chat", messages: [], createdAt: now(), updatedAt: now() };
    data.order = [chatId, ...data.order.filter((x) => x !== chatId)];
  }
  data.chats[chatId].messages.push({ role, content, createdAt: now() });

  if (role === "user" && (data.chats[chatId].title === "New chat" || !data.chats[chatId].title)) {
    data.chats[chatId].title = makeTitle(content);
  }

  data.chats[chatId].updatedAt = now();
  data.order = [chatId, ...data.order.filter((x) => x !== chatId)];
  lsSave(data);
}

function localReplaceMessages(chatId, messages) {
  const data = lsLoad();
  if (!data.chats[chatId]) {
    data.chats[chatId] = { title: "New chat", messages: [], createdAt: now(), updatedAt: now() };
    data.order = [chatId, ...data.order.filter((x) => x !== chatId)];
  }

  data.chats[chatId].messages = messages.map((m) => ({ ...m, createdAt: now() }));
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
    return snap.docs.map(d => d.data());
  } catch (err) {
    noteFirestoreError(err);
    return localLoadMessages(chatId);
  }
}

export async function appendMessage(user, chatId, role, content){
  if(!user || !firestoreHealthy){
    localAppendMessage(chatId, role, content);
    return;
  }

  try {
    const chatRef = doc(db, "users", user.uid, "chats", chatId);
    const msgsRef = collection(db, "users", user.uid, "chats", chatId, "messages");

    await addDoc(msgsRef, { role, content, createdAt: serverTimestamp() });

    const chatSnap = await getDoc(chatRef);
    const title = chatSnap.exists() ? chatSnap.data()?.title : "New chat";
    if(role === "user" && (title === "New chat" || !title)){
      await setDoc(chatRef, { title: makeTitle(content) }, { merge:true });
    }

    await setDoc(chatRef, { updatedAt: serverTimestamp() }, { merge:true });
  } catch (err) {
    noteFirestoreError(err);
    localAppendMessage(chatId, role, content);
  }
}

export async function replaceMessages(user, chatId, messages){
  if(!user || !firestoreHealthy){
    localReplaceMessages(chatId, messages);
    return;
  }

  try {
    const msgsRef = collection(db, "users", user.uid, "chats", chatId, "messages");
    const snap = await getDocs(msgsRef);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));

    for (const m of messages) {
      await addDoc(msgsRef, {
        role: m.role,
        content: m.content,
        createdAt: serverTimestamp(),
      });
    }

    const chatRef = doc(db, "users", user.uid, "chats", chatId);
    await setDoc(chatRef, { updatedAt: serverTimestamp() }, { merge:true });
  } catch (err) {
    noteFirestoreError(err);
    localReplaceMessages(chatId, messages);
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
