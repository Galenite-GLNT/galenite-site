import { watchAuth } from "/shared/auth-core.js";
import {
  listMessages,
  addMessage,
  createChat,
  getChat,
} from "/shared/chat/chatService.js";
import {
  ensureUserProfile,
  getUserProfile,
} from "/shared/profile/profileService.js";
import {
  extractPdfText,
  formatBytes,
  readFileAsDataUrl,
  validateAttachment,
} from "/shared/chat/attachmentService.js";

const API_URL = "https://galen-chat-proxy.ilyasch2020.workers.dev";

const chatEl = document.getElementById("chat");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message");
const sendBtnEl = document.getElementById("send");
const attachmentInputEl = document.getElementById("attachmentInput");
const attachmentListEl = document.getElementById("attachmentList");
const attachmentBtnEl = document.getElementById("attachmentBtn");
const chatNoticeEl = document.getElementById("chatNotice");
const galenBlockEl = document.getElementById("galen-block");
const galenPhraseEl = document.getElementById("galen-phrase");
const sidebarToggleEl = document.getElementById("sidebarToggle");
const sidebarBackdropEl = document.getElementById("sidebarBackdrop");

let history = [];
let currentUser = null;
let currentProfile = null;
let activeChatId = null;
let pendingAttachments = [];
let noticeTimer = null;

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

watchAuth(async (u) => {
  currentUser = u || null;
  currentProfile = currentUser ? await ensureUserProfile(currentUser) : null;
});

window.addEventListener("galen:profileUpdated", async () => {
  if (!currentUser?.uid) return;
  currentProfile = await getUserProfile(currentUser.uid);
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

function showNotice(message) {
  if (!chatNoticeEl) return;
  chatNoticeEl.textContent = message;
  chatNoticeEl.classList.add("show");
  if (noticeTimer) window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    chatNoticeEl.classList.remove("show");
  }, 4200);
}

function renderAttachmentChip(attachment) {
  const el = document.createElement("div");
  el.className = "attachment-chip";
  el.innerHTML = `
    <span class="attachment-type">${attachment.type === "image" ? "🖼" : "📄"}</span>
    <span class="attachment-name">${attachment.name}</span>
    <span class="attachment-size">${formatBytes(attachment.size)}</span>
  `;
  return el;
}

function renderMessage(message) {
  const el = document.createElement("div");
  const roleClass = message.role === "assistant" ? "bot" : message.role;
  el.className = `msg ${roleClass}`;

  const contentEl = document.createElement("div");
  contentEl.className = "msg-content";
  contentEl.textContent = message.content;
  el.appendChild(contentEl);

  if (message.attachments?.length) {
    const attachmentsEl = document.createElement("div");
    attachmentsEl.className = "msg-attachments";
    message.attachments.forEach((attachment) => {
      attachmentsEl.appendChild(renderAttachmentChip(attachment));
    });
    el.appendChild(attachmentsEl);
  }

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
    renderMessage(m);
  });
}

