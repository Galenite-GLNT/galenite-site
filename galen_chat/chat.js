import { watchAuth } from "/shared/auth-core.js";
import {
  loadMessages,
  appendMessage,
  createChat,
  replaceMessages,
} from "./chat-store.js";

const API_URL = "https://galen-chat-proxy.ilyasch2020.workers.dev";
const RESPONSE_TIMEOUT = 55000;

const chatEl = document.getElementById("chat");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message");
const repeatLastBtn = document.getElementById("repeatLast");
const galenBlockEl = document.getElementById("galen-block");
const galenPhraseEl = document.getElementById("galen-phrase");
const sidebarToggleEl = document.getElementById("sidebarToggle");
const sidebarBackdropEl = document.getElementById("sidebarBackdrop");

const userMessages = [];
let editingState = null;

let history = []; // ✅ больше нет system prompt на фронте
let currentUser = null;
let activeChatId = null;
let activeRequest = null;
let lastRetryMessage = null;
let lastUserMessage = "";
let lastAssistantMessage = null;

// рандомные фразы под аватаром
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
  "Определим цель."
];

function setRandomPhrase() {
  const phrase = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
  if (galenPhraseEl) galenPhraseEl.textContent = phrase;
}

setRandomPhrase();
updateRepeatButtonState();

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

function addMessage(text, role) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;

  const content = document.createElement("div");
  content.className = "msg-content";
  content.textContent = text;
  el.appendChild(content);

  if (role === "user") {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "msg-edit-btn";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startInlineEdit(el, content.textContent || "");
    });
    el.appendChild(editBtn);

    userMessages.push(el);
  }

  chatEl.appendChild(el);
  scrollToBottom();
  updateEditButtonsState();
  return el;
}

function createAssistantMessage(prompt) {
  const el = document.createElement("div");
  el.className = "msg bot";

  const content = document.createElement("div");
  content.className = "msg-content";
  el.appendChild(content);

  const meta = document.createElement("div");
  meta.className = "msg-meta";

  const actions = document.createElement("div");
  actions.className = "msg-actions";

  const stopBtn = document.createElement("button");
  stopBtn.type = "button";
  stopBtn.className = "msg-action-btn msg-stop hidden";
  stopBtn.textContent = "Stop";
  actions.appendChild(stopBtn);

  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "msg-action-btn msg-retry hidden";
  retryBtn.textContent = "Повторить";
  actions.appendChild(retryBtn);

  meta.appendChild(actions);
  el.appendChild(meta);

  chatEl.appendChild(el);
  scrollToBottom();

  const messageObj = { el, content, stopBtn, retryBtn, prompt };
  lastAssistantMessage = messageObj;
  return messageObj;
}

function setAssistantLoading(message) {
  message.content.innerHTML = `
    <div class="msg-loader">
      <span>Galen думает</span>
      <span class="dots">
        <span></span><span></span><span></span>
      </span>
    </div>
  `;
  message.content.classList.add("is-loading");
}

function setAssistantContent(message, text) {
  message.content.textContent = text;
  message.content.classList.remove("is-loading");
}

function toggleStopButton(message, show) {
  if (!message.stopBtn) return;
  if (show) {
    message.stopBtn.classList.remove("hidden");
    message.stopBtn.disabled = false;
  } else {
    message.stopBtn.classList.add("hidden");
    message.stopBtn.disabled = true;
  }
}

function toggleRetryButton(message, show) {
  if (!message.retryBtn) return;
  if (show) {
    message.retryBtn.classList.remove("hidden");
    message.retryBtn.disabled = false;
  } else {
    message.retryBtn.classList.add("hidden");
    message.retryBtn.disabled = true;
  }
}

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

function getLastUserIndex() {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") return i;
  }
  return -1;
}

function refreshLastUserMessage() {
  const idx = getLastUserIndex();
  lastUserMessage = idx >= 0 ? history[idx].content : "";
  updateRepeatButtonState();
}

function updateEditButtonsState() {
  userMessages.forEach((el, idx) => {
    const btn = el.querySelector(".msg-edit-btn");
    if (!btn) return;
    const canEdit = idx === userMessages.length - 1 && !activeRequest;
    btn.disabled = !canEdit;
    btn.classList.toggle("hidden", !canEdit);
  });
}

