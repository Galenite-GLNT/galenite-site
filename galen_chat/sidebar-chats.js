import { watchAuth } from "/shared/auth-core.js";
import { listChats, deleteChat } from "./chat-store.js";

const chatListEl = document.getElementById("chatList");
const newBtn = document.getElementById("newChatBtn");
const confirmEl = document.getElementById("deleteConfirm");
const confirmYesBtn = confirmEl?.querySelector(".confirm-yes");
const confirmCancelBtn = confirmEl?.querySelector(".confirm-cancel");
const confirmTitleEl = document.getElementById("confirmTitle");
const confirmDescEl = document.getElementById("confirmDesc");

let currentUser = null;
let activeChatId = null;
let pendingDeleteId = null;
let pendingDeleteTitle = "";

function makeDraftId() {
  return "draft_" + Math.random().toString(36).slice(2, 10);
}

function setActive(id){
  activeChatId = id;
  window.dispatchEvent(new CustomEvent("galen:chatChanged", { detail: { chatId: id } }));
}

function closeDeleteConfirm(){
  pendingDeleteId = null;
  pendingDeleteTitle = "";
  if(confirmEl){
    confirmEl.classList.remove("open");
    confirmEl.setAttribute("aria-hidden", "true");
  }
}

async function confirmDeletion(){
  if(!pendingDeleteId) return;

  await deleteChat(currentUser, pendingDeleteId);
  if(activeChatId === pendingDeleteId){
    activeChatId = null;
  }
  window.dispatchEvent(new Event("galen:chatsShouldRefresh"));
  await render();
  closeDeleteConfirm();
}

async function render(){
  if(!chatListEl) return;

  const chats = await listChats(currentUser);
  chatListEl.innerHTML = "";

  if(!activeChatId){
    if(chats.length){
      setActive(chats[0].id);
    } else {
      setActive(makeDraftId());
    }
  }

  chats.forEach(c => {
    const row = document.createElement("div");
    row.className = "chat-row" + (c.id === activeChatId ? " active" : "");

    const b = document.createElement("button");
    b.type = "button";
    b.className = "chat-item";
    b.textContent = c.title || "New chat";
    b.addEventListener("click", () => { setActive(c.id); render(); });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "chat-delete";
    del.setAttribute("aria-label", "Удалить чат");
    del.textContent = "✕";
    del.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      pendingDeleteId = c.id;
      pendingDeleteTitle = c.title || "New chat";

      if(confirmTitleEl){
        confirmTitleEl.textContent = "Удалить чат?";
      }
      if(confirmDescEl){
        confirmDescEl.textContent = `Чат «${pendingDeleteTitle}» будет удалён без возможности восстановления.`;
      }

      if(confirmEl){
        confirmEl.classList.add("open");
        confirmEl.setAttribute("aria-hidden", "false");
      }
      confirmYesBtn?.focus();
    });

    row.appendChild(b);
    row.appendChild(del);
    chatListEl.appendChild(row);
  });

}

newBtn?.addEventListener("click", async () => {
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

confirmYesBtn?.addEventListener("click", confirmDeletion);
confirmCancelBtn?.addEventListener("click", closeDeleteConfirm);
confirmEl?.addEventListener("click", (evt) => {
  if(evt.target === confirmEl){
    closeDeleteConfirm();
  }
});
window.addEventListener("keydown", (evt) => {
  if(evt.key === "Escape" && confirmEl?.classList.contains("open")){
    closeDeleteConfirm();
  }
});
