import { watchAuth } from "/shared/auth-core.js";
import { listChats, createChat } from "./chat-store.js";

const chatListEl = document.getElementById("chatList");
const newBtn = document.getElementById("newChatBtn");

let currentUser = null;
let activeChatId = null;

function setActive(id){
  activeChatId = id;
  window.dispatchEvent(new CustomEvent("galen:chatChanged", { detail: { chatId: id } }));
}

async function render(){
  if(!chatListEl) return;

  const chats = await listChats(currentUser);
  chatListEl.innerHTML = "";

  chats.forEach(c => {
    const b = document.createElement("button");
    b.className = "chat-item" + (c.id === activeChatId ? " active" : "");
    b.textContent = c.title || "New chat";
    b.addEventListener("click", () => { setActive(c.id); render(); });
    chatListEl.appendChild(b);
  });

  if(!activeChatId){
    const created = await createChat(currentUser);
    setActive(created.id);
    await render();
  }
}

newBtn?.addEventListener("click", async () => {
  const created = await createChat(currentUser);
  setActive(created.id);
  render();
});

watchAuth(async (user) => {
  currentUser = user || null;
  activeChatId = null;
  await render();
});
