import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";
import { db, storage } from "/shared/firebase.js";
import { watchAuth, logout } from "/shared/auth-core.js";

const nicknameInput = document.getElementById("nicknameInput");
const promptInput = document.getElementById("promptInput");
const promptCounter = document.getElementById("promptCounter");
const saveBtn = document.getElementById("saveBtn");
const saveStatus = document.getElementById("saveStatus");
const loadStatus = document.getElementById("loadStatus");
const nicknameStatus = document.getElementById("nicknameStatus");
const avatarImg = document.getElementById("avatarImg");
const avatarInitials = document.getElementById("avatarInitials");
const avatarInput = document.getElementById("avatarInput");
const avatarStatus = document.getElementById("avatarStatus");
const avatarHint = document.getElementById("avatarHint");
const removeAvatarBtn = document.getElementById("removeAvatar");
const previewNickname = document.getElementById("previewNickname");
const previewPrompt = document.getElementById("previewPrompt");
const guard = document.getElementById("guard");
const goChatBtn = document.getElementById("goChat");
const signOutBtn = document.getElementById("signOut");
const mainGrid = document.querySelector("main.grid");
const pageHeader = document.querySelector(".page-header");

const MAX_PROMPT = 50;
const MAX_AVATAR_MB = 5;

let currentUser = null;
let originalData = { nickname: "", userPrompt: "", avatarURL: "" };
let avatarUploadState = "idle";
let profileUnsub = null;

function setGuard(visible) {
  guard.hidden = !visible;
  if (mainGrid) mainGrid.style.display = visible ? "none" : "grid";
  if (pageHeader) pageHeader.style.opacity = visible ? "0.6" : "1";
}

function setStatus(text) {
  saveStatus.textContent = text;
}

function formatInitials(displayName = "") {
  if (!displayName) return "GL";
  const parts = displayName.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function updateAvatar(url) {
  if (url) {
    avatarImg.src = url;
    avatarImg.classList.remove("hidden");
    avatarInitials.classList.add("hidden");
  } else {
    avatarImg.src = "";
    avatarImg.classList.add("hidden");
    avatarInitials.classList.remove("hidden");
  }
}

function updatePreview() {
  const nickname = nicknameInput.value.trim();
  const prompt = promptInput.value.trim();
  previewNickname.textContent = nickname || "—";
  previewPrompt.textContent = prompt || "—";
}

function validate() {
  const nickname = nicknameInput.value.trim();
  const prompt = promptInput.value.trim();

  const nicknameOk = nickname.length <= 28;
  const promptOk = prompt.length <= MAX_PROMPT;

  promptCounter.textContent = `${prompt.length}/${MAX_PROMPT}`;

  let nicknameBadge = "—";
  if (nickname.length > 0) {
    nicknameBadge = "draft";
  }
  if (!nicknameOk) {
    nicknameBadge = "limit";
  }
  nicknameStatus.textContent = nicknameBadge;

  const hasChanges =
    nickname !== (originalData.nickname || "") ||
    prompt !== (originalData.userPrompt || "");

  saveBtn.disabled =
    !hasChanges ||
    !nicknameOk ||
    !promptOk ||
    avatarUploadState === "uploading";

  return { nickname, prompt, nicknameOk, promptOk, hasChanges };
}

function bindInputs() {
  nicknameInput.addEventListener("input", () => {
    validate();
    updatePreview();
  });
  promptInput.addEventListener("input", () => {
    validate();
    updatePreview();
  });
}

async function handleSave() {
  if (!currentUser) return;
  const { nickname, prompt, nicknameOk, promptOk, hasChanges } = validate();
  if (!nicknameOk || !promptOk || !hasChanges) return;

  saveBtn.disabled = true;
  setStatus("Сохраняем...");

  try {
    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        nickname: nickname || null,
        userPrompt: prompt ? prompt.slice(0, MAX_PROMPT) : null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    originalData = { ...originalData, nickname, userPrompt: prompt };
    setStatus("Сохранено");
    nicknameStatus.textContent = nickname ? "saved" : "—";
    validate();
  } catch (err) {
    console.error(err);
    setStatus("Ошибка сохранения");
  }
}

async function loadProfile() {
  if (!currentUser) return;
  loadStatus.textContent = "Загружаем профиль...";

  profileUnsub?.();
  profileUnsub = onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
    const data = snap.data() || {};
    originalData = {
      nickname: data.nickname || "",
      userPrompt: data.userPrompt || "",
      avatarURL: data.avatarURL || data.photoURL || currentUser.photoURL || "",
    };

    nicknameInput.value = originalData.nickname;
    promptInput.value = originalData.userPrompt;
    avatarInitials.textContent = formatInitials(
      originalData.nickname || currentUser.displayName || "Galenite"
    );
    updateAvatar(originalData.avatarURL);
    updatePreview();
    validate();
    loadStatus.textContent = "Профиль загружен";
  });
}

