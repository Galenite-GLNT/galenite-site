// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Константы
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCP4G9o0g0pqPwoIYBJ3UEZyrPFt1PEDbE",
  authDomain: "galenite-f1b8e.firebaseapp.com",
  projectId: "galenite-f1b8e",
  storageBucket: "galenite-f1b8e.appspot.com",
  messagingSenderId: "97488613838",
  appId: "1:97488613838:web:24bbacd61a69e3fe8ffb9f",
};

const API_URL = "https://galen-chat-proxy.ilyasch2020.workers.dev";
const MODEL = "gpt-4o-mini";

const BASE_SYSTEM_PROMPT = `
Ты — Galen, центральный ассистент экосистемы Galenite.

Galenite — это модульная операционная система для жизни и бизнеса.
Она подключается к финансам пользователя, привычкам, здоровью, задачам, дому, работе и коммуникациям.
Задача Galenite — убрать хаос из жизни, автоматизировать рутину, помогать в принятии решений и создавать ощущение «жизни под управлением умной системы».

Твоя роль:
— быть спокойным, дружелюбным ассистентом, который говорит так, будто общается с пользователем лично;
— не канцелярить, не звучать как робот, писать по-человечески, иногда с лёгким юмором;
— объяснять Galenite как систему, если пользователь спрашивает;
— помогать разбираться в задачах, днях, идеях, привычках, планировании;
— давать советы мягко, без поучений.

Краткие описания модулей Galenite:
• Finance — анализ расходов, доходов, шаблоны бюджета, прогнозирование, рекомендации.
• Health — питание, шаги, тренировки, сон, вода, режим, постепенное улучшение привычек.
• AutoPilot — ежедневный распорядок, автоматизация дел, расписание, дедлайны, оптимизация времени.
• HouseHub — управление домом, устройства, сценарии, напоминания, домашние процессы.
• Kids — ассистент для детей: обучает, общается, мотивирует, помогает, но не заменяет реальное общение.
• BotHive — система создания кастомных ИИ-ботов и бизнес-автоматизаций.
• Chat — твой личный интерфейс с пользователем, где ты говоришь естественно, быстро и по делу.

Твой тон:
— современный, живой, без официоза;
— можно короткие фразы, но содержательно;
— не перегружай текст;
— будь уверенным, но не токсичным.

Если пользователь задаёт вопрос про Galenite, рассказывай уверенно и понятно, как будто ты — сердце системы.
`;

const MAX_MESSAGES_IN_CONTEXT = 14;
const SUMMARY_TRIGGER_COUNT = 28;
const SUMMARY_RECENT_COUNT = 12;
const LAST_MESSAGE_PREVIEW_LENGTH = 120;
const DEFAULT_TITLE = "Новый диалог";

// State
let firebaseApp;
let auth;
let db;
let storage;
let currentUser = null;
let userProfile = null;
let conversations = [];
let activeConversationId = null;
let messages = [];
let summaryInProgress = false;
let lastSummarizedCount = 0;
let unsubConversations = null;
let unsubMessages = null;

// DOM references
const chatEl = document.getElementById("chat");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message");
const galenBlockEl = document.getElementById("galen-block");
const galenPhraseEl = document.getElementById("galen-phrase");
const conversationListEl = document.getElementById("conversation-list");
const newChatBtn = document.getElementById("new-chat-btn");
const logoutBtn = document.getElementById("logout-btn");
const profileBtn = document.getElementById("profile-btn");
const openAuthBtn = document.getElementById("open-auth-btn");
const lockedOverlay = document.getElementById("locked-overlay");
const lockedLoginBtn = document.getElementById("locked-login-btn");
const activeConversationTitleEl = document.getElementById("active-conversation-title");

