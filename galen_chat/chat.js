import { watchAuth } from "/shared/auth-core.js";
import { loadMessages, appendMessage, createChat } from "./chat-store.js";

const API_URL = "https://galen-chat-proxy.ilyasch2020.workers.dev";
const MODEL = "gpt-4o-mini";

const chatEl = document.getElementById("chat");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message");
const galenBlockEl = document.getElementById("galen-block");
const galenPhraseEl = document.getElementById("galen-phrase");
const sidebarToggleEl = document.getElementById("sidebarToggle");
const sidebarBackdropEl = document.getElementById("sidebarBackdrop");
const focusDropdownEl = document.getElementById("focusDropdown");
const focusTriggerEl = document.getElementById("focusTrigger");
const focusMenuEl = document.getElementById("focusMenu");
const focusValueEl = document.getElementById("focusValue");

const SYSTEM_MESSAGE = {
  role: "system",
  content: `
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
`
};

let history = [SYSTEM_MESSAGE];
let currentUser = null;
let activeChatId = null;
const FOCUS_KEY = "galen_focus_selection";
let currentFocus = loadFocusFromStorage();

// рандомные фразы под аватаром
const randomPhrases = [
  "Я здесь, чтобы разгружать твою голову.",
  "Сегодня оптимизируем хотя бы одну штуку.",
  "Спроси меня что-нибудь про твой день.",
  "Помогу разгрести задачи и хаос.",
  "Чем займёмся: делами, идеями или пиздёжом?"
];

function loadFocusFromStorage() {
  try {
    return localStorage.getItem(FOCUS_KEY) || "Default";
  } catch {
    return "Default";
  }
}

function saveFocusToStorage(value) {
  try {
    localStorage.setItem(FOCUS_KEY, value);
  } catch {}
}

function getFocusSystemMessage(value = currentFocus) {
  return { role: "system", content: `Текущий фокус Galen: ${value}` };
}

function syncFocusHistory() {
  const focusMessage = getFocusSystemMessage();
  const existingIndex = history.findIndex(
    (m) => m.role === "system" && m.content.startsWith("Текущий фокус Galen:")
  );

  if (existingIndex >= 0) {
    history[existingIndex] = focusMessage;
  } else {
    history.splice(1, 0, focusMessage);
  }
}

function renderFocusUI() {
  if (focusValueEl) {
    focusValueEl.textContent = currentFocus;
  }

  focusMenuEl?.querySelectorAll("button[data-value]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === currentFocus);
  });
}

function setFocus(value) {
  currentFocus = value;
  saveFocusToStorage(value);
  renderFocusUI();
  syncFocusHistory();
}

function setRandomPhrase() {
  const phrase =
    randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
  galenPhraseEl.textContent = phrase;
}

setRandomPhrase();
syncFocusHistory();
renderFocusUI();

watchAuth((u) => {
  currentUser = u || null;
});

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

function toggleSidebar() {
  document.body.classList.toggle("sidebar-open");
}

function closeFocusDropdown() {
  focusDropdownEl?.classList.remove("open");
  focusTriggerEl?.setAttribute("aria-expanded", "false");
}

function toggleFocusDropdown(forceState) {
  if (!focusDropdownEl) return;
  const nextState =
    typeof forceState === "boolean"
      ? forceState
      : !focusDropdownEl.classList.contains("open");
  focusDropdownEl.classList.toggle("open", nextState);
  focusTriggerEl?.setAttribute("aria-expanded", nextState ? "true" : "false");
}

sidebarToggleEl?.addEventListener("click", toggleSidebar);
sidebarBackdropEl?.addEventListener("click", closeSidebar);
window.addEventListener("keyup", (e) => {
  if (e.key === "Escape") {
    closeSidebar();
    closeFocusDropdown();
  }
});

focusTriggerEl?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleFocusDropdown();
});

focusMenuEl?.addEventListener("click", (e) => {
  if (!(e.target instanceof HTMLButtonElement)) return;
  const value = e.target.dataset.value;
  if (!value) return;
  setFocus(value);
  toggleFocusDropdown(false);
});

document.addEventListener("click", (e) => {
  if (!focusDropdownEl) return;
  if (!focusDropdownEl.contains(e.target)) {
    closeFocusDropdown();
  }
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
      if (galenBlockEl) {
        galenBlockEl.style.display = "none";
      }
    }, 400);
  } else {
    galenBlockEl.style.display = "";
    galenBlockEl.style.opacity = "0.9";
    galenBlockEl.style.transform = "translateY(0)";
  }
}

function resetHistory() {
  history = [SYSTEM_MESSAGE];
  syncFocusHistory();
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
  history = [
    SYSTEM_MESSAGE,
    ...msgs.map((m) => ({ role: m.role, content: m.content })),
  ];
  syncFocusHistory();
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

  syncFocusHistory();

  toggleGalenBlock(true);

  await appendMessage(currentUser, activeChatId, "user", value);
  window.dispatchEvent(new Event("galen:chatsShouldRefresh"));
  addMessage(value, "user");
  history.push({ role: "user", content: value });
  inputEl.value = "";
  inputEl.focus();

  const loader = addLoader();
  formEl.querySelector("button").disabled = true;

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
    formEl.querySelector("button").disabled = false;
  }
}

async function askGalen(historyMessages) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: historyMessages,
      temperature: 0.6,
      focus: currentFocus,
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
