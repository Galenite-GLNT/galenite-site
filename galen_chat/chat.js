import { watchAuth } from "/shared/auth-core.js";
import { loadMessages, appendMessage, createChat } from "./chat-store.js";

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

let history = []; // ✅ больше нет system prompt на фронте
let currentUser = null;
let activeChatId = null;
let activeRequest = null;
let lastRetryMessage = null;
let lastUserMessage = "";

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
      inputEl.value = content.textContent || "";
      inputEl.focus();
    });
    el.appendChild(editBtn);
  }

  chatEl.appendChild(el);
  scrollToBottom();
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

  return { el, content, stopBtn, retryBtn, prompt };
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

function resetHistory() {
  history = [];
}

async function renderLoadedMessages(messages) {
  chatEl.innerHTML = "";
  toggleGalenBlock(messages.length > 0);

  messages.forEach((m) => {
    const roleClass = m.role === "assistant" ? "bot" : m.role;
    addMessage(m.content, roleClass);
  });

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  lastUserMessage = lastUser?.content || "";
  updateRepeatButtonState();
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

  await ensureActiveChat();

  toggleGalenBlock(true);

  await appendMessage(currentUser, activeChatId, "user", value);
  window.dispatchEvent(new Event("galen:chatsShouldRefresh"));

  addMessage(value, "user");

  lastUserMessage = value;
  updateRepeatButtonState();

  history.push({ role: "user", content: value });

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

function updateRepeatButtonState() {
  if (!repeatLastBtn) return;
  repeatLastBtn.disabled = !lastUserMessage || !!activeRequest;
}

repeatLastBtn?.addEventListener("click", async () => {
  if (!lastUserMessage || activeRequest) return;
  inputEl.value = lastUserMessage;
  await handleSend();
});
