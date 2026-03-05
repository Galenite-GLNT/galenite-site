const todayKey = () => new Date().toISOString().slice(0, 10);

const state = {
  profile: JSON.parse(localStorage.getItem('health_profile') || 'null'),
  settings: JSON.parse(localStorage.getItem('health_settings') || '{"showKcalTarget":true}'),
  day: localStorage.getItem('health_day') || todayKey(),
  byDay: JSON.parse(localStorage.getItem('health_by_day') || '{}'),
  foodResults: [],
  foodFallback: []
};

function dayState() {
  if (!state.byDay[state.day]) {
    state.byDay[state.day] = {
      meals: [],
      sleep: [],
      waterGoal: 2500,
      waterCurrent: 0,
      kcalTarget: null
    };
  }
  return state.byDay[state.day];
}

function saveState() {
  localStorage.setItem('health_profile', JSON.stringify(state.profile));
  localStorage.setItem('health_settings', JSON.stringify(state.settings));
  localStorage.setItem('health_day', state.day);
  localStorage.setItem('health_by_day', JSON.stringify(state.byDay));
}

function switchTab(tab) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === tab));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
}

function renderProfile() {
  const profileOutput = document.getElementById('profile-output');
  const name = state.profile?.name || 'Гость';
  document.getElementById('greeting').textContent = `Привет, ${name}`;
  profileOutput.textContent = state.profile ? `${state.profile.name} • ${state.profile.source}` : 'Профиль не подключен';
}

function connectTelegram() {
  const tgStatus = document.getElementById('tg-status');
  const tg = window.Telegram?.WebApp;
  if (!tg) {
    tgStatus.textContent = 'Открой внутри Telegram — тогда вход произойдет автоматически.';
    return;
  }

  tg.ready();
  tg.expand();

  const user = tg.initDataUnsafe?.user;
  if (!user) {
    tgStatus.textContent = 'Telegram есть, но данные пользователя пока не пришли.';
    return;
  }

  state.profile = {
    name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `id:${user.id}`,
    source: 'Telegram'
  };
  tgStatus.textContent = 'Telegram аккаунт подключен.';
  saveState();
  renderProfile();
}

function totalsFromMeals(meals) {
  return meals.reduce((acc, item) => {
    acc.kcal += item.kcal;
    acc.protein += item.protein;
    acc.fat += item.fat;
    acc.carbs += item.carbs;
    return acc;
  }, { kcal: 0, protein: 0, fat: 0, carbs: 0 });
}

function renderDashboard() {
  const day = dayState();
  const totals = totalsFromMeals(day.meals);
  const avgSleep = day.sleep.length ? day.sleep.reduce((acc, s) => acc + s.duration, 0) / day.sleep.length : 0;

  document.getElementById('dash-kcal').textContent = `${totals.kcal} ккал`;
  document.getElementById('dash-macros').textContent = `${totals.protein.toFixed(0)} / ${totals.fat.toFixed(0)} / ${totals.carbs.toFixed(0)}`;
  document.getElementById('dash-water').textContent = `${day.waterCurrent} / ${day.waterGoal} мл`;
  document.getElementById('dash-sleep').textContent = avgSleep ? `${avgSleep.toFixed(2)} ч` : '—';

  const feed = document.getElementById('today-feed');
  feed.innerHTML = '';
  const items = [
    day.meals.length ? `Добавлено приемов пищи: ${day.meals.length}` : 'Питание еще не заполнено',
    day.waterCurrent ? `Выпито воды: ${day.waterCurrent} мл` : 'Вода: пока 0 мл',
    day.sleep[0] ? `Последний сон: ${day.sleep[0].duration} ч (качество ${day.sleep[0].quality}/5)` : 'Сон сегодня не добавлен'
  ];
  if (state.settings.showKcalTarget && day.kcalTarget) {
    items.push(`Цель: ${day.kcalTarget.calories} ккал, Б${day.kcalTarget.protein}/Ж${day.kcalTarget.fat}/У${day.kcalTarget.carbs}`);
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    feed.appendChild(li);
  });
}

