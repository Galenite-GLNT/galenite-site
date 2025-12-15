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
const toneButtonsEl = document.getElementById("toneButtons");
const contextTogglesEl = document.getElementById("contextToggles");
const promptChipsEl = document.getElementById("promptChips");
const toneSummaryEl = document.getElementById("toneSummary");
const contextSummaryEl = document.getElementById("contextSummary");
const insightListEl = document.getElementById("insightList");

const BASE_SYSTEM_PROMPT = `
Ты — Galen, центральный ассистент экосистемы Galenite.

Galenite — модульная операционная система для жизни и бизнеса. Она подключается к финансам, привычкам, здоровью, задачам, дому, работе и коммуникациям.
Твоя цель — убирать хаос из жизни, автоматизировать рутину, помогать в принятии решений и давать чувство «жизни под управлением умной системы».

Тон общения: живой, уверенный, без канцелярита, иногда с лёгким юмором. Важна конкретика и спокойствие.
Всегда начинай ответ с короткой сути или списка действий, потом поясняй детали. Если видишь риск или зависимость — предупреди, но без морали.
`;

const tonePresets = [
  {
    id: "balanced",
    title: "Баланс",
    desc: "50/50 скорость и глубина",
    instruction: "Дай ясный план и пару быстрых шагов, остальное — кратко по делу.",
  },
  {
    id: "short",
    title: "Коротко",
    desc: "Только тезисы",
    instruction: "Ответь тезисами без воды, максимум 4–5 строк, никаких лишних слов.",
  },
  {
    id: "deep",
    title: "Глубоко",
    desc: "Погружение в детали",
    instruction: "Разложи тему слоями: что сделать сейчас, что улучшить, где риски, какие ресурсы нужны.",
  },
];

const contextPresets = [
  {
    id: "autopilot",
    label: "AutoPilot",
    detail: "Режим дня, задачи, дедлайны",
    prompt:
      "Держи фокус на расписании, дедлайнах, приоритетах. Предлагай короткие сценарии и блоки времени.",
  },
  {
    id: "finance",
    label: "Finance",
    detail: "Деньги, подписки",
    prompt: "Смотри на бюджет, траты, подписки и доходы. Предлагай оптимизацию и контроль.",
  },
  {
    id: "health",
    label: "Health",
    detail: "Режим, питание",
    prompt: "Отслеживай сон, питание, движение, воду. Предлагай мягкие шаги без перегруза.",
  },
  {
    id: "relationships",
    label: "Relations",
    detail: "Коммуникации",
    prompt: "Помогай с формулировками, поддержкой, коммуникацией с людьми и детьми.",
  },
  {
    id: "builder",
    label: "Builder",
    detail: "Бизнес и идеи",
    prompt: "Думай как продуктолог и автоматизатор: гипотезы, простые прототипы, воронки и боты.",
  },
];

const quickPrompts = [
  {
    title: "Разложи мой день",
    prompt: "Вот мои планы. Разложи на блоки, учти перерывы и дай 3 коротких правила, чтобы не слиться: ",
  },
  {
    title: "Финансы под контроль",
    prompt: "Посмотри на мои расходы и доходы. Предложи бюджет на месяц, лимиты и быстрые фиксы: ",
  },
  {
    title: "ЗОЖ без фанатизма",
    prompt: "Подбери мягкий план на 2 недели: сон, питание, вода, движение. Хочу без стресса: ",
  },
  {
    title: "Текст для общения",
    prompt: "Помоги сформулировать сообщение (тон — спокойный и человеческий): ",
  },
  {
    title: "Запуск гипотезы",
    prompt: "Есть идея продукта/бота. Разложи гипотезу, минимальный прототип и первые шаги по проверке: ",
  },
  {
    title: "Разгреби хаос",
    prompt: "Сделай ревизию задач, выбери 3 ключевые и предложи порядок действий на сегодня: ",
  },
];

const insightLines = [
  "Где нет ясности — дай структуру. Где много дел — собери в план.",
  "Сначала вытащи приоритеты, потом предложи 1 действие, которое можно сделать за 5 минут.",
  "Отвечай так, будто рядом сидишь: без официоза, но с уверенностью.",
  "Говори, что возьмёшь на себя: формулировки, подсчёты, сценарии.",
  "Если пользователь упоминает усталость — убери давление и предложи минимальный шаг.",
  "Всегда заканчивай вопросом-проверкой, чтобы уточнить, попал ли в цель.",
];

