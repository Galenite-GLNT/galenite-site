import { loadState, saveState } from "./store.js";
import { toast } from "./components/toast.js";

import { renderDashboard } from "./components/view-dashboard.js";
import { renderFood } from "./components/view-food.js";
import { renderWater } from "./components/view-water.js";
import { renderSleep } from "./components/view-sleep.js";
import { renderSettings } from "./components/view-settings.js";

const ICONS = {
  menu: "./assets/icons/menu.svg",
  dashboard: "./assets/icons/dashboard.svg",
  food: "./assets/icons/food.svg",
  water: "./assets/icons/water.svg",
  sleep: "./assets/icons/sleep.svg",
  settings: "./assets/icons/settings.svg",
  notes: "./assets/icons/notes.svg",
  calories: "./assets/icons/calories.svg",
  protein: "./assets/icons/protein.svg",
  fat: "./assets/icons/fat.svg",
  carbs: "./assets/icons/carbs.svg",
};

const ROUTES = [
  { id:"dashboard", label:"Обзор", icon: ICONS.dashboard, mobile:false },
  { id:"food", label:"Еда", icon: ICONS.food, mobile:true },
  { id:"sleep", label:"Сон", icon: ICONS.sleep, mobile:true },
  { id:"water", label:"Вода", icon: ICONS.water, mobile:true },
  { id:"settings", label:"Настройки", icon: ICONS.settings, mobile:false },
];

const sidebar = document.getElementById("sidebar");
const main = document.getElementById("main");
const title = document.getElementById("pageTitle");
const subtitle = document.getElementById("pageSub");
const hotbar = document.getElementById("hotbar");
const btnMenu = document.getElementById("btnMenu");

let state = loadState();
let route = getInitialRoute();

function setRoute(id){
  route = id;
  history.replaceState(null, "", `#${id}`);
  render();
}

function onUpdate(next){
  state = next;
  saveState(state);
  renderContentOnly();
}

function render(){
  renderSidebar();
  renderTopbar();
  renderContentOnly();
  renderHotbar();

  if(window.innerWidth <= 760){
    sidebar.classList.remove("is-open");
  }
}

function renderContentOnly(){
  main.innerHTML = "";
  main.appendChild(getView(route));
  setActiveStates();
}

function renderSidebar(){
  const nav = sidebar.querySelector(".nav");
  nav.innerHTML = "";
  for(const r of ROUTES){
    const item = document.createElement("a");
    item.href = `#${r.id}`;
    item.className = "nav__item";
    item.innerHTML = `
      <span class="nav__icon"><img src="${r.icon}" alt=""></span>
      <span>${r.label}</span>
    `;
    item.addEventListener("click", (e)=>{
      e.preventDefault();
      setRoute(r.id);
    });
    nav.appendChild(item);
  }
}

function renderTopbar(){
  const r = ROUTES.find(x=>x.id===route) || ROUTES[0];
  title.textContent = r.label;
  subtitle.textContent = state.day;

  btnMenu.onclick = ()=> sidebar.classList.toggle("is-open");

  document.getElementById("btnExport").onclick = ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glnt-health-${state.day}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("ok","Экспорт","Файл с данными сохранён.");
  };

  document.getElementById("btnReset").onclick = ()=>{
    localStorage.removeItem("glnt.health.v4");
    state = loadState();
    toast("warn","Сброс","Локальные данные очищены.");
    render();
  };
}

function syncNutritionFromEntries(){
  const sum = state.nutrition.entries.reduce((acc,e)=>{
    acc.kcal += Number(e.kcal) || 0;
    acc.protein += Number(e.protein) || 0;
    acc.fat += Number(e.fat) || 0;
    acc.carbs += Number(e.carbs) || 0;
    return acc;
  }, {kcal:0, protein:0, fat:0, carbs:0});
  state.nutrition.kcal = sum.kcal;
  state.nutrition.protein = sum.protein;
  state.nutrition.fat = sum.fat;
  state.nutrition.carbs = sum.carbs;
  onUpdate(state);
}

function renderHotbar(){
  hotbar.innerHTML = "";
  const mobileRoutes = ROUTES.filter(r=>r.mobile);
  for(const r of mobileRoutes){
    const item = document.createElement("button");
    item.type = "button";
    item.className = "hotbar__item";
    item.innerHTML = `<img src="${r.icon}" alt=""><div>${r.label}</div>`;
    item.addEventListener("click", ()=>setRoute(r.id));
    hotbar.appendChild(item);
  }
  setActiveStates();
}

function setActiveStates(){
  sidebar.querySelectorAll(".nav__item").forEach(a=>{
    const id = (a.getAttribute("href")||"").replace("#","");
    a.classList.toggle("is-active", id === route);
  });
  const mobileRoutes = ROUTES.filter(r=>r.mobile);
  hotbar.querySelectorAll(".hotbar__item").forEach((b,i)=>{
    b.classList.toggle("is-active", mobileRoutes[i]?.id === route);
  });
}

function getView(id){
  switch(id){
    case "food": return renderFood(state, ICONS);
    case "water": return renderWater(state, ICONS);
    case "sleep": return renderSleep(state, ICONS);
    case "settings": return renderSettings(state, ICONS, onUpdate);
    default: return renderDashboard(state, ICONS);
  }
}

function getInitialRoute(){
  const hash = (location.hash || "").replace("#","").trim();
  return ROUTES.some(r=>r.id===hash) ? hash : "dashboard";
}

window.addEventListener("hashchange", ()=>{
  const next = getInitialRoute();
  if(next !== route) setRoute(next);
});
window.addEventListener("keydown", (e)=>{
  if(e.key === "Escape") sidebar.classList.remove("is-open");
});

window.addEventListener("glnt:food:changed", syncNutritionFromEntries);

render();
