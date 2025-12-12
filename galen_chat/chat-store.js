import {
  collection, addDoc, doc, setDoc, getDocs, getDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { db } from "/shared/firebase.js";

const LS_KEY = "galen_chat_v1";

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{"chats":{},"order":[]}'); }
  catch { return { chats: {}, order: [] }; }
}
function lsSave(data){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }
function now(){ return Date.now(); }
function makeTitle(text){
  const t = (text||"").trim().replace(/\s+/g," ");
  if(!t) return "New chat";
  return t.length > 34 ? t.slice(0,34) + "…" : t;
}

export async function listChats(user){
  if(!user){
    const data = lsLoad();
    return data.order.map(id => ({ id, title: data.chats[id]?.title || "New chat", updatedAt: data.chats[id]?.updatedAt || 0 }));
  }
  const chatsRef = collection(db, "users", user.uid, "chats");
  const snap = await getDocs(query(chatsRef, orderBy("updatedAt","desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createChat(user){
  if(!user){
    const data = lsLoad();
    const id = "c_" + Math.random().toString(36).slice(2,10);
    data.chats[id] = { title:"New chat", messages:[], createdAt: now(), updatedAt: now() };
    data.order = [id, ...data.order.filter(x=>x!==id)];
    lsSave(data);
    return { id, title: data.chats[id].title };
  }

  const chatsRef = collection(db, "users", user.uid, "chats");
  const docRef = await addDoc(chatsRef, {
    title: "New chat",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { id: docRef.id, title: "New chat" };
}

export async function loadMessages(user, chatId){
  if(!user){
    const data = lsLoad();
    return (data.chats[chatId]?.messages || []).slice();
  }
  const msgsRef = collection(db, "users", user.uid, "chats", chatId, "messages");
  const snap = await getDocs(query(msgsRef, orderBy("createdAt","asc")));
  return snap.docs.map(d => d.data());
}

export async function appendMessage(user, chatId, role, content){
  if(!user){
    const data = lsLoad();
    if(!data.chats[chatId]){
      data.chats[chatId] = { title:"New chat", messages:[], createdAt: now(), updatedAt: now() };
      data.order = [chatId, ...data.order.filter(x=>x!==chatId)];
    }
    data.chats[chatId].messages.push({ role, content, createdAt: now() });

    if(role === "user" && (data.chats[chatId].title === "New chat" || !data.chats[chatId].title)){
      data.chats[chatId].title = makeTitle(content);
    }

    data.chats[chatId].updatedAt = now();
    data.order = [chatId, ...data.order.filter(x=>x!==chatId)];
    lsSave(data);
    return;
  }

  const chatRef = doc(db, "users", user.uid, "chats", chatId);
  const msgsRef = collection(db, "users", user.uid, "chats", chatId, "messages");

  await addDoc(msgsRef, { role, content, createdAt: serverTimestamp() });

  const chatSnap = await getDoc(chatRef);
  const title = chatSnap.exists() ? chatSnap.data()?.title : "New chat";
  if(role === "user" && (title === "New chat" || !title)){
    await setDoc(chatRef, { title: makeTitle(content) }, { merge:true });
  }

  await setDoc(chatRef, { updatedAt: serverTimestamp() }, { merge:true });
}