function cancelInlineEdit() {
  if (!editingState) return;
  const { el, contentEl, editorEl } = editingState;
  contentEl.classList.remove("hidden");
  editorEl.remove();
  el.classList.remove("is-editing");
  editingState = null;
}

async function applyInlineEdit() {
  if (!editingState) return;
  const { el, contentEl, textareaEl, originalText } = editingState;
  const newText = (textareaEl.value || "").trim();
  cancelInlineEdit();

  if (!newText || newText === originalText) return;

  const userIdx = getLastUserIndex();
  if (userIdx === -1) return;

  contentEl.textContent = newText;
  history[userIdx].content = newText;
  history = history.slice(0, userIdx + 1);
  removeLastAssistantBubble();
  refreshLastUserMessage();

  await persistHistory();

  const assistantMessage = createAssistantMessage(newText);
  setAssistantLoading(assistantMessage);
  toggleStopButton(assistantMessage, true);

  processAssistantResponse(assistantMessage);
}

function startInlineEdit(el, currentText) {
  if (activeRequest) return;
  if (userMessages[userMessages.length - 1] !== el) return;
  cancelInlineEdit();

  const contentEl = el.querySelector(".msg-content");
  if (!contentEl) return;

  const editorEl = document.createElement("div");
  editorEl.className = "msg-edit-area";

  const textareaEl = document.createElement("textarea");
  textareaEl.value = currentText;
  textareaEl.rows = 3;

  const actionsEl = document.createElement("div");
  actionsEl.className = "msg-edit-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "msg-edit-cancel";
  cancelBtn.textContent = "Отмена";
  cancelBtn.onclick = cancelInlineEdit;

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "msg-edit-save";
  saveBtn.textContent = "Отправить";
  saveBtn.onclick = applyInlineEdit;

  actionsEl.appendChild(cancelBtn);
  actionsEl.appendChild(saveBtn);

  editorEl.appendChild(textareaEl);
  editorEl.appendChild(actionsEl);

  el.classList.add("is-editing");
  contentEl.classList.add("hidden");
  el.appendChild(editorEl);

  editingState = { el, contentEl, editorEl, textareaEl, originalText: currentText };

  setTimeout(() => textareaEl.focus(), 50);
}

function removeLastAssistantBubble() {
  const bots = Array.from(chatEl.querySelectorAll(".msg.bot"));
  const lastEl = bots[bots.length - 1];
  if (lastEl) {
    lastEl.remove();
  }

  if (history[history.length - 1]?.role === "assistant") {
    history.pop();
  }

  if (lastRetryMessage && lastRetryMessage.el === lastEl) {
    lastRetryMessage = null;
  }
  lastAssistantMessage = null;
}

async function persistHistory() {
  if (!activeChatId) return;
  await replaceMessages(currentUser, activeChatId, history);
  window.dispatchEvent(new Event("galen:chatsShouldRefresh"));
}

function resetHistory() {
  history = [];
}

async function renderLoadedMessages(messages) {
  chatEl.innerHTML = "";
  userMessages.length = 0;
  toggleGalenBlock(messages.length > 0);

  messages.forEach((m) => {
    const roleClass = m.role === "assistant" ? "bot" : m.role;
    addMessage(m.content, roleClass);
  });

  refreshLastUserMessage();
  updateEditButtonsState();
}

window.addEventListener("galen:chatChanged", async (e) => {
  activeChatId = e.detail.chatId;
  closeSidebar();
  resetHistory();

  const msgs = await loadMessages(currentUser, activeChatId);

  // ✅ история только из реальных сообщений чата (без system)
  history = msgs.map((m) => ({ role: m.role, content: m.content }));

  await renderLoadedMessages(msgs);
});

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  await handleSend();
});

inputEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleSend();
  }
});

async function ensureActiveChat() {
  if (activeChatId) return activeChatId;

  const created = await createChat(currentUser);
  activeChatId = created.id;

  window.dispatchEvent(
    new CustomEvent("galen:chatChanged", { detail: { chatId: activeChatId } })
  );

  return activeChatId;
}

