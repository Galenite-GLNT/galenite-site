import { watchAuth } from "/shared/auth-core.js";
import {
  loadMessages,
  appendMessage,
  createChat,
  updateMessage,
  removeMessages,
} from "./chat-store.js";

const API_URL = "https://galen-chat-proxy.ilyasch2020.workers.dev";
const TIMEOUT_MS = 55000;
const DRAFT_KEY = "galen_chat_draft_input";

const chatEl = document.getElementById("chat");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message");
const galenBlockEl = document.getElementById("galen-block");
const galenPhraseEl = document.getElementById("galen-phrase");
const sidebarToggleEl = document.getElementById("sidebarToggle");
const sidebarBackdropEl = document.getElementById("sidebarBackdrop");
const searchToggleEl = document.getElementById("searchToggle");
const searchBarEl = document.getElementById("searchBar");
const searchInputEl = document.getElementById("searchInput");
const searchPrevEl = document.getElementById("searchPrev");
const searchNextEl = document.getElementById("searchNext");
const searchCounterEl = document.getElementById("searchCounter");
const searchCloseEl = document.getElementById("searchClose");
const toastEl = document.getElementById("toast");

let history = [];
let currentUser = null;
let activeChatId = null;
let activeAbortController = null;
let activeTimeout = null;
let editingMessageId = null;
let retrying = false;
let searchMatches = [];
let searchIndex = -1;
let draftTimer = null;

const randomPhrases = [
  "Что требуется сейчас?",
  "Сформулируй задачу.",
  "С чего начнём работу?",
  "Какой результат нужен?",
  "Что нужно прояснить?",
  "Над чем работаем?",
  "Готов к работе.",
  "В активном режиме.",
  "Контекст загружен.",
  "Можно начинать.",
  "Ожидаю ввод.",
  "Контекст принят.",
  "Перейдём к сути.",
  "Работаю с этим.",
  "Уточняю входные данные.",
  "Анализ продолжается.",
  "Важен следующий шаг.",
  "Начнём с главного.",
  "Сначала — структура.",
  "Определим цель.",
];

function setRandomPhrase() {
  const phrase = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
  if (galenPhraseEl) galenPhraseEl.textContent = phrase;
}

setRandomPhrase();

watchAuth((u) => {
  currentUser = u || null;
});

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

function toggleSidebar() {
  document.body.classList.toggle("sidebar-open");
}

sidebarToggleEl?.addEventListener("click", toggleSidebar);
sidebarBackdropEl?.addEventListener("click", closeSidebar);
window.addEventListener("keyup", (e) => {
  if (e.key === "Escape") closeSidebar();
});

function scrollToBottom() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

function toggleGalenBlock(hasMessages) {
  if (!galenBlockEl) return;

  if (hasMessages) {
    galenBlockEl.style.opacity = "0";
    galenBlockEl.style.transform = "translateY(-10px)";
    setTimeout(() => {
      if (galenBlockEl) galenBlockEl.style.display = "none";
    }, 400);
  } else {
    galenBlockEl.style.display = "";
    galenBlockEl.style.opacity = "0.9";
    galenBlockEl.style.transform = "translateY(0)";
  }
}