let currentTone = "balanced";
const activeContexts = new Set(["autopilot"]);

let history = [];
let currentUser = null;
let activeChatId = null;

// рандомные фразы под аватаром
const randomPhrases = [
  "Я здесь, чтобы разгружать твою голову.",
  "Сегодня оптимизируем хотя бы одну штуку.",
  "Спроси меня что-нибудь про твой день.",
  "Помогу разгрести задачи и хаос.",
  "Чем займёмся: делами, идеями или пиздёжом?",
  "Подхвачу рутину и предложу короткий план.",
];

function setRandomPhrase() {
  const phrase =
    randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
  galenPhraseEl.textContent = phrase;
}

setRandomPhrase();

refreshSystemMessage();
renderToneButtons();
renderContextToggles();
renderPromptChips();
renderInsights();

function buildSystemMessage() {
  const tone = tonePresets.find((t) => t.id === currentTone) || tonePresets[0];
  const contexts = Array.from(activeContexts)
    .map((id) => contextPresets.find((c) => c.id === id)?.prompt)
    .filter(Boolean);

  const contextText = contexts.length
    ? contexts.join(" ")
    : "Контекста нет — уточняй детали, задавай вопросы и помогай собрать данные.";

  return {
    role: "system",
    content: `${BASE_SYSTEM_PROMPT}\nАктивные контексты: ${contextText}\nСтиль: ${tone.instruction}\nЗаканчивай ответ коротким уточняющим вопросом, чтобы двигаться дальше.`,
  };
}

function refreshSystemMessage() {
  const systemMessage = buildSystemMessage();
  if (!history.length) {
    history = [systemMessage];
  } else {
    history[0] = systemMessage;
  }
  updateSummaries();
}

function updateSummaries() {
  const tone = tonePresets.find((t) => t.id === currentTone);
  if (toneSummaryEl && tone) {
    toneSummaryEl.textContent = tone.desc;
  }

  const activeLabels = Array.from(activeContexts)
    .map((id) => contextPresets.find((c) => c.id === id)?.label)
    .filter(Boolean);

  if (contextSummaryEl) {
    contextSummaryEl.textContent =
      activeLabels.length > 0
        ? `${activeLabels.join(", ")}`
        : "Контекст не выбран";
  }
}

function renderToneButtons() {
  if (!toneButtonsEl) return;
  toneButtonsEl.innerHTML = "";
  tonePresets.forEach((tone) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tone-btn${tone.id === currentTone ? " active" : ""}`;
    btn.innerHTML = `<strong>${tone.title}</strong><span>${tone.desc}</span>`;
    btn.addEventListener("click", () => {
      currentTone = tone.id;
      refreshSystemMessage();
      renderToneButtons();
    });
    toneButtonsEl.appendChild(btn);
  });
}

function renderContextToggles() {
  if (!contextTogglesEl) return;
  contextTogglesEl.innerHTML = "";
  contextPresets.forEach((ctx) => {
    const btn = document.createElement("button");
    const isActive = activeContexts.has(ctx.id);
    btn.type = "button";
    btn.className = `context-tag${isActive ? " active" : ""}`;
    btn.innerHTML = `<span>${ctx.label}</span><small>${ctx.detail}</small>`;
    btn.addEventListener("click", () => {
      if (activeContexts.has(ctx.id)) {
        activeContexts.delete(ctx.id);
      } else {
        activeContexts.add(ctx.id);
      }
      refreshSystemMessage();
      renderContextToggles();
    });
    contextTogglesEl.appendChild(btn);
  });
}

function renderPromptChips() {
  if (!promptChipsEl) return;
  promptChipsEl.innerHTML = "";
  quickPrompts.forEach((prompt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "prompt-chip";
    btn.innerHTML = `<strong>${prompt.title}</strong><span>${prompt.prompt}</span>`;
    btn.addEventListener("click", () => {
      inputEl.value = prompt.prompt;
      inputEl.focus();
      handleSend();
    });
    promptChipsEl.appendChild(btn);
  });
}

function renderInsights() {
  if (!insightListEl) return;
  const shuffled = [...insightLines].sort(() => 0.5 - Math.random());
  const items = shuffled.slice(0, 3);
  insightListEl.innerHTML = items.map((line) => `<li>${line}</li>`).join("");
}

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
  if (e.key === "Escape") {
    closeSidebar();
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
  history = [buildSystemMessage()];
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
    buildSystemMessage(),
    ...msgs.map((m) => ({ role: m.role, content: m.content })),
  ];
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