async function handleSend() {
  const value = (inputEl.value || "").trim();
  if (!value || activeRequest) return;

  cancelInlineEdit();

  await ensureActiveChat();

  toggleGalenBlock(true);

  await appendMessage(currentUser, activeChatId, "user", value);
  window.dispatchEvent(new Event("galen:chatsShouldRefresh"));

  addMessage(value, "user");

  history.push({ role: "user", content: value });

  refreshLastUserMessage();

  inputEl.value = "";
  inputEl.focus();

  if (lastRetryMessage) toggleRetryButton(lastRetryMessage, false);

  const assistantMessage = createAssistantMessage(value);
  setAssistantLoading(assistantMessage);
  toggleStopButton(assistantMessage, true);

  processAssistantResponse(assistantMessage);
}

async function processAssistantResponse(message) {
  const controller = new AbortController();
  let timedOut = false;
  let abortedByUser = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, RESPONSE_TIMEOUT);

  activeRequest = { controller, timeoutId, message };
  toggleRetryButton(message, false);
  updateEditButtonsState();

  const submitBtn = formEl.querySelector("button[type='submit']");
  if (submitBtn) submitBtn.disabled = true;
  updateRepeatButtonState();

  if (message.stopBtn) {
    message.stopBtn.onclick = () => {
      if (activeRequest?.controller === controller) {
        abortedByUser = true;
        controller.abort();
      }
    };
  }

  try {
    const reply = await askGalen(history, controller);

    setAssistantContent(message, reply);
    toggleStopButton(message, false);

    await appendMessage(currentUser, activeChatId, "assistant", reply);
    window.dispatchEvent(new Event("galen:chatsShouldRefresh"));

    history.push({ role: "assistant", content: reply });
    lastRetryMessage = null;
  } catch (err) {
    console.error(err);
    toggleStopButton(message, false);

    if (controller.signal.aborted) {
      if (abortedByUser) {
        setAssistantContent(message, "Ответ остановлен.");
      } else if (timedOut) {
        setAssistantContent(
          message,
          "Ответ занял слишком много времени. Попробуй повторить запрос."
        );
        enableRetry(message);
      } else {
        setAssistantContent(message, "Запрос прерван.");
      }
      return;
    }

    setAssistantContent(
      message,
      "Что-то сломалось на линии с ядром Galen. Попробуй ещё раз чуть позже."
    );
    enableRetry(message);
  } finally {
    clearTimeout(timeoutId);
    if (activeRequest?.controller === controller) {
      activeRequest = null;
    }
    const btn2 = formEl.querySelector("button[type='submit']");
    if (btn2) btn2.disabled = false;
    updateRepeatButtonState();
    updateEditButtonsState();
  }
}

async function askGalen(historyMessages, controller) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: historyMessages, // ✅ только messages
    }),
    signal: controller?.signal,
  });

  const text = await response.text();

  if (!response.ok) {
    console.error("Proxy error status:", response.status);
    console.error("Proxy error body:", text);
    throw new Error("PROXY_" + response.status);
  }

  const data = JSON.parse(text);

  // фронт всё ещё ожидает chat/completions формат
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error("Bad Galen response:", data);
    throw new Error("BAD_GALEN_RESPONSE");
  }

  return content.trim();
}

function enableRetry(message) {
  lastRetryMessage = message;
  toggleRetryButton(message, true);

  if (!message.retryBtn) return;

  message.retryBtn.onclick = async () => {
    if (message.retryBtn.disabled || activeRequest) return;

    message.retryBtn.disabled = true;
    toggleRetryButton(message, false);
    setAssistantLoading(message);
    toggleStopButton(message, true);

    await processAssistantResponse(message);
  };
}

async function regenerateLastResponse() {
  if (!lastUserMessage || activeRequest) return;

  cancelInlineEdit();

  const userIdx = getLastUserIndex();
  if (userIdx === -1) return;

  history = history.slice(0, userIdx + 1);
  removeLastAssistantBubble();

  await persistHistory();

  const assistantMessage = createAssistantMessage(lastUserMessage);
  setAssistantLoading(assistantMessage);
  toggleStopButton(assistantMessage, true);

  processAssistantResponse(assistantMessage);
}

function updateRepeatButtonState() {
  if (!repeatLastBtn) return;
  repeatLastBtn.disabled = !lastUserMessage || !!activeRequest;
}

repeatLastBtn?.addEventListener("click", async () => {
  await regenerateLastResponse();
});
