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

import { auth, db } from "../firebase.js";

function resolveUid(uid) {
  return uid || auth.currentUser?.uid || null;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (value.toMillis) return value.toMillis();
  return value;
}

export class FirebaseAdapter {
  constructor(firebaseConfig) {
    this.firebaseConfig = firebaseConfig;
    this.isReady = true;
  }

  async getUserProfile(uid) {
    const resolvedUid = resolveUid(uid);
    if (!resolvedUid) return null;
    const profileRef = doc(db, "users", resolvedUid, "profile");
    const snap = await getDoc(profileRef);
    if (!snap.exists()) return null;
    return { uid: resolvedUid, ...snap.data() };
  }

  async upsertUserProfile(profile) {
    const resolvedUid = resolveUid(profile?.uid);
    if (!resolvedUid) return null;
    const profileRef = doc(db, "users", resolvedUid, "profile");
    const payload = {
      uid: resolvedUid,
      displayName: profile.displayName || "",
      avatarUrl: profile.avatarUrl || "",
      avatarDataUrl: profile.avatarDataUrl || "",
      bio: profile.bio || "",
      updatedAt: profile.updatedAt || serverTimestamp(),
    };
    await setDoc(profileRef, payload, { merge: true });
    return { ...payload };
  }

  async listChats(uid) {
    const resolvedUid = resolveUid(uid);
    if (!resolvedUid) return [];
    const chatsRef = collection(db, "users", resolvedUid, "chats");
    const snap = await getDocs(query(chatsRef, orderBy("updatedAt", "desc")));
    return snap.docs.map((docSnap) => ({
      chatId: docSnap.id,
      uid: resolvedUid,
      ...docSnap.data(),
    }));
  }

  async createChat(uid, chatPayload = {}) {
    const resolvedUid = resolveUid(uid);
    if (!resolvedUid) return null;
    const chatsRef = collection(db, "users", resolvedUid, "chats");
    const payload = {
      uid: resolvedUid,
      title: chatPayload.title || "New chat",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(chatsRef, payload);
    return {
      chatId: docRef.id,
      uid: resolvedUid,
      title: payload.title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  async getChat(chatId, uid) {
    const resolvedUid = resolveUid(uid);
    if (!resolvedUid || !chatId) return null;
    const chatRef = doc(db, "users", resolvedUid, "chats", chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      chatId,
      uid: resolvedUid,
      ...data,
      createdAt: normalizeTimestamp(data.createdAt),
      updatedAt: normalizeTimestamp(data.updatedAt),
    };
  }

  async deleteChat(chatId, uid) {
    const resolvedUid = resolveUid(uid);
    if (!resolvedUid || !chatId) return;
    const chatRef = doc(db, "users", resolvedUid, "chats", chatId);
    const msgsRef = collection(db, "users", resolvedUid, "chats", chatId, "messages");
    const msgsSnap = await getDocs(msgsRef);
    await Promise.all(msgsSnap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
    await deleteDoc(chatRef);
  }

  async listMessages(chatId, uid) {
    const resolvedUid = resolveUid(uid);
    if (!resolvedUid || !chatId) return [];
    const msgsRef = collection(db, "users", resolvedUid, "chats", chatId, "messages");
    const snap = await getDocs(query(msgsRef, orderBy("createdAt", "asc")));
    return snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        messageId: docSnap.id,
        chatId,
        ...data,
        createdAt: normalizeTimestamp(data.createdAt),
      };
    });
  }

  async addMessage(chatId, message, uid) {
    const resolvedUid = resolveUid(uid);
    if (!resolvedUid || !chatId || !message) return null;
    const msgsRef = collection(db, "users", resolvedUid, "chats", chatId, "messages");
    const payload = {
      role: message.role,
      content: message.content,
      attachments: message.attachments || [],
      createdAt: serverTimestamp(),
    };
    const docRef = await addDoc(msgsRef, payload);
    const chatRef = doc(db, "users", resolvedUid, "chats", chatId);
    const updates = { updatedAt: serverTimestamp() };
    if (message.role === "user" && message.content) {
      const title = (message.content || "").trim().slice(0, 34);
      updates.title = title || "New chat";
    }
    await setDoc(chatRef, updates, { merge: true });
    return {
      messageId: docRef.id,
      chatId,
      ...payload,
      createdAt: Date.now(),
    };
  }

  async updateChat(chatId, partial, uid) {
    const resolvedUid = resolveUid(uid);
    if (!resolvedUid || !chatId || !partial) return null;
    const chatRef = doc(db, "users", resolvedUid, "chats", chatId);
    const payload = {
      ...partial,
      updatedAt: partial.updatedAt || serverTimestamp(),
    };
    await setDoc(chatRef, payload, { merge: true });
    return payload;
  }
}