function resetHistory() {
  history = [];
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderContent(content) {
  const safe = escapeHtml(content || "");
  const withBlocks = safe.replace(/```([\s\S]*?)```/g, (_m, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });
  const withInline = withBlocks.replace(/`([^`]+)`/g, "<code>$1</code>");
  const withLinks = withInline.replace(
    /(https?:\/\/[^\s<]+[^<.,;\s])/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  const withBreaks = withLinks.replace(/\n/g, "<br>");
  return withBreaks;
}

function createMessageElement(message) {
  const { id, role, content } = message;
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.dataset.id = id || "";
  el.dataset.content = content || "";

  const actions = document.createElement("div");
  actions.className = "msg-actions";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "msg-action copy";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", () => handleCopy(el.dataset.content || ""));
  actions.appendChild(copyBtn);

  el.appendChild(actions);

  const body = document.createElement("div");
  body.className = "msg-text";
  body.dataset.raw = renderContent(content || "");
  body.innerHTML = body.dataset.raw;
  el.appendChild(body);

  if (role === "assistant" || role === "bot") {
    const footer = document.createElement("div");
    footer.className = "msg-footer";

    const status = document.createElement("span");
    status.className = "msg-status";
    footer.appendChild(status);

    const controls = document.createElement("div");
    controls.className = "msg-controls";
    footer.appendChild(controls);

    el.appendChild(footer);
  }

  if (role === "user") {
    el.classList.add("user-msg");
  } else {
    el.classList.add("bot-msg");
  }

  chatEl.appendChild(el);
  scrollToBottom();
  return el;
}

function updateMessageContent(el, content) {
  const textEl = el.querySelector(".msg-text");
  if (!textEl) return;
  el.dataset.content = content || "";
  textEl.dataset.raw = renderContent(content || "");
  textEl.innerHTML = textEl.dataset.raw;
}

function setMessageStatus(el, label, state) {
  const statusEl = el.querySelector(".msg-status");
  if (!statusEl) return;
  statusEl.textContent = label || "";
  statusEl.dataset.state = state || "";
}

function setControls(el, controls) {
  const ctrls = el.querySelector(".msg-controls");
  if (!ctrls) return;
  ctrls.innerHTML = "";
  controls.forEach((c) => ctrls.appendChild(c));
}

function addLoaderMessage() {
  const el = createMessageElement({ id: "temp", role: "bot", content: "" });
  setMessageStatus(el, "думаю…", "pending");
  const stopBtn = document.createElement("button");
  stopBtn.type = "button";
  stopBtn.className = "msg-action stop";
  stopBtn.textContent = "Stop";
  stopBtn.addEventListener("click", () => abortActiveRequest());
  setControls(el, [stopBtn]);
  el.classList.add("pending");
  return el;
}

function showToast(text) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.hidden = false;
  toastEl.classList.add("visible");
  setTimeout(() => {
    toastEl.classList.remove("visible");
    toastEl.hidden = true;
  }, 1000);
}

function handleCopy(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => showToast("Скопировано"))
    .catch(() => showToast("Не удалось скопировать"));
}

function markEditing(el, editing) {
  if (!el) return;
  el.classList.toggle("editing", !!editing);
}

async function renderLoadedMessages(messages) {
  chatEl.innerHTML = "";
  toggleGalenBlock(messages.length > 0);

  messages.forEach((m) => {
    const roleClass = m.role === "assistant" ? "bot" : m.role;
    const el = createMessageElement({ id: m.id, role: roleClass, content: m.content });
    if (m.role === "assistant") {
      setMessageStatus(el, "готово", "done");
    }
    if (roleClass === "user" && isLastUserMessage(m.id)) {
      addEditButton(el);
    }
  });
}

function isLastUserMessage(id) {
  if (!id) return false;
  const userMessages = history.filter((m) => m.role === "user");
  return userMessages[userMessages.length - 1]?.id === id;
}

function addEditButton(el) {
  const actions = el.querySelector(".msg-actions");
  if (!actions) return;
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "msg-action edit";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => {
    const id = el.dataset.id;
    const msg = history.find((m) => m.id === id);
    if (!msg) return;
    editingMessageId = id;
    markEditing(el, true);
    inputEl.value = msg.content || "";
    autosizeInput();
    inputEl.focus();
  });
  actions.appendChild(editBtn);
}

function clearEditMarks() {
  chatEl.querySelectorAll(".msg.editing").forEach((el) => el.classList.remove("editing"));
}

window.addEventListener("galen:chatChanged", async (e) => {
  activeChatId = e.detail.chatId;
  closeSidebar();
  resetHistory();

  const msgs = await loadMessages(currentUser, activeChatId);
  history = msgs.map((m) => ({ id: m.id, role: m.role, content: m.content }));

  await renderLoadedMessages(msgs);
  clearSearch();
});

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  await handleSend();
});

inputEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

inputEl?.addEventListener("input", () => {
  autosizeInput();
  scheduleDraftSave();
});

function restoreDraft() {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved && inputEl) {
    inputEl.value = saved;
    autosizeInput();
  }
}

restoreDraft();

function scheduleDraftSave() {
  if (!inputEl) return;
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    localStorage.setItem(DRAFT_KEY, inputEl.value || "");
  }, 250);
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function autosizeInput() {
  if (!inputEl) return;
  inputEl.style.height = "auto";
  const maxHeight = inputEl.dataset.maxHeight || 160;
  const nextHeight = Math.min(inputEl.scrollHeight, maxHeight);
  inputEl.style.height = `${nextHeight}px`;
  inputEl.style.overflowY = inputEl.scrollHeight > nextHeight ? "auto" : "hidden";
}

autosizeInput();

async function ensureActiveChat() {
  if (activeChatId && !activeChatId.startsWith("draft_")) return activeChatId;

  const created = await createChat(currentUser);
  activeChatId = created.id;

  window.dispatchEvent(
    new CustomEvent("galen:chatChanged", { detail: { chatId: activeChatId } })
  );

  return activeChatId;
}

function getLastAssistantMessage() {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === "assistant") return history[i];
  }
  return null;
}

function removeAssistantBubble(id) {
  if (!id) return;
  const el = chatEl.querySelector(`.msg[data-id="${id}"]`);
  el?.remove();
}

function getLastUserMessage() {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === "user") return history[i];
  }
  return null;
}

async function handleSend() {
  const value = (inputEl.value || "").trim();
  if (!value) return;

  await ensureActiveChat();
  toggleGalenBlock(true);
  clearSearch();

  const btn = formEl.querySelector("button");
  if (btn) btn.disabled = true;

  let userMessageId = null;
  let userEl = null;
  let removedAssistantId = null;

  let handledEdit = false;
  if (editingMessageId) {
    const lastUser = getLastUserMessage();
    if (lastUser && lastUser.id === editingMessageId) {
      lastUser.content = value;
      await updateMessage(currentUser, activeChatId, editingMessageId, value);
      history = history.map((m) =>
        m.id === editingMessageId ? { ...m, content: value } : m
      );
      userMessageId = editingMessageId;
      userEl = chatEl.querySelector(`.msg[data-id="${editingMessageId}"]`);
      updateMessageContent(userEl, value);
      markEditing(userEl, false);

      const lastAssistant = getLastAssistantMessage();
      if (lastAssistant && history[history.length - 1]?.role === "assistant") {
        removedAssistantId = lastAssistant.id;
        history = history.filter((m) => m.id !== lastAssistant.id);
        removeAssistantBubble(lastAssistant.id);
        await removeMessages(currentUser, activeChatId, [lastAssistant.id]);
      }
      handledEdit = true;
    }
  }

  if (!handledEdit) {
    userMessageId = await appendMessage(currentUser, activeChatId, "user", value);
    window.dispatchEvent(new Event("galen:chatsShouldRefresh"));
    const userMsg = { id: userMessageId, role: "user", content: value };
    history.push(userMsg);
    userEl = createMessageElement(userMsg);
    clearEditMarks();
  }

  if (userEl && !userEl.querySelector(".edit")) {
    addEditButton(userEl);
  }

  inputEl.value = "";
  autosizeInput();
  clearDraft();
  editingMessageId = null;

  const loader = addLoaderMessage();
  let assistantId = null;
  let aborted = false;

  try {
    const reply = await askGalen(history);
    assistantId = await appendMessage(currentUser, activeChatId, "assistant", reply);
    window.dispatchEvent(new Event("galen:chatsShouldRefresh"));
    loader.dataset.id = assistantId;
    updateMessageContent(loader, reply);
    setMessageStatus(loader, "готово", "done");
    setControls(loader, []);
    loader.classList.remove("pending");
    history.push({ id: assistantId, role: "assistant", content: reply });
  } catch (err) {
    aborted = err?.name === "AbortError" || err?.message === "ABORTED";
    loader.dataset.id = loader.dataset.id || removedAssistantId || "temp";
    setControls(loader, []);
    if (aborted) {
      setMessageStatus(loader, "остановлено", "stopped");
    } else {
      setMessageStatus(loader, "ошибка", "error");
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "msg-action retry";
      retryBtn.textContent = "Повторить";
      retryBtn.disabled = retrying;
      retryBtn.addEventListener("click", () => handleRetry(loader, retryBtn));
      setControls(loader, [retryBtn]);
    }
    loader.classList.remove("pending");
  } finally {
    const btn2 = formEl.querySelector("button");
    if (btn2) btn2.disabled = false;
    clearActiveRequest();
  }
}

async function handleRetry(assistantEl, btn) {
  if (retrying) return;
  retrying = true;
  btn.disabled = true;
  const lastUser = getLastUserMessage();
  if (!lastUser) {
    retrying = false;
    return;
  }

  updateMessageContent(assistantEl, "");
  setMessageStatus(assistantEl, "думаю…", "pending");
  const stopBtn = document.createElement("button");
  stopBtn.type = "button";
  stopBtn.className = "msg-action stop";
  stopBtn.textContent = "Stop";
  stopBtn.addEventListener("click", () => abortActiveRequest());
  setControls(assistantEl, [stopBtn]);
  assistantEl.classList.add("pending");

  try {
    const baseHistory = history.filter(
      (m) => !(m.role === "assistant" && m.id === assistantEl.dataset.id)
    );
    const reply = await askGalen(baseHistory);
    const assistantId = await appendMessage(currentUser, activeChatId, "assistant", reply);
    assistantEl.dataset.id = assistantId;
    updateMessageContent(assistantEl, reply);
    setMessageStatus(assistantEl, "готово", "done");
    setControls(assistantEl, []);
    assistantEl.classList.remove("pending");
    history = baseHistory.concat({ id: assistantId, role: "assistant", content: reply });
    window.dispatchEvent(new Event("galen:chatsShouldRefresh"));
  } catch (err) {
    const aborted = err?.name === "AbortError" || err?.message === "ABORTED";
    if (aborted) {
      setMessageStatus(assistantEl, "остановлено", "stopped");
    } else {
      setMessageStatus(assistantEl, "ошибка", "error");
      btn.disabled = false;
      setControls(assistantEl, [btn]);
    }
    assistantEl.classList.remove("pending");
  } finally {
    retrying = false;
    clearActiveRequest();
  }
}

function abortActiveRequest() {
  if (activeAbortController) {
    activeAbortController.abort();
  }
}

function clearActiveRequest() {
  if (activeAbortController) {
    activeAbortController = null;
  }
  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
}

async function askGalen(historyMessages) {
  clearActiveRequest();
  const controller = new AbortController();
  activeAbortController = controller;

  const payload = { messages: historyMessages.map((m) => ({ role: m.role, content: m.content })) };

  const timeoutPromise = new Promise((_, reject) => {
    activeTimeout = setTimeout(() => {
      controller.abort();
      reject(new Error("TIMEOUT"));
    }, TIMEOUT_MS);
  });

  const response = await Promise.race([
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }),
    timeoutPromise,
  ]);

  if (!response || !response.ok) {
    const status = response?.status;
    throw new Error(status ? `PROXY_${status}` : "NETWORK_ERROR");
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error("BAD_JSON");
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("BAD_GALEN_RESPONSE");
  }

  clearActiveRequest();
  return content.trim();
}

function clearSearchHighlights() {
  chatEl.querySelectorAll(".msg-text").forEach((el) => {
    if (el.dataset.raw) {
      el.innerHTML = el.dataset.raw;
    }
    el.closest(".msg")?.classList.remove("match-hit");
  });
}

function clearSearch() {
  searchMatches = [];
  searchIndex = -1;
  clearSearchHighlights();
  if (searchBarEl) searchBarEl.hidden = true;
  if (searchInputEl) searchInputEl.value = "";
}

function highlightMatches(query) {
  clearSearchHighlights();
  if (!query) {
    updateSearchCounter();
    return;
  }

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "gi");

  chatEl.querySelectorAll(".msg-text").forEach((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach((node) => {
      const parent = node.parentNode;
      const text = node.textContent;
      regex.lastIndex = 0;
      if (!regex.test(text)) return;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      text.replace(regex, (match, offset) => {
        const before = text.slice(lastIndex, offset);
        if (before) frag.appendChild(document.createTextNode(before));
        const mark = document.createElement("span");
        mark.className = "search-mark";
        mark.textContent = match;
        frag.appendChild(mark);
        lastIndex = offset + match.length;
      });
      const after = text.slice(lastIndex);
      if (after) frag.appendChild(document.createTextNode(after));
      parent.replaceChild(frag, node);
    });
  });

  searchMatches = Array.from(chatEl.querySelectorAll(".search-mark")).map((mark) => mark.closest(".msg"));
  searchMatches = searchMatches.filter(Boolean);
  searchIndex = searchMatches.length ? 0 : -1;
  scrollToMatch();
  updateSearchCounter();
}

function updateSearchCounter() {
  if (!searchCounterEl) return;
  const total = searchMatches.length;
  const current = searchIndex >= 0 ? searchIndex + 1 : 0;
  searchCounterEl.textContent = `${current}/${total}`;
}

function scrollToMatch(step = 0) {
  if (!searchMatches.length) {
    searchIndex = -1;
    updateSearchCounter();
    return;
  }
  if (step !== 0) {
    searchIndex = (searchIndex + step + searchMatches.length) % searchMatches.length;
  }
  const target = searchMatches[searchIndex];
  if (target) {
    target.classList.add("match-hit");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => target.classList.remove("match-hit"), 700);
  }
  updateSearchCounter();
}

searchToggleEl?.addEventListener("click", () => {
  if (!searchBarEl) return;
  const alreadyOpen = !searchBarEl.hidden;
  if (alreadyOpen) {
    clearSearch();
  } else {
    searchBarEl.hidden = false;
    searchInputEl?.focus();
  }
});

searchInputEl?.addEventListener("input", (e) => {
  highlightMatches(e.target.value.trim());
});

searchInputEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    scrollToMatch(e.shiftKey ? -1 : 1);
  }
});

searchPrevEl?.addEventListener("click", () => scrollToMatch(-1));
searchNextEl?.addEventListener("click", () => scrollToMatch(1));
searchCloseEl?.addEventListener("click", clearSearch);

function scrollToBottomOnLoad() {
  setTimeout(scrollToBottom, 0);
}

scrollToBottomOnLoad();
