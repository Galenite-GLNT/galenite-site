import { watchAuth } from "/shared/auth-core.js";
import { loadMessages, appendMessage, createChat } from "./chat-store.js";

const API_URL = "https://galen-chat-proxy.ilyasch2020.workers.dev";

const chatEl = document.getElementById("chat");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message");
const galenBlockEl = document.getElementById("galen-block");
const galenPhraseEl = document.getElementById("galen-phrase");
const sidebarToggleEl = document.getElementById("sidebarToggle");
const sidebarBackdropEl = document.getElementById("sidebarBackdrop");

let history = []; // ✅ больше нет system prompt на фронте
let currentUser = null;
let activeChatId = null;

// рандомные фразы под аватаром
const randomPhrases = [
  "Я здесь, чтобы разгружать твою голову.",
  "Сегодня оптимизируем хотя бы одну штуку.",
  "Спроси меня что-нибудь про твой день.",
  "Помогу разгрести задачи и хаос.",
  "Чем займёмся: делами, идеями или пиздёжом?",
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
  if (!value) return;

  await ensureActiveChat();

  toggleGalenBlock(true);

  await appendMessage(currentUser, activeChatId, "user", value);
  window.dispatchEvent(new Event("galen:chatsShouldRefresh"));

  addMessage(value, "user");

  history.push({ role: "user", content: value });

  inputEl.value = "";
  inputEl.focus();

  const loader = addLoader();
  const btn = formEl.querySelector("button");
  if (btn) btn.disabled = true;

  try {
    const reply = await askGalen(history);
    loader.remove();

    await appendMessage(currentUser, activeChatId, "assistant", reply);
    window.dispatchEvent(new Event("galen:chatsShouldRefresh"));

    addMessage(reply, "bot");
    history.push({ role: "assistant", content: reply });
  } catch (err) {
    console.error(err);
    loader.remove();
    addMessage(
      "Что-то сломалось на линии с ядром Galen. Попробуй ещё раз чуть позже.",
      "bot"
    );
  } finally {
    const btn2 = formEl.querySelector("button");
    if (btn2) btn2.disabled = false;
  }
}

async function askGalen(historyMessages) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: historyMessages, // ✅ только messages
    }),
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