// auth UI
const authPanel = document.getElementById("auth-panel");
const authForm = document.getElementById("auth-form");
const displayNameInput = document.getElementById("display-name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authHintEl = document.getElementById("auth-hint");
const modeLoginBtn = document.getElementById("mode-login");
const modeRegisterBtn = document.getElementById("mode-register");
const googleAuthBtn = document.getElementById("google-auth");

// profile modal
const profileModal = document.getElementById("profile-modal");
const closeProfileBtn = document.getElementById("close-profile");
const profileForm = document.getElementById("profile-form");
const profileNameInput = document.getElementById("profile-name");
const profilePromptInput = document.getElementById("profile-prompt");
const profileAvatarInput = document.getElementById("profile-avatar");

// sidebar user
const sidebarAvatarEl = document.getElementById("sidebar-avatar");
const sidebarNameEl = document.getElementById("sidebar-name");
const sidebarEmailEl = document.getElementById("sidebar-email");

// random phrases
const randomPhrases = [
  "Я здесь, чтобы разгружать твою голову.",
  "Сегодня оптимизируем хотя бы одну штуку.",
  "Спроси меня что-нибудь про твой день.",
  "Помогу разгрести задачи и хаос.",
  "Чем займёмся: делами, идеями или пиздёжом?",
];

function setRandomPhrase() {
  const phrase = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
  galenPhraseEl.textContent = phrase;
}

// helpers
function addMessage(text, role) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  chatEl.appendChild(el);
  scrollToBottom();
  return el;
}

function addLoader() {
  const el = document.createElement("div");
  el.className = "msg bot loading";
  el.innerHTML = `
    <span>Galen думает</span>
    <span class="dots">
      <span></span><span></span><span></span>
    </span>
  `;
  chatEl.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

// Firebase init & auth
function initFirebase() {
  firebaseApp = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  storage = getStorage(firebaseApp);

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (!user) {
      conversations = [];
      activeConversationId = null;
      messages = [];
      userProfile = null;
      lastSummarizedCount = 0;
      unsubscribeConversations();
      unsubscribeMessages();
      renderMessages();
      renderConversations();
      updateSidebarUser();
      setAuthVisible(true);
      setLocked(true);
      return;
    }

    setAuthVisible(false);
    setLocked(false);
    await loadUserProfile();
    updateSidebarUser();
    subscribeToConversations();
  });
}

function setAuthVisible(show) {
  if (!authPanel) return;
  authPanel.classList.toggle("active", show);
}

function setLocked(show) {
  if (!lockedOverlay) return;
  lockedOverlay.classList.toggle("active", show);
  if (formEl) {
    const btn = formEl.querySelector("button");
    if (btn) btn.disabled = show;
    if (inputEl) inputEl.disabled = show;
  }
}

async function loadUserProfile() {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    userProfile = snap.data();
  } else {
    userProfile = {
      displayName: currentUser.displayName || "",
      avatarUrl: "",
      defaultPrompt: "",
    };
    await setDoc(userRef, {
      ...userProfile,
      createdAt: serverTimestamp(),
    });
  }
  populateProfileForm();
}

function updateSidebarUser() {
  if (!sidebarNameEl || !sidebarEmailEl || !sidebarAvatarEl) return;
  if (!currentUser) {
    sidebarNameEl.textContent = "Гость";
    sidebarEmailEl.textContent = "Войдите, чтобы сохранять чаты";
    sidebarAvatarEl.textContent = "G";
    sidebarAvatarEl.style.backgroundImage = "none";
    sidebarAvatarEl.innerHTML = "G";
    openAuthBtn?.classList.remove("hidden");
    return;
  }

  const displayName = userProfile?.displayName || currentUser.displayName || "Без имени";
  const email = currentUser.email || "";
  sidebarNameEl.textContent = displayName;
  sidebarEmailEl.textContent = email;

  if (userProfile?.avatarUrl) {
    sidebarAvatarEl.innerHTML = `<img src="${userProfile.avatarUrl}" alt="avatar" />`;
  } else {
    const initial = displayName?.[0]?.toUpperCase?.() || "G";
    sidebarAvatarEl.textContent = initial;
  }

  openAuthBtn?.classList.add("hidden");
}

// Auth handlers
let authMode = "login";

