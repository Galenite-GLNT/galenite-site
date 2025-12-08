const API_KEY = "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"; // <-- сюда свой ключ
const MODEL = "gpt-4o-mini";

const chatEl = document.getElementById("chat");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message");
const galenBlockEl = document.getElementById("galen-block");
const galenPhraseEl = document.getElementById("galen-phrase");

// лёгкая "память" на фронте
const history = [
  {
    role: "system",
    content:
      "Ты — Galen, персональный ассистент владельца системы Galenite. " +
      "Отвечай коротко, по делу, дружелюбно и неформально. Не используй канцелярит."
  }
];

// рандомные фразы под аватаром
const randomPhrases = [
  "Я здесь, чтобы разгружать твою голову.",
  "Сегодня оптимизируем хотя бы одну штуку.",
  "Спроси меня что-нибудь про твой день.",
  "Помогу разгрести задачи и хаос.",
  "Чем займёмся: делами, идеями или пиздёжом?"
];

function setRandomPhrase() {
  const phrase =
    randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
  galenPhraseEl.textContent = phrase;
}

setRandomPhrase();

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

// БЕЗ приветственного сообщения — сразу ждём юзера

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  await handleSend();
});

async function handleSend() {
  const value = (inputEl.value || "").trim();
  if (!value) return;

  // прячем блок с аватаром после первого сообщения
  if (galenBlockEl) {
    galenBlockEl.style.opacity = "0";
    galenBlockEl.style.transform = "translateY(-10px)";
    setTimeout(() => {
      galenBlockEl.style.display = "none";
    }, 400);
  }

  addMessage(value, "user");
  history.push({ role: "user", content: value });
  inputEl.value = "";
  inputEl.focus();

  const loader = addLoader();
  formEl.querySelector("button").disabled = true;

  try {
    const reply = await askGalen(history);
    loader.remove();
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
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: historyMessages,
      temperature: 0.6
    })
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("OpenAI error:", text);
    throw new Error("OpenAI request failed");
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}