function setupKcalCalculator() {
  const form = document.getElementById('kcal-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const gender = document.getElementById('gender').value;
    const age = Number(document.getElementById('age').value);
    const weight = Number(document.getElementById('weight').value);
    const height = Number(document.getElementById('height').value);
    const activity = Number(document.getElementById('activity').value);
    const goal = Number(document.getElementById('goal').value);

    const bmr = gender === 'male'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

    const result = {
      calories: Math.round(bmr * activity * (1 + goal)),
      protein: Math.round((bmr * activity * (1 + goal) * 0.3) / 4),
      fat: Math.round((bmr * activity * (1 + goal) * 0.3) / 9),
      carbs: Math.round((bmr * activity * (1 + goal) * 0.4) / 4)
    };

    dayState().kcalTarget = result;
    saveState();
    document.getElementById('kcal-result').textContent = `Цель: ${result.calories} ккал • Б ${result.protein} • Ж ${result.fat} • У ${result.carbs}`;
    renderDashboard();
  });

  form.requestSubmit();
}

function normalizeFood(product) {
  const n = product.nutriments || {};
  const kcal = Number(n['energy-kcal_100g'] || n['energy-kcal'] || 0);
  return {
    id: product.code || Math.random().toString(36).slice(2),
    name: product.product_name || product.generic_name || 'Без названия',
    kcal: Math.round(kcal),
    protein: +(Number(n.proteins_100g || 0)).toFixed(1),
    fat: +(Number(n.fat_100g || 0)).toFixed(1),
    carbs: +(Number(n.carbohydrates_100g || 0)).toFixed(1)
  };
}

async function loadFallbackFoods() {
  try {
    const res = await fetch('data/foods.json');
    if (!res.ok) return;
    state.foodFallback = await res.json();
  } catch {
    state.foodFallback = [];
  }
}

async function fetchFoodDb(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('food db unavailable');
  const json = await res.json();
  return (json.products || [])
    .map(normalizeFood)
    .filter((item) => item.name && (item.kcal > 0 || item.protein > 0 || item.fat > 0 || item.carbs > 0))
    .slice(0, 24);
}

function renderFoodList() {
  const root = document.getElementById('food-list');
  root.innerHTML = '';
  if (!state.foodResults.length) {
    root.innerHTML = '<p class="muted">Начни вводить название продукта.</p>';
    return;
  }

  state.foodResults.forEach((food) => {
    const row = document.createElement('div');
    row.className = 'food-item';
    row.innerHTML = `
      <div>
        <strong>${food.name}</strong><br>
        ${food.kcal} ккал • Б ${food.protein} • Ж ${food.fat} • У ${food.carbs}
      </div>
      <button class="ghost-btn" data-food="${food.id}">Добавить</button>
    `;
    root.appendChild(row);
  });

  root.querySelectorAll('[data-food]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = state.foodResults.find((f) => String(f.id) === btn.dataset.food);
      if (!item) return;
      dayState().meals.push(item);
      saveState();
      renderMealLog();
      renderDashboard();
    });
  });
}

function renderMealLog() {
  const list = document.getElementById('meal-log');
  list.innerHTML = '';
  const day = dayState();

  day.meals.forEach((m, i) => {
    const li = document.createElement('li');
    li.innerHTML = `${m.name} — ${m.kcal} ккал <button class="ghost-btn" data-remove="${i}">Удалить</button>`;
    list.appendChild(li);
  });

  const total = totalsFromMeals(day.meals);
  document.getElementById('meal-total').textContent = `Итого: ${total.kcal} ккал • Б ${total.protein.toFixed(1)} • Ж ${total.fat.toFixed(1)} • У ${total.carbs.toFixed(1)}`;

  list.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      day.meals.splice(Number(btn.dataset.remove), 1);
      saveState();
      renderMealLog();
      renderDashboard();
    });
  });
}

