import { watchAuth } from "/shared/auth-core.js";
import { listChats } from "./chat-store.js";

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
    const b = document.createElement("button");
    b.className = "chat-item" + (c.id === activeChatId ? " active" : "");
    b.textContent = c.title || "New chat";
    b.addEventListener("click", () => { setActive(c.id); render(); });
    chatListEl.appendChild(b);
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
