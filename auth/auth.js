import { loginEmail, registerEmail, loginGoogle } from "/shared/auth-core.js";
import { getQueryParam } from "/shared/utils.js";

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const username = document.getElementById("username");
const password = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const googleBtn = document.getElementById("googleBtn");

let isLogin = true;

loginTab.onclick = () => {
  isLogin = true;
  loginTab.classList.add("active");
  registerTab.classList.remove("active");
  submitBtn.textContent = "Login";
};

registerTab.onclick = () => {
  isLogin = false;
  registerTab.classList.add("active");
  loginTab.classList.remove("active");
  submitBtn.textContent = "Register";
};

submitBtn.onclick = async () => {
  const u = username.value.trim();
  const p = password.value.trim();
  if (!u || !p) return alert("Fill both fields");

  try {
    if (isLogin) await loginEmail(u, p);
    else await registerEmail(u, p, u);

    const returnTo = getQueryParam("return") || "/";
    window.location.href = returnTo;
  } catch (err) {
    alert(err.message || "Auth failed");
  }
};

googleBtn.onclick = async () => {
  try {
    await loginGoogle();
    const returnTo = getQueryParam("return") || "/";
    window.location.href = returnTo;
  } catch (err) {
    alert(err.message || "Google Auth failed");
  }
};