function setAuthMode(mode) {
  authMode = mode;
  modeLoginBtn?.setAttribute("aria-pressed", mode === "login");
  modeRegisterBtn?.setAttribute("aria-pressed", mode === "register");
  if (displayNameInput) {
    displayNameInput.parentElement.style.display =
      mode === "register" ? "flex" : "none";
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!auth) return;
  const email = (emailInput?.value || "").trim();
  const password = (passwordInput?.value || "").trim();
  const displayName = (displayNameInput?.value || "").trim();
  authHintEl.textContent = "";

  try {
    if (authMode === "register") {
      const creds = await createUserWithEmailAndPassword(auth, email, password);
      const nameToUse = displayName || email.split("@")[0];
      await updateProfile(creds.user, { displayName: nameToUse });
      await setDoc(doc(db, "users", creds.user.uid), {
        displayName: nameToUse,
        avatarUrl: "",
        defaultPrompt: "",
        createdAt: serverTimestamp(),
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    console.error(err);
    authHintEl.textContent = err.message || "Не удалось выполнить авторизацию";
  }
}

async function handleGoogleAuth() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    if (result?.user) {
      const userRef = doc(db, "users", result.user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          displayName: result.user.displayName || "",
          avatarUrl: result.user.photoURL || "",
          defaultPrompt: "",
          createdAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    console.error(err);
    authHintEl.textContent = err.message || "Google авторизация недоступна";
  }
}

async function handleLogout() {
  await signOut(auth);
}

// Profile
function toggleProfileModal(open) {
  if (!profileModal) return;
  profileModal.classList.toggle("open", open);
}

function populateProfileForm() {
  if (!profileForm) return;
  profileNameInput.value = userProfile?.displayName || currentUser?.displayName || "";
  profilePromptInput.value = userProfile?.defaultPrompt || "";
}

async function handleProfileSave(event) {
  event.preventDefault();
  if (!currentUser) return;
  const name = profileNameInput.value.trim();
  const prompt = profilePromptInput.value.trim();
  const avatarFile = profileAvatarInput.files?.[0];
  const userRef = doc(db, "users", currentUser.uid);
  let avatarUrl = userProfile?.avatarUrl || "";

  try {
    if (avatarFile) {
      const fileRef = storageRef(storage, `avatars/${currentUser.uid}`);
      await uploadBytes(fileRef, avatarFile);
      avatarUrl = await getDownloadURL(fileRef);
    }

    const payload = {
      displayName: name,
      defaultPrompt: prompt,
      avatarUrl,
    };

    await setDoc(userRef, payload, { merge: true });
    await updateProfile(currentUser, { displayName: name, photoURL: avatarUrl });
    userProfile = { ...userProfile, ...payload };
    updateSidebarUser();
    toggleProfileModal(false);
  } catch (err) {
    console.error(err);
  }
}

// Firestore: conversations & messages
function unsubscribeConversations() {
  if (typeof unsubConversations === "function") {
    unsubConversations();
    unsubConversations = null;
  }
}

function unsubscribeMessages() {
  if (typeof unsubMessages === "function") {
    unsubMessages();
    unsubMessages = null;
  }
}

function subscribeToConversations() {
  if (!currentUser) return;
  unsubscribeConversations();
  const conversationsRef = collection(db, "users", currentUser.uid, "conversations");
  const q = query(conversationsRef, orderBy("updatedAt", "desc"));
  unsubConversations = onSnapshot(q, (snapshot) => {
    conversations = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      };
    });

    if (!activeConversationId && conversations.length > 0) {
      selectConversation(conversations[0].id);
    }

    if (conversations.length === 0) {
      activeConversationId = null;
      messages = [];
      renderMessages();
    }

    renderConversations();
  });
}

function renderConversations() {
  if (!conversationListEl) return;
  conversationListEl.innerHTML = "";

  if (!currentUser) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Войдите, чтобы увидеть сохранённые диалоги";
    conversationListEl.appendChild(empty);
    return;
  }

  if (conversations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Создайте новый диалог";
    conversationListEl.appendChild(empty);
    return;
  }

  conversations.forEach((c) => {
    const item = document.createElement("div");
    item.className = "conversation-item";
    if (c.id === activeConversationId) item.classList.add("active");

    const body = document.createElement("div");
    body.className = "conversation-body";

    const title = document.createElement("div");
    title.className = "conversation-title";
    title.textContent = c.title || DEFAULT_TITLE;

    const preview = document.createElement("div");
    preview.className = "conversation-preview";
    preview.textContent = c.lastMessagePreview || "Пока нет сообщений";

    const meta = document.createElement("div");
    meta.className = "conversation-meta";
    const date = new Date(c.updatedAt || c.createdAt || Date.now());
    meta.textContent = date.toLocaleString();

    body.appendChild(title);
    body.appendChild(preview);
    body.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "conversation-actions";
    const delBtn = document.createElement("button");
    delBtn.textContent = "✕";
    delBtn.title = "Удалить диалог";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteConversation(c.id);
    });
    actions.appendChild(delBtn);

    item.appendChild(body);
    item.appendChild(actions);
    item.addEventListener("click", () => selectConversation(c.id));
    conversationListEl.appendChild(item);
  });
}

