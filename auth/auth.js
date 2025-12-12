import { loginEmail, registerEmail, loginGoogle } from "/shared/auth-core.js";
import { getQueryParam } from "/shared/utils.js";

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const underline = document.querySelector(".tab-underline");

const username = document.getElementById("username");
const password = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const googleBtn = document.getElementById("googleBtn");

const hint = document.getElementById("hint");
const form = document.querySelector(".form");

let mode = "login"; // "login" | "register"

function setHint(text = "") {
  if (!hint) return;
  hint.textContent = text;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  if (googleBtn) googleBtn.disabled = isLoading;

  if (isLoading) {
    submitBtn.style.opacity = "0.75";
    submitBtn.style.cursor = "default";
  } else {
    submitBtn.style.opacity = "";
    submitBtn.style.cursor = "";
  }
}

function setMode(nextMode) {
  mode = nextMode;

  const isLogin = mode === "login";
  loginTab.classList.toggle("active", isLogin);
  registerTab.classList.toggle("active", !isLogin);

  loginTab.setAttribute("aria-selected", String(isLogin));
  registerTab.setAttribute("aria-selected", String(!isLogin));

  // Текст на кнопке — капсом под макет
  submitBtn.textContent = isLogin ? "LOGIN" : "REGISTER";

  // underline
  if (underline) {
    underline.style.transform = isLogin ? "translateX(-44px)" : "translateX(44px)";
  }

  setHint("");
}

async function doRedirect() {
  const returnTo = getQueryParam("return") || "/";
  window.location.href = returnTo;
}

function mapErrorToHint(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid":
      return "Проверь конфигурацию Firebase API key.";
    case "auth/invalid-email":
      return "Некорректный email.";
    case "auth/missing-password":
      return "Введи пароль.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Неверная связка email + пароль.";
    case "auth/user-not-found":
      return "Такого пользователя нет.";
    case "auth/email-already-in-use":
      return "Email уже занят.";
    case "auth/weak-password":
      return "Пароль должен быть длиннее 6 символов.";
    case "auth/network-request-failed":
      return "Нет сети или проблемы с Firebase.";
    default:
      return error?.message || "Auth failed";
  }
}

async function handleSubmit() {
  const u = username.value.trim().toLowerCase();
  const p = password.value; // пароль НЕ тримим

  if (!u || !p) return setHint("Заполни оба поля.");

  try {
    setLoading(true);
    setHint("...");

    if (mode === "login") {
      await loginEmail(u, p);
    } else {
      await registerEmail(u, p, u);
    }

    await doRedirect();
  } catch (err) {
    setHint(mapErrorToHint(err));
  } finally {
    setLoading(false);
  }
}

async function handleGoogle() {
  try {
    setLoading(true);
    setHint("...");

    await loginGoogle();

    await doRedirect();
  } catch (err) {
    setHint(mapErrorToHint(err));
  } finally {
    setLoading(false);
  }
}

// Tabs
loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

// Buttons
submitBtn.addEventListener("click", handleSubmit);
if (googleBtn) googleBtn.addEventListener("click", handleGoogle);

// Enter submit (чтобы работало как норм форма)
if (form) {
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  });
}

// Анимации влёта
requestAnimationFrame(() => {
  document.documentElement.classList.add("loaded");
});

// init
setMode("login");
