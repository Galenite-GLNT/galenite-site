import { apiFetch } from '/shared/config.js';

const goals = { calories: 2200, water: 2500, sleep: 8 };
const cards = document.getElementById('cards');
const statusLine = document.getElementById('statusLine');
const todayLine = document.getElementById('todayLine');
const coach = document.getElementById('coach');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');

const LOGS_KEY = 'glnt.health.logs.v1';

function loadLogs() {
  try {
    return JSON.parse(localStorage.getItem(LOGS_KEY) || '{"water":[],"sleep":[],"weight":[],"calories":[]}');
  } catch {
    return { water: [], sleep: [], weight: [], calories: [] };
  }
}

function saveLogs(logs) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sameDay(iso) {
  return String(iso || '').slice(0, 10) === todayIso();
}

function computeSummary(logs) {
  const calories = logs.calories.filter((x) => sameDay(x.datetime)).reduce((acc, x) => acc + Number(x.kcal || 0), 0);
  const water = logs.water.filter((x) => sameDay(x.datetime)).reduce((acc, x) => acc + Number(x.ml || 0), 0);
  const sleepToday = logs.sleep.filter((x) => sameDay(x.datetime)).at(-1);
  const sleepTrend = logs.sleep.slice(-7).map((x) => Number((Number(x.minutes || 0) / 60).toFixed(1)));
  const weightTrend = logs.weight.slice(-14).map((x) => Number(x.kg || 0));
  return {
    calories,
    water,
    sleepHours: Number(((sleepToday?.minutes || 0) / 60).toFixed(1)),
    sleepTrend,
    weight: logs.weight.at(-1)?.kg || 0,
    weightTrend,
  };
}

todayLine.textContent = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

document.getElementById('logoutBtn').onclick = async () => {
  await apiFetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/auth/';
};
document.getElementById('closeModal').onclick = () => modal.classList.add('hidden');

function ring(percent, text) {
  return `<div class="ring" style="--p:${Math.min(100, percent)}%"><span>${text}</span></div>`;
}

function bars(data) {
  const list = data.length ? data : [5, 6, 7, 6, 8, 7, 7];
  const max = Math.max(1, ...list);
  return `<div class="bars">${list.map((v) => `<div class="bar" style="height:${(v / max) * 100}%"></div>`).join('')}</div>`;
}

function sparkline(data) {
  if (!data.length) return '<div class="muted">Добавьте вес</div>';
  const max = Math.max(...data);
  const min = Math.min(...data);
  const points = data.map((v, i) => `${(i / (data.length - 1 || 1)) * 100},${50 - ((v - min) / (max - min || 1)) * 40}`).join(' ');
  return `<svg class="spark" viewBox="0 0 100 50"><polyline fill="none" stroke="#111827" stroke-width="2" points="${points}"/></svg>`;
}

async function searchFood(query) {
  const response = await apiFetch(`/api/food/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

function openModal(type, logs) {
  modal.classList.remove('hidden');

  if (type === 'water') {
    modalContent.innerHTML = `<h2>Вода</h2><input id='waterMl' type='number' placeholder='мл'><button class='primary' id='saveWater'>Добавить</button>`;
    document.getElementById('saveWater').onclick = () => {
      logs.water.push({ datetime: new Date().toISOString(), ml: Number(document.getElementById('waterMl').value || 0) });
      saveLogs(logs);
      modal.classList.add('hidden');
      refresh();
    };
  }

  if (type === 'sleep') {
    modalContent.innerHTML = `<h2>Сон</h2><input id='sleepHours' type='number' step='0.1' placeholder='часы'><button class='primary' id='saveSleep'>Добавить</button>`;
    document.getElementById('saveSleep').onclick = () => {
      logs.sleep.push({ datetime: new Date().toISOString(), minutes: Number(document.getElementById('sleepHours').value || 0) * 60 });
      saveLogs(logs);
      modal.classList.add('hidden');
      refresh();
    };
  }

  if (type === 'weight') {
    modalContent.innerHTML = `<h2>Вес</h2><input id='weightKg' type='number' step='0.1' placeholder='кг'><button class='primary' id='saveWeight'>Добавить</button>`;
    document.getElementById('saveWeight').onclick = () => {
      logs.weight.push({ datetime: new Date().toISOString(), kg: Number(document.getElementById('weightKg').value || 0) });
      saveLogs(logs);
      modal.classList.add('hidden');
      refresh();
    };
  }

  if (type === 'calories') {
    modalContent.innerHTML = `
      <h2>Калории</h2>
      <input id='foodQuery' placeholder='например, apple'>
      <button class='primary' id='findFood'>Искать в OpenFoodFacts</button>
      <select id='foodList'></select>
      <input id='grams' type='number' value='100' placeholder='граммы'>
      <button class='primary' id='saveFood'>Добавить</button>
    `;

    let items = [];
    document.getElementById('findFood').onclick = async () => {
      items = await searchFood(document.getElementById('foodQuery').value || 'apple');
      const list = document.getElementById('foodList');
      list.innerHTML = items.map((item, idx) => `<option value="${idx}">${item.name} (${item.calories_100g} ккал/100г)</option>`).join('');
    };

    document.getElementById('saveFood').onclick = () => {
      const idx = Number(document.getElementById('foodList').value || 0);
      const item = items[idx];
      if (!item) return;
      const grams = Number(document.getElementById('grams').value || 100);
      logs.calories.push({
        datetime: new Date().toISOString(),
        name: item.name,
        grams,
        kcal: (Number(item.calories_100g || 0) * grams) / 100,
      });
      saveLogs(logs);
      modal.classList.add('hidden');
      refresh();
    };
  }
}

async function refresh() {
  const meResponse = await apiFetch('/api/auth/me', { method: 'GET' });
  if (!meResponse.ok) {
    window.location.href = '/auth/?return=/health/';
    return;
  }

  const logs = loadLogs();
  const summary = computeSummary(logs);
  statusLine.textContent = `Ты на ${Math.round((summary.water / goals.water) * 100)}% от цели по воде`;

  cards.innerHTML = `
    <article class='card' data-type='calories'><h3>Calories</h3><div class='metric'>${Math.round(summary.calories)} <span class='muted'>kcal</span></div>${ring((summary.calories / goals.calories) * 100, `${Math.round((summary.calories / goals.calories) * 100)}%`)}</article>
    <article class='card' data-type='water'><h3>Water</h3><div class='metric'>${Math.round(summary.water)} <span class='muted'>ml</span></div>${ring((summary.water / goals.water) * 100, `${Math.round((summary.water / goals.water) * 100)}%`)}</article>
    <article class='card' data-type='sleep'><h3>Sleep</h3><div class='metric'>${summary.sleepHours.toFixed(1)} <span class='muted'>hours</span></div>${bars(summary.sleepTrend)}</article>
    <article class='card' data-type='weight'><h3>Weight</h3><div class='metric'>${summary.weight ? Number(summary.weight).toFixed(1) : '—'} <span class='muted'>kg</span></div>${sparkline(summary.weightTrend)}</article>
  `;

  cards.querySelectorAll('.card').forEach((el) => {
    el.onclick = () => openModal(el.dataset.type, logs);
  });

  coach.innerHTML = `<h3>AI Coach</h3><p>Скоро будет персональный AI коуч. Пока держи фокус: вода, белок и стабильный сон.</p>`;
}

refresh();