async function createConversation() {
  if (!currentUser) return null;
  const conversationRef = collection(db, "users", currentUser.uid, "conversations");
  const docRef = await addDoc(conversationRef, {
    title: DEFAULT_TITLE,
    summary: "",
    lastMessagePreview: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  activeConversationId = docRef.id;
  renderConversations();
  return docRef.id;
}

async function deleteConversation(conversationId) {
  if (!currentUser || !conversationId) return;
  const confirmDelete = window.confirm("Удалить диалог и все сообщения?");
  if (!confirmDelete) return;
  const messagesRef = collection(
    db,
    "users",
    currentUser.uid,
    "conversations",
    conversationId,
    "messages"
  );
  const messagesSnap = await getDocs(messagesRef);
  const deletions = messagesSnap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletions);
  await deleteDoc(doc(db, "users", currentUser.uid, "conversations", conversationId));
  if (activeConversationId === conversationId) {
    activeConversationId = conversations.find((c) => c.id !== conversationId)?.id || null;
    if (activeConversationId) {
      selectConversation(activeConversationId);
    } else {
      messages = [];
      renderMessages();
    }
  }
}

function selectConversation(conversationId) {
  if (!currentUser) return;
  activeConversationId = conversationId;
  lastSummarizedCount = 0;
  const conversation = conversations.find((c) => c.id === conversationId);
  activeConversationTitleEl.textContent = conversation?.title || "Galen Chat";
  subscribeToMessages(conversationId);
  renderConversations();
  setLocked(false);
}

function subscribeToMessages(conversationId) {
  if (!currentUser || !conversationId) return;
  unsubscribeMessages();
  const messagesRef = collection(
    db,
    "users",
    currentUser.uid,
    "conversations",
    conversationId,
    "messages"
  );
  const q = query(messagesRef, orderBy("createdAt", "asc"));
  unsubMessages = onSnapshot(q, (snapshot) => {
    messages = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      };
    });
    renderMessages();
  });
}

function renderMessages() {
  if (!chatEl) return;
  chatEl.innerHTML = "";
  if (galenBlockEl) {
    galenBlockEl.style.display = messages.length === 0 ? "block" : "none";
  }
  messages.forEach((m) => addMessage(m.content, m.role === "assistant" ? "bot" : m.role));
}

async function addMessageToConversation(conversationId, message) {
  const messagesRef = collection(
    db,
    "users",
    currentUser.uid,
    "conversations",
    conversationId,
    "messages"
  );
  const docRef = await addDoc(messagesRef, {
    ...message,
    createdAt: serverTimestamp(),
  });
  const saved = { id: docRef.id, ...message, createdAt: new Date() };
  messages = [...messages, saved];
  renderMessages();
  return saved;
}

async function touchConversationMeta(conversationId, lastContent, opts = {}) {
  if (!currentUser || !conversationId) return;
  const conversationRef = doc(db, "users", currentUser.uid, "conversations", conversationId);
  const updates = {
    updatedAt: serverTimestamp(),
    lastMessagePreview: (lastContent || "").slice(0, LAST_MESSAGE_PREVIEW_LENGTH),
  };
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation?.title || conversation.title === DEFAULT_TITLE) {
    updates.title = generateTitle(lastContent || DEFAULT_TITLE);
  }
  await updateDoc(conversationRef, updates);
}

function generateTitle(text) {
  if (!text) return DEFAULT_TITLE;
  const trimmed = text.trim();
  if (trimmed.length <= 50) return trimmed;
  return trimmed.slice(0, 50) + "…";
}

function getRecentMessagesForContext() {
  return messages.slice(Math.max(messages.length - MAX_MESSAGES_IN_CONTEXT, 0));
}

function buildMessagesForApi({ baseSystemPrompt, userDefaultPrompt, summary, recentMessages }) {
  const result = [
    { role: "system", content: baseSystemPrompt },
  ];
  if (userDefaultPrompt) {
    result.push({ role: "system", content: `Инструкция пользователя: ${userDefaultPrompt}` });
  }
  if (summary) {
    result.push({ role: "system", content: `Краткая сводка предыдущего диалога: ${summary}` });
  }
  recentMessages.forEach((m) => {
    result.push({ role: m.role, content: m.content });
  });
  return result;
}

