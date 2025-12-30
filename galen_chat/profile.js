import { watchAuth } from "/shared/auth-core.js";
import {
  ensureUserProfile,
  getUserProfile,
  upsertUserProfile,
} from "/shared/profile/profileService.js";
import { readFileAsDataUrl } from "/shared/chat/attachmentService.js";

const avatarPreviewEl = document.getElementById("profileAvatarPreview");
const avatarInputEl = document.getElementById("profileAvatarInput");
const avatarBtnEl = document.getElementById("profileAvatarBtn");
const nameInputEl = document.getElementById("profileName");
const bioInputEl = document.getElementById("profileBio");
const saveBtnEl = document.getElementById("profileSaveBtn");
const noticeEl = document.getElementById("profileNotice");
const sidebarToggleEl = document.getElementById("sidebarToggle");
const sidebarBackdropEl = document.getElementById("sidebarBackdrop");

let currentUser = null;
let avatarDataUrl = "";

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

function setNotice(message) {
  if (!noticeEl) return;
  noticeEl.textContent = message;
  noticeEl.classList.add("show");
  window.setTimeout(() => noticeEl.classList.remove("show"), 4000);
}

function setAvatarPreview(src, fallbackText = "?") {
  if (!avatarPreviewEl) return;
  if (src) {
    avatarPreviewEl.innerHTML = `<img src="${src}" alt="avatar" />`;
  } else {
    avatarPreviewEl.textContent = fallbackText;
  }
}

async function loadProfile() {
  if (!currentUser?.uid) {
    nameInputEl.value = "";
    bioInputEl.value = "";
    setAvatarPreview("", "?");
    saveBtnEl.disabled = true;
    setNotice("Авторизуйтесь, чтобы редактировать профиль.");
    return;
  }

  const profile = await ensureUserProfile(currentUser);
  nameInputEl.value = profile?.displayName || currentUser.displayName || "";
  bioInputEl.value = profile?.bio || "";
  avatarDataUrl = profile?.avatarDataUrl || "";
  setAvatarPreview(
    avatarDataUrl || profile?.avatarUrl || currentUser.photoURL || "",
    (nameInputEl.value || "U")[0].toUpperCase()
  );
  saveBtnEl.disabled = false;
}

avatarBtnEl?.addEventListener("click", () => avatarInputEl?.click());

avatarInputEl?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setNotice("Загрузите изображение PNG/JPEG/WebP.");
    return;
  }
  avatarDataUrl = await readFileAsDataUrl(file);
  setAvatarPreview(avatarDataUrl, (nameInputEl.value || "U")[0].toUpperCase());
});

saveBtnEl?.addEventListener("click", async () => {
  if (!currentUser?.uid) return;
  const payload = {
    uid: currentUser.uid,
    displayName: nameInputEl.value.trim() || "User",
    avatarDataUrl,
    bio: bioInputEl.value.trim(),
  };
  await upsertUserProfile(payload);
  const updated = await getUserProfile(currentUser.uid);
  setAvatarPreview(
    updated?.avatarDataUrl || updated?.avatarUrl || "",
    (payload.displayName || "U")[0].toUpperCase()
  );
  setNotice("Профиль сохранён.");
  window.dispatchEvent(new Event("galen:profileUpdated"));
});

watchAuth(async (user) => {
  currentUser = user || null;
  await loadProfile();
});
