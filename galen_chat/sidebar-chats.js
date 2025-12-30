import { watchAuth } from "/shared/auth-core.js";
import { listChats, deleteChat, createChat } from "/shared/chat/chatService.js";

const chatListEl = document.getElementById("chatList");
const newBtn = document.getElementById("newChatBtn");
const isChatPage = Boolean(document.getElementById("chat"));
const initialChatId = new URLSearchParams(window.location.search).get("chatId");

let currentUser = null;
let activeChatId = null;

function makeDraftId() {
  return "draft_" + Math.random().toString(36).slice(2, 10);
}

function setActive(id){
  if (!isChatPage) {
    window.location.href = `/galen_chat/?chatId=${id}`;
    return;
  }
  activeChatId = id;
  window.dispatchEvent(new CustomEvent("galen:chatChanged", { detail: { chatId: id } }));
}

async function handleDeleteChat(id, title) {
  const confirmed = window.confirm(
    `Удалить чат "${title || "Без названия"}"? Его сообщения будут удалены.`
  );

  if (!confirmed) return;

  await deleteChat(id);

  if (activeChatId === id) {
    activeChatId = null;
  }

  window.dispatchEvent(new Event("galen:chatsShouldRefresh"));
  await render();
}

async function render(){
  if(!chatListEl) return;

  const chats = await listChats(currentUser?.uid);
  chatListEl.innerHTML = "";

  const activeChatMissing =
    activeChatId && !chats.some((c) => c.chatId === activeChatId);

  // Если выбран черновик, который ещё не сохранён в сторадже, оставляем его активным.
  if (initialChatId && chats.some((c) => c.chatId === initialChatId)) {
    activeChatId = initialChatId;
    setActive(initialChatId);
  } else if (!activeChatId || (activeChatMissing && !activeChatId.startsWith("draft_"))) {
    const fallbackId = chats[0]?.chatId || makeDraftId();
    setActive(fallbackId);
  }

  chats.forEach((c) => {
    const item = document.createElement("div");
    item.className =
      "chat-item" + (c.chatId === activeChatId ? " active" : "");
    item.setAttribute("role", "button");
    item.tabIndex = 0;

    const title = document.createElement("span");
    title.className = "chat-title";
    title.textContent = c.title || "New chat";

    const del = document.createElement("button");
    del.className = "chat-delete";
    del.type = "button";
    del.setAttribute("aria-label", "Удалить чат");
    del.textContent = "✕";

    item.addEventListener("click", () => {
      setActive(c.chatId);
      render();
    });
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setActive(c.chatId);
        render();
      }
    });

    del.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDeleteChat(c.chatId, c.title);
    });

    item.appendChild(title);
    item.appendChild(del);
    chatListEl.appendChild(item);
  });

}

newBtn?.addEventListener("click", async () => {
  if (!isChatPage) {
    const created = await createChat(currentUser?.uid);
    if (created?.chatId) {
      window.location.href = `/galen_chat/?chatId=${created.chatId}`;
    }
    return;
  }
  const draftId = makeDraftId();
  setActive(draftId);
  render();
});

window.addEventListener("galen:chatsShouldRefresh", render);

watchAuth(async (user) => {
  currentUser = user || null;
  activeChatId = null;
  await render();
});