async function maybeUpdateSummary() {
  if (!currentUser || !activeConversationId) return;
  if (summaryInProgress) return;
  if (messages.length <= SUMMARY_TRIGGER_COUNT) return;
  if (messages.length - lastSummarizedCount < 4) return;

  summaryInProgress = true;
  try {
    const historyPortion = messages.slice(0, Math.max(messages.length - SUMMARY_RECENT_COUNT, 0));
    const historyText = historyPortion
      .map((m) => `${m.role === "user" ? "Пользователь" : "Galen"}: ${m.content}`)
      .join("\n\n");
    if (!historyText) return;

    const summary = await summarizeHistory(historyText);
    const conversationRef = doc(db, "users", currentUser.uid, "conversations", activeConversationId);
    await updateDoc(conversationRef, { summary, updatedAt: serverTimestamp() });
    lastSummarizedCount = messages.length;
  } catch (err) {
    console.error("Summary error", err);
  } finally {
    summaryInProgress = false;
  }
}

async function summarizeHistory(text) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "Ты сервис сжатия истории диалогов. Сожми историю так, чтобы сохранить контекст, факты, решения и договоренности.",
        },
        { role: "user", content: text },
      ],
      temperature: 0.3,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    console.error("Summary proxy error", response.status, body);
    throw new Error("SUMMARY_FAIL");
  }

  const data = JSON.parse(body);
  return data.choices[0].message.content.trim();
}

async function askGalen(messagesForApi) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: messagesForApi,
      temperature: 0.6,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error("Proxy error status:", response.status);
    console.error("Proxy error body:", text);
    throw new Error("PROXY_" + response.status);
  }

  const data = JSON.parse(text);
  return data.choices[0].message.content.trim();
}

// Chat behavior
async function handleSend() {
  const value = (inputEl.value || "").trim();
  if (!value) return;
  if (!currentUser) {
    setAuthVisible(true);
    setLocked(true);
    return;
  }

  if (galenBlockEl) {
    galenBlockEl.style.opacity = "0";
    galenBlockEl.style.transform = "translateY(-10px)";
    setTimeout(() => {
      galenBlockEl.style.display = "none";
    }, 400);
  }

  if (!activeConversationId) {
    await createConversation();
  }

  const loader = addLoader();
  formEl.querySelector("button").disabled = true;
  inputEl.value = "";
  inputEl.focus();

  try {
    await addMessageToConversation(activeConversationId, { role: "user", content: value });
    await touchConversationMeta(activeConversationId, value, { titleFromMessage: true });

    const conversation = conversations.find((c) => c.id === activeConversationId);
    const messagesForApi = buildMessagesForApi({
      baseSystemPrompt: BASE_SYSTEM_PROMPT,
      userDefaultPrompt: userProfile?.defaultPrompt,
      summary: conversation?.summary,
      recentMessages: getRecentMessagesForContext(),
    });

    const reply = await askGalen(messagesForApi);
    loader.remove();
    await addMessageToConversation(activeConversationId, {
      role: "assistant",
      content: reply,
    });
    await touchConversationMeta(activeConversationId, reply);
    await maybeUpdateSummary();
  } catch (err) {
    console.error(err);
    loader.remove();
    addMessage(
      "Что-то сломалось на линии с ядром Galen. Попробуй ещё раз чуть позже.",
      "bot"
    );
  } finally {
    formEl.querySelector("button").disabled = false;
  }
}

// UI listeners
function bindEvents() {
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSend();
  });

  newChatBtn?.addEventListener("click", async () => {
    if (!currentUser) {
      setAuthVisible(true);
      setLocked(true);
      return;
    }
    const id = await createConversation();
    selectConversation(id);
  });

  logoutBtn?.addEventListener("click", handleLogout);
  profileBtn?.addEventListener("click", () => {
    if (!currentUser) {
      setAuthVisible(true);
      return;
    }
    toggleProfileModal(true);
  });

  closeProfileBtn?.addEventListener("click", () => toggleProfileModal(false));
  profileForm?.addEventListener("submit", handleProfileSave);

  openAuthBtn?.addEventListener("click", () => setAuthVisible(true));
  lockedLoginBtn?.addEventListener("click", () => setAuthVisible(true));

  authForm?.addEventListener("submit", handleAuthSubmit);
  googleAuthBtn?.addEventListener("click", handleGoogleAuth);
  modeLoginBtn?.addEventListener("click", () => setAuthMode("login"));
  modeRegisterBtn?.addEventListener("click", () => setAuthMode("register"));
}

function init() {
  setRandomPhrase();
  bindEvents();
  setAuthMode("login");
  initFirebase();
}

init();
