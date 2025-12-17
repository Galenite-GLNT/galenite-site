import { watchAuth } from "/shared/auth-core.js";
import { listChats, deleteChat } from "./chat-store.js";

const chatListEl = document.getElementById("chatList");
const newBtn = document.getElementById("newChatBtn");

let currentUser = null;
let activeChatId = null;

function makeDraftId() {
  return "draft_" + Math.random().toString(36).slice(2, 10);
}

function setActive(id){
  activeChatId = id;
  window.dispatchEvent(new CustomEvent("galen:chatChanged", { detail: { chatId: id } }));
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
      await deleteChat(currentUser, c.id);
      if(activeChatId === c.id){
        activeChatId = null;
      }
      window.dispatchEvent(new Event("galen:chatsShouldRefresh"));
      await render();
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