async function processImage(file) {
  if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
    throw new Error("Файл слишком большой");
  }

  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const dx = (size - w) / 2;
  const dy = (size - h) / 2;
  ctx.drawImage(img, dx, dy, w, h);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) return resolve(blob);
        canvas.toBlob(
          (fallback) => {
            if (!fallback)
              return reject(new Error("Не удалось сжать изображение"));
            resolve(fallback);
          },
          file.type || "image/png",
          0.92
        );
      },
      "image/webp",
      0.9
    );
  });
}

async function uploadAvatar(file) {
  if (!currentUser) return;
  avatarUploadState = "uploading";
  avatarStatus.textContent = "Загружаем...";
  avatarHint.textContent = "Сжимаем и отправляем в Storage";
  saveBtn.disabled = true;

  try {
    const blob = await processImage(file);
    const storageRef = ref(storage, `avatars/${currentUser.uid}/avatar.webp`);
    await uploadBytes(storageRef, blob, { contentType: "image/webp" });
    const url = await getDownloadURL(storageRef);

    await setDoc(
      doc(db, "users", currentUser.uid),
      { avatarURL: url, updatedAt: serverTimestamp() },
      { merge: true }
    );

    updateAvatar(url);
    originalData = { ...originalData, avatarURL: url };
    avatarStatus.textContent = "Готово";
  } catch (err) {
    console.error(err);
    avatarStatus.textContent = "Ошибка загрузки";
  } finally {
    avatarUploadState = "idle";
    avatarHint.textContent = "PNG/JPG/WebP, до 5 МБ, будет ужат до 512px.";
    validate();
  }
}

async function removeAvatar() {
  if (!currentUser) return;
  avatarStatus.textContent = "Удаляем...";
  saveBtn.disabled = true;

  try {
    const storageRef = ref(storage, `avatars/${currentUser.uid}/avatar.webp`);
    await deleteObject(storageRef).catch(() => {});
    await setDoc(
      doc(db, "users", currentUser.uid),
      { avatarURL: null, updatedAt: serverTimestamp() },
      { merge: true }
    );
    updateAvatar(null);
    originalData = { ...originalData, avatarURL: null };
    avatarStatus.textContent = "Аватар удалён";
  } catch (err) {
    console.error(err);
    avatarStatus.textContent = "Не удалось удалить";
  } finally {
    validate();
  }
}

watchAuth((user) => {
  currentUser = user || null;
  profileUnsub?.();

  if (!currentUser) {
    setGuard(true);
    loadStatus.textContent = "Требуется авторизация";
    return;
  }

  setGuard(false);
  loadProfile();
});

saveBtn.addEventListener("click", handleSave);

avatarInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  uploadAvatar(file);
});

removeAvatarBtn.addEventListener("click", removeAvatar);
goChatBtn?.addEventListener("click", () => (window.location.href = "/galen_chat"));
signOutBtn?.addEventListener("click", () => logout());

bindInputs();
updatePreview();
validate();
