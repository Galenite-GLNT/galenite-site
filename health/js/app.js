import { apiFetch } from '/shared/config.js';

const goals = { calories: 2200, water: 2500, sleep: 8, protein: 140, fat: 70, carbs: 240 };
const cards = document.getElementById('cards');
const statusLine = document.getElementById('statusLine');
const todayLine = document.getElementById('todayLine');
const coach = document.getElementById('coach');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const foodDiary = document.getElementById('foodDiary');

const LOGS_KEY = 'glnt.health.logs.v2';
const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'];
const MEAL_LABELS = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snacks: 'Перекусы',
};

function emptyLogs() {
  return { water: [], sleep: [], weight: [], food: [] };
}

function loadLogs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOGS_KEY) || '{}');
    return {
      water: Array.isArray(parsed.water) ? parsed.water : [],
      sleep: Array.isArray(parsed.sleep) ? parsed.sleep : [],
      weight: Array.isArray(parsed.weight) ? parsed.weight : [],
      food: Array.isArray(parsed.food) ? parsed.food : [],
    };
  } catch {
    return emptyLogs();
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
  const todayFood = logs.food.filter((x) => sameDay(x.datetime));
  const mealTotals = Object.fromEntries(MEALS.map((meal) => [meal, { kcal: 0, protein: 0, fat: 0, carbs: 0, items: [] }]));

  for (const entry of todayFood) {
    const meal = MEALS.includes(entry.meal) ? entry.meal : 'snacks';
    mealTotals[meal].kcal += Number(entry.kcal || 0);
    mealTotals[meal].protein += Number(entry.protein || 0);
    mealTotals[meal].fat += Number(entry.fat || 0);
    mealTotals[meal].carbs += Number(entry.carbs || 0);
    mealTotals[meal].items.push(entry);
  }

  const totals = todayFood.reduce((acc, x) => {
    acc.calories += Number(x.kcal || 0);
    acc.protein += Number(x.protein || 0);
    acc.fat += Number(x.fat || 0);
    acc.carbs += Number(x.carbs || 0);
    return acc;
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 });

  const water = logs.water.filter((x) => sameDay(x.datetime)).reduce((acc, x) => acc + Number(x.ml || 0), 0);
  const sleepToday = logs.sleep.filter((x) => sameDay(x.end || x.datetime)).at(-1);
  const sleepTrend = logs.sleep.slice(-7).map((x) => Number((Number(x.minutes || 0) / 60).toFixed(1)));
  const weightTrend = logs.weight.slice(-14).map((x) => Number(x.kg || 0));

  return {
    ...totals,
    mealTotals,
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
  localStorage.removeItem('glnt_session_id');
  window.location.href = '/auth/';
};
document.getElementById('closeModal').onclick = () => modal.classList.add('hidden');

function ring(percent, text) {
  return `<div class="ring" style="--p:${Math.min(100, Math.max(0, percent))}%"><span>${text}</span></div>`;
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

async function searchFoodByBarcode(barcode) {
  const response = await apiFetch(`/api/food/barcode/${encodeURIComponent(barcode)}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.item || null;
}

function toTimeInputValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toIsoFromTime(time) {
  const [h, m] = String(time || '00:00').split(':').map((x) => Number(x || 0));
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toISOString();
}

function minutesBetween(startIso, endIso) {
  const start = new Date(startIso);
  let end = new Date(endIso);
  if (end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return Math.round((end - start) / 60000);
}

function mealSectionHtml(meal, bucket) {
  const items = bucket.items.length
    ? bucket.items.map((item) => `<li><b>${item.name}</b> · ${Math.round(item.grams)}г · ${Math.round(item.kcal)} ккал</li>`).join('')
    : '<li class="muted">Нет записей</li>';

  return `
    <article class="meal-card">
      <div class="meal-head">
        <h4>${MEAL_LABELS[meal]}</h4>
        <span class="muted">${Math.round(bucket.kcal)} ккал · Б ${Math.round(bucket.protein)} / Ж ${Math.round(bucket.fat)} / У ${Math.round(bucket.carbs)}</span>
      </div>
      <ul>${items}</ul>
    </article>
  `;
}

function renderFoodDiary(summary) {
  foodDiary.innerHTML = `
    <header class="section-head">
      <h3>Дневник питания</h3>
      <button class="primary" id="addFoodInline">Добавить еду</button>
    </header>
    ${MEALS.map((meal) => mealSectionHtml(meal, summary.mealTotals[meal])).join('')}
  `;
  document.getElementById('addFoodInline').onclick = () => openModal('food', loadLogs());
}

function openModal(type, logs) {
  modal.classList.remove('hidden');

  if (type === 'water') {
    modalContent.innerHTML = `
      <h2>Вода</h2>
      <div class="quick-row">
        <button class="ghost" data-ml="200">+200</button>
        <button class="ghost" data-ml="250">+250</button>
        <button class="ghost" data-ml="500">+500</button>
      </div>
      <input id='waterMl' type='number' placeholder='мл'>
      <button class='primary' id='saveWater'>Добавить</button>
    `;
    modalContent.querySelectorAll('[data-ml]').forEach((btn) => {
      btn.onclick = () => {
        logs.water.push({ datetime: new Date().toISOString(), ml: Number(btn.dataset.ml) });
        saveLogs(logs);
        modal.classList.add('hidden');
        refresh();
      };
    });

    document.getElementById('saveWater').onclick = () => {
      logs.water.push({ datetime: new Date().toISOString(), ml: Number(document.getElementById('waterMl').value || 0) });
      saveLogs(logs);
      modal.classList.add('hidden');
      refresh();
    };
  }

  if (type === 'sleep') {
    modalContent.innerHTML = `
      <h2>Сон</h2>
      <label class="muted">Начало</label>
      <input id='sleepStart' type='time' value='${toTimeInputValue(new Date(Date.now() - 7 * 60 * 60 * 1000))}'>
      <label class="muted">Конец</label>
      <input id='sleepEnd' type='time' value='${toTimeInputValue()}'>
      <button class='primary' id='saveSleep'>Добавить</button>
    `;

    document.getElementById('saveSleep').onclick = () => {
      const start = toIsoFromTime(document.getElementById('sleepStart').value);
      const end = toIsoFromTime(document.getElementById('sleepEnd').value);
      logs.sleep.push({ datetime: new Date().toISOString(), start, end, minutes: minutesBetween(start, end) });
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

  if (type === 'food') {
    modalContent.innerHTML = `
      <h2>Добавить еду</h2>
      <select id='mealSelect'>
        <option value='breakfast'>Завтрак</option>
        <option value='lunch'>Обед</option>
        <option value='dinner'>Ужин</option>
        <option value='snacks'>Перекусы</option>
      </select>
      <input id='foodQuery' placeholder='например, banana'>
      <div class="quick-row">
        <button class='ghost' id='findFood'>Искать</button>
      </div>
      <input id='barcode' placeholder='или штрихкод'>
      <button class='ghost' id='findBarcode'>Найти по штрихкоду</button>
      <select id='foodList'></select>
      <input id='grams' type='number' value='100' placeholder='граммы'>
      <button class='primary' id='saveFood'>Добавить</button>
      <p class='muted'>Не нашли продукт? Заполните вручную поля ниже.</p>
      <input id='manualName' placeholder='Название продукта'>
      <div class="grid-2">
        <input id='manualKcal' type='number' placeholder='ккал/100г'>
        <input id='manualProtein' type='number' placeholder='белки/100г'>
        <input id='manualFat' type='number' placeholder='жиры/100г'>
        <input id='manualCarbs' type='number' placeholder='углеводы/100г'>
      </div>
      <button class='ghost' id='saveManualFood'>Добавить вручную</button>
    `;

    let items = [];

    document.getElementById('findFood').onclick = async () => {
      items = await searchFood(document.getElementById('foodQuery').value || 'apple');
      const list = document.getElementById('foodList');
      list.innerHTML = items.map((item, idx) => `<option value="${idx}">${item.name} (${item.calories_100g} ккал/100г)</option>`).join('');
    };

    document.getElementById('findBarcode').onclick = async () => {
      const barcode = (document.getElementById('barcode').value || '').trim();
      if (!barcode) return;
      const item = await searchFoodByBarcode(barcode);
      const list = document.getElementById('foodList');
      if (!item) {
        list.innerHTML = '';
        return;
      }
      items = [item];
      list.innerHTML = `<option value="0">${item.name} (${item.calories_100g} ккал/100г)</option>`;
    };

    document.getElementById('saveFood').onclick = () => {
      const idx = Number(document.getElementById('foodList').value || 0);
      const item = items[idx];
      if (!item) return;
      const grams = Number(document.getElementById('grams').value || 100);
      const k = grams / 100;
      logs.food.push({
        datetime: new Date().toISOString(),
        meal: document.getElementById('mealSelect').value,
        name: item.name,
        grams,
        kcal: Number(item.calories_100g || 0) * k,
        protein: Number(item.protein_100g || 0) * k,
        fat: Number(item.fat_100g || 0) * k,
        carbs: Number(item.carbs_100g || 0) * k,
      });
      saveLogs(logs);
      modal.classList.add('hidden');
      refresh();
    };

    document.getElementById('saveManualFood').onclick = () => {
      const grams = Number(document.getElementById('grams').value || 100);
      const k = grams / 100;
      logs.food.push({
        datetime: new Date().toISOString(),
        meal: document.getElementById('mealSelect').value,
        name: document.getElementById('manualName').value || 'Custom product',
        grams,
        kcal: Number(document.getElementById('manualKcal').value || 0) * k,
        protein: Number(document.getElementById('manualProtein').value || 0) * k,
        fat: Number(document.getElementById('manualFat').value || 0) * k,
        carbs: Number(document.getElementById('manualCarbs').value || 0) * k,
      });
      saveLogs(logs);
      modal.classList.add('hidden');
      refresh();
    };
  }
}

async function refresh() {
  let meResponse;
  try {
    meResponse = await apiFetch('/api/auth/me', { method: 'GET' });
  } catch {
    window.location.href = '/auth/?return=/health/';
    return;
  }

  if (!meResponse.ok) {
    window.location.href = '/auth/?return=/health/';
    return;
  }

  const logs = loadLogs();
  const summary = computeSummary(logs);
  statusLine.textContent = `Сегодня: ${Math.round(summary.calories)} ккал · Б ${Math.round(summary.protein)} / Ж ${Math.round(summary.fat)} / У ${Math.round(summary.carbs)}`;

  cards.innerHTML = `
    <article class='card' data-type='food'><h3>Calories</h3><div class='metric'>${Math.round(summary.calories)} <span class='muted'>kcal</span></div>${ring((summary.calories / goals.calories) * 100, `${Math.round((summary.calories / goals.calories) * 100)}%`)}</article>
    <article class='card' data-type='water'><h3>Water</h3><div class='metric'>${Math.round(summary.water)} <span class='muted'>ml</span></div>${ring((summary.water / goals.water) * 100, `${Math.round((summary.water / goals.water) * 100)}%`)}</article>
    <article class='card' data-type='sleep'><h3>Sleep</h3><div class='metric'>${summary.sleepHours.toFixed(1)} <span class='muted'>hours</span></div>${bars(summary.sleepTrend)}</article>
    <article class='card' data-type='weight'><h3>Weight</h3><div class='metric'>${summary.weight ? Number(summary.weight).toFixed(1) : '—'} <span class='muted'>kg</span></div>${sparkline(summary.weightTrend)}</article>
  `;

  cards.querySelectorAll('.card').forEach((el) => {
    el.onclick = () => openModal(el.dataset.type, logs);
  });

  renderFoodDiary(summary);
  coach.innerHTML = `<h3>AI Coach</h3><p>Фокус дня: добери белок до ${goals.protein} г, воду до ${goals.water} мл и сон до ${goals.sleep} часов.</p>`;
}

refresh();