window.addEventListener("galen:chatChanged", async (e) => {
  activeChatId = e.detail.chatId;
  closeSidebar();
  resetHistory();

  const msgs = await listMessages(activeChatId);
  history = msgs.map((m) => ({
    role: m.role,
    content: m.content,
    attachments: m.attachments || [],
  }));

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
  if (activeChatId && !activeChatId.startsWith("draft_")) return activeChatId;

  const created = await createChat(currentUser?.uid);
  activeChatId = created.chatId;

  window.dispatchEvent(
    new CustomEvent("galen:chatChanged", { detail: { chatId: activeChatId } })
  );

  return activeChatId;
}

function sanitizeAttachment(attachment) {
  return {
    id: attachment.id,
    type: attachment.type,
    name: attachment.name,
    mime: attachment.mime,
    size: attachment.size,
    dataUrl: attachment.type === "image" ? attachment.dataUrl : undefined,
    pdfText: attachment.pdfText || "",
    pageCount: attachment.pageCount || null,
    createdAt: attachment.createdAt,
  };
}

function buildUserText(message) {
  const attachments = message.attachments || [];
  if (!attachments.length) return message.content || "";

  const images = attachments.filter((item) => item.type === "image");
  const pdfs = attachments.filter((item) => item.type === "pdf");
  const parts = [];

  if (images.length) {
    parts.push(
      `Изображения: ${images.map((img) => img.name).join(", ")}`
    );
  }

  if (pdfs.length) {
    parts.push(
      `PDF: ${pdfs
        .map(
          (pdf) =>
            `${pdf.name}${pdf.pageCount ? `, ${pdf.pageCount} стр.` : ""}`
        )
        .join("; ")}`
    );

    const pdfTexts = pdfs
      .map((pdf) => pdf.pdfText)
      .filter(Boolean)
      .join("\n\n");
    if (pdfTexts) {
      parts.push(`Текст из PDF:\n${pdfTexts}`);
    } else {
      parts.push("Текст из PDF не извлечён, отправляем файл как вложение.");
    }
  }

  const baseText = message.content?.trim() || "Сообщение с вложениями.";
  return parts.length ? `${baseText}\n\n${parts.join("\n")}` : baseText;
}

function buildApiMessages(historyMessages) {
  return historyMessages.map((message) => {
    if (message.role !== "user") {
      return { role: message.role, content: message.content };
    }

    const text = buildUserText(message);
    const images = (message.attachments || []).filter(
      (item) => item.type === "image" && item.dataUrl
    );

    if (images.length) {
      return {
        role: "user",
        content: [
          { type: "text", text },
          ...images.map((img) => ({
            type: "image_url",
            image_url: { url: img.dataUrl },
          })),
        ],
      };
    }

    return { role: "user", content: text };
  });
}

async function prepareRequestAttachments(attachments) {
  const result = [];
  for (const attachment of attachments) {
    if (attachment.type === "image") {
      result.push({
        id: attachment.id,
        type: attachment.type,
        name: attachment.name,
        mime: attachment.mime,
        size: attachment.size,
        dataUrl: attachment.dataUrl,
      });
    } else if (attachment.type === "pdf") {
      const payload = {
        id: attachment.id,
        type: attachment.type,
        name: attachment.name,
        mime: attachment.mime,
        size: attachment.size,
        pdfText: attachment.pdfText || "",
        pageCount: attachment.pageCount || null,
      };
      if (!attachment.pdfText && attachment.file) {
        payload.dataUrl = await readFileAsDataUrl(attachment.file);
      }
      result.push(payload);
    }
  }
  return result;
}

function renderAttachmentList() {
  if (!attachmentListEl) return;
  attachmentListEl.innerHTML = "";
  pendingAttachments.forEach((attachment) => {
    const chip = document.createElement("div");
    chip.className = "pending-attachment";
    chip.innerHTML = `
      <span class="attachment-type">${attachment.type === "image" ? "🖼" : "📄"}</span>
      <span class="attachment-name">${attachment.name}</span>
      <span class="attachment-size">${formatBytes(attachment.size)}</span>
      <button type="button" class="attachment-remove" aria-label="Удалить">✕</button>
    `;
    chip.querySelector(".attachment-remove").addEventListener("click", () => {
      pendingAttachments = pendingAttachments.filter((item) => item.id !== attachment.id);
      renderAttachmentList();
    });
    attachmentListEl.appendChild(chip);
  });
  attachmentListEl.classList.toggle("visible", pendingAttachments.length > 0);
}

async function handleFiles(files) {
  const list = Array.from(files || []);
  for (const file of list) {
    const validation = validateAttachment(file);
    if (!validation.ok) {
      showNotice(validation.error);
      continue;
    }

    if (validation.type === "image") {
      const dataUrl = await readFileAsDataUrl(file);
      pendingAttachments.push({
        id: `att_${Math.random().toString(36).slice(2, 10)}`,
        type: "image",
        name: file.name,
        mime: file.type,
        size: file.size,
        dataUrl,
        createdAt: Date.now(),
        file,
      });
    } else if (validation.type === "pdf") {
      const pdf = await extractPdfText(file);
      if (pdf.error) {
        showNotice("Не удалось извлечь текст из PDF. Отправим как вложение.");
      }
      pendingAttachments.push({
        id: `att_${Math.random().toString(36).slice(2, 10)}`,
        type: "pdf",
        name: file.name,
        mime: file.type,
        size: file.size,
        pdfText: pdf.text || "",
        pageCount: pdf.pageCount || null,
        createdAt: Date.now(),
        file,
      });
    }
  }
  renderAttachmentList();
}

attachmentBtnEl?.addEventListener("click", () => {
  attachmentInputEl?.click();
});

attachmentInputEl?.addEventListener("change", (event) => {
  handleFiles(event.target.files);
  event.target.value = "";
});

async function handleSend() {
  const value = (inputEl.value || "").trim();
  if (!value && pendingAttachments.length === 0) return;

  await ensureActiveChat();

  toggleGalenBlock(true);

  const userContent = value || "Отправляю вложения.";
  const userMessage = {
    role: "user",
    content: userContent,
    attachments: pendingAttachments.map(sanitizeAttachment),
  };

  await addMessage(activeChatId, userMessage);
  window.dispatchEvent(new Event("galen:chatsShouldRefresh"));

  renderMessage(userMessage);

  history.push(userMessage);

  inputEl.value = "";
  inputEl.focus();

  const loader = addLoader();
  if (sendBtnEl) sendBtnEl.disabled = true;

  try {
    const requestAttachments = await prepareRequestAttachments(pendingAttachments);
    pendingAttachments = [];
    renderAttachmentList();

    const reply = await askGalen(history, requestAttachments);
    loader.remove();

    const assistantMessage = {
      role: "assistant",
      content: reply,
      attachments: [],
    };
    await addMessage(activeChatId, assistantMessage);
    window.dispatchEvent(new Event("galen:chatsShouldRefresh"));

    renderMessage(assistantMessage);
    history.push(assistantMessage);
  } catch (err) {
    console.error(err);
    loader.remove();
    renderMessage({
      role: "assistant",
      content:
        "Что-то сломалось на линии с ядром Galen. Попробуй ещё раз чуть позже.",
      attachments: [],
    });
  } finally {
    if (sendBtnEl) sendBtnEl.disabled = false;
  }
}

async function askGalen(historyMessages, attachments) {
  const chat = await getChat(activeChatId);
  const profile = currentProfile || (currentUser ? await getUserProfile(currentUser.uid) : null);
  const systemMessage = {
    role: "system",
    content: `Профиль пользователя: uid=${currentUser?.uid || "guest"}, имя=${
      profile?.displayName || currentUser?.displayName || "User"
    }, bio=${profile?.bio || "не указано"}.\nЧат: id=${
      chat?.chatId || activeChatId
    }, title=${chat?.title || "New chat"}.`,
  };

  const preparedMessages = buildApiMessages(historyMessages);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [systemMessage, ...preparedMessages],
      attachments,
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