function setupFoodSearch() {
  const input = document.getElementById('food-search');
  const searchStatus = document.getElementById('search-status');
  let timer;

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const query = input.value.trim();
    if (query.length < 2) {
      state.foodResults = [];
      renderFoodList();
      searchStatus.textContent = '';
      return;
    }

    timer = setTimeout(async () => {
      searchStatus.textContent = 'Ищем…';
      try {
        state.foodResults = await fetchFoodDb(query);
        searchStatus.textContent = `Найдено: ${state.foodResults.length}`;
      } catch {
        const q = query.toLowerCase();
        state.foodResults = state.foodFallback.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 24);
        searchStatus.textContent = `Оффлайн-режим: ${state.foodResults.length}`;
      }
      renderFoodList();
    }, 320);
  });
}

function durationHours(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return +(minutes / 60).toFixed(2);
}

function renderSleep() {
  const list = document.getElementById('sleep-list');
  const avgEl = document.getElementById('sleep-average');
  const day = dayState();
  list.innerHTML = '';

  day.sleep.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${item.start} → ${item.end}: ${item.duration} ч, качество ${item.quality}/5`;
    list.appendChild(li);
  });

  if (!day.sleep.length) {
    avgEl.textContent = 'Сон ещё не записан.';
    return;
  }

  const avg = day.sleep.reduce((acc, s) => acc + s.duration, 0) / day.sleep.length;
  avgEl.textContent = `Средний сон: ${avg.toFixed(2)} ч`;
}

function setupSleep() {
  const form = document.getElementById('sleep-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const start = document.getElementById('sleep-start').value;
    const end = document.getElementById('sleep-end').value;
    const quality = Number(document.getElementById('sleep-quality').value);
    const duration = durationHours(start, end);

    dayState().sleep.unshift({ start, end, duration, quality });
    dayState().sleep = dayState().sleep.slice(0, 12);
    saveState();
    renderSleep();
    renderDashboard();
    form.reset();
  });
}

function renderWater() {
  const day = dayState();
  const percent = Math.min(100, Math.round((day.waterCurrent / day.waterGoal) * 100));
  document.getElementById('water-goal').value = day.waterGoal;
  document.getElementById('water-progress-bar').style.width = `${percent}%`;
  document.getElementById('water-stats').textContent = `${day.waterCurrent} / ${day.waterGoal} мл (${percent}%)`;
}

function setupWater() {
  document.getElementById('save-goal').addEventListener('click', () => {
    const goal = Number(document.getElementById('water-goal').value);
    dayState().waterGoal = Math.max(500, goal || 2500);
    saveState();
    renderWater();
    renderDashboard();
  });

  document.querySelectorAll('.water-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      dayState().waterCurrent += Number(btn.dataset.ml);
      saveState();
      renderWater();
      renderDashboard();
    });
  });

  document.getElementById('water-reset').addEventListener('click', () => {
    dayState().waterCurrent = 0;
    saveState();
    renderWater();
    renderDashboard();
  });
}

function setupSettings() {
  const showKcalTarget = document.getElementById('show-kcal-target');
  showKcalTarget.checked = Boolean(state.settings.showKcalTarget);

  showKcalTarget.addEventListener('change', () => {
    state.settings.showKcalTarget = showKcalTarget.checked;
    saveState();
    renderDashboard();
  });

  document.getElementById('fallback-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('nickname').value.trim();
    if (!name) return;
    state.profile = { name, source: 'Local' };
    saveState();
    renderProfile();
    e.target.reset();
  });
}

function setupDayPicker() {
  const picker = document.getElementById('day-picker');
  picker.value = state.day;
  picker.addEventListener('change', () => {
    if (!picker.value) return;
    state.day = picker.value;
    saveState();
    renderWater();
    renderSleep();
    renderMealLog();
    renderDashboard();
  });
}

function initNavigation() {
  document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  document.getElementById('go-nutrition').addEventListener('click', () => switchTab('nutrition'));
  document.getElementById('go-recovery').addEventListener('click', () => switchTab('recovery'));
}

async function init() {
  await loadFallbackFoods();

  initNavigation();
  setupDayPicker();
  setupKcalCalculator();
  setupFoodSearch();
  setupSleep();
  setupWater();
  setupSettings();
  renderProfile();
  renderFoodList();
  renderMealLog();
  renderSleep();
  renderWater();
  renderDashboard();
  connectTelegram();

  document.getElementById('connect-telegram').addEventListener('click', connectTelegram);
}

init();
