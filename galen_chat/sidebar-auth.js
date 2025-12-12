import { watchAuth, logout } from "/shared/auth-core.js";

const el = document.getElementById("sidebarFooter");

function goAuth(){
  const ret = encodeURIComponent("/galen_chat/");
  window.location.href = `/auth/?return=${ret}`;
}

function renderGuest(){
  el.innerHTML = `<button class="sidebar-auth-btn" id="goAuthBtn">Авторизоваться</button>`;
  el.querySelector("#goAuthBtn").addEventListener("click", goAuth);
}

function renderUser(user){
  const name = (user.displayName || "User").trim();
  const photo = user.photoURL || "";
  el.innerHTML = `
    <div class="sidebar-user">
      <div class="avatar">
        ${photo ? `<img src="${photo}" alt="avatar">` : `<span>${(name[0]||"U").toUpperCase()}</span>`}
      </div>
      <div class="user-meta">
        <div class="user-name">${name}</div>
        <button class="user-logout" id="logoutBtn">Выйти</button>
      </div>
    </div>
  `;
  el.querySelector("#logoutBtn").addEventListener("click", async () => { await logout(); });
}

watchAuth((user) => {
  if(!el) return;
  if(!user) renderGuest();
  else renderUser(user);
});
