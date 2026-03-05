const state = {
  profile: JSON.parse(localStorage.getItem('health_profile') || 'null'),
  meals: JSON.parse(localStorage.getItem('health_meals') || '[]'),
  sleep: JSON.parse(localStorage.getItem('health_sleep') || '[]'),
  waterGoal: Number(localStorage.getItem('health_water_goal') || 2500),
  waterCurrent: Number(localStorage.getItem('health_water_current') || 0),
  foodResults: []
};

const tgStatus = document.getElementById('tg-status');
const profileOutput = document.getElementById('profile-output');

function saveState() {
  localStorage.setItem('health_profile', JSON.stringify(state.profile));
  localStorage.setItem('health_meals', JSON.stringify(state.meals));
  localStorage.setItem('health_sleep', JSON.stringify(state.sleep));
  localStorage.setItem('health_water_goal', String(state.waterGoal));
  localStorage.setItem('health_water_current', String(state.waterCurrent));
}

function switchTab(tab) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.dataset.screen === tab);
  });
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}

function connectTelegram() {
  const tg = window.Telegram?.WebApp;
  if (!tg) {
    tgStatus.textContent = 'Открой внутри Telegram, чтобы автоматически подтянуть аккаунт.';
    return;
  }
  tg.ready();
  tg.expand();

  const user = tg.initDataUnsafe?.user;
  if (!user) {
    tgStatus.textContent = 'Telegram подключен, но пользователь пока не передал данные.';
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

function renderProfile() {
  const name = state.profile?.name || 'Гость';
  document.getElementById('greeting').textContent = `Привет, ${name}`;
  profileOutput.textContent = state.profile ? `${state.profile.name} • ${state.profile.source}` : 'Профиль не подключен';
}

function renderKcalResult({ calories, protein, fat, carbs }) {
  document.getElementById('kcal-result').textContent = `Цель: ${calories} ккал • Б ${protein} г • Ж ${fat} г • У ${carbs} г`;
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

    const calories = Math.round(bmr * activity * (1 + goal));
    const protein = Math.round((calories * 0.3) / 4);
    const fat = Math.round((calories * 0.3) / 9);
    const carbs = Math.round((calories * 0.4) / 4);

    renderKcalResult({ calories, protein, fat, carbs });
  });
  form.requestSubmit();
}

function totalsFromMeals() {
  return state.meals.reduce((acc, item) => {
    acc.kcal += item.kcal;
    acc.protein += item.protein;
    acc.fat += item.fat;
    acc.carbs += item.carbs;
    return acc;
  }, { kcal: 0, protein: 0, fat: 0, carbs: 0 });
}

function renderMealLog() {
  const list = document.getElementById('meal-log');
  list.innerHTML = '';
  state.meals.forEach((m, index) => {
    const li = document.createElement('li');
    li.innerHTML = `${m.name}: ${m.kcal} ккал <button class="ghost-btn" data-remove="${index}">Удалить</button>`;
    list.appendChild(li);
  });

  const totals = totalsFromMeals();
  document.getElementById('meal-total').textContent = `Итого: ${totals.kcal} ккал • Б ${totals.protein.toFixed(1)} • Ж ${totals.fat.toFixed(1)} • У ${totals.carbs.toFixed(1)}`;

  list.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.meals.splice(Number(btn.dataset.remove), 1);
      saveState();
      renderMealLog();
      renderDashboard();
    });
  });
}

function normalizeFood(product) {
  const nutriments = product.nutriments || {};
  const kcal = Number(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0);
  const protein = Number(nutriments.proteins_100g || 0);
  const fat = Number(nutriments.fat_100g || 0);
  const carbs = Number(nutriments.carbohydrates_100g || 0);
  return {
    id: product.code || `${product.product_name || 'unknown'}-${Math.random()}`,
    name: product.product_name || product.generic_name || 'Без названия',
    kcal: Math.round(kcal),
    protein: +protein.toFixed(1),
    fat: +fat.toFixed(1),
    carbs: +carbs.toFixed(1)
  };
}

async function fetchFoodDb(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('db fetch failed');
  const json = await res.json();
  return (json.products || []).map(normalizeFood).filter((item) => item.name && item.kcal >= 0).slice(0, 20);
}

function renderFoodList() {
  const root = document.getElementById('food-list');
  root.innerHTML = '';

  if (!state.foodResults.length) {
    root.innerHTML = '<p class="muted">Начни вводить продукт для поиска по большой базе.</p>';
    return;
  }

  state.foodResults.forEach((food) => {
    const row = document.createElement('div');
    row.className = 'food-item';
    row.innerHTML = `<div><strong>${food.name}</strong><br>${food.kcal} ккал • Б ${food.protein} • Ж ${food.fat} • У ${food.carbs}</div><button class="ghost-btn" data-food="${food.id}">+ В журнал</button>`;
    root.appendChild(row);
  });

  root.querySelectorAll('[data-food]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = state.foodResults.find((f) => String(f.id) === btn.dataset.food);
      if (!item) return;
      state.meals.push(item);
      saveState();
      renderMealLog();
      renderDashboard();
    });
  });
}

function setupFoodSearch() {
  const input = document.getElementById('food-search');
  let timeout;

  input.addEventListener('input', () => {
    clearTimeout(timeout);
    const query = input.value.trim();
    if (query.length < 2) {
      state.foodResults = [];
      renderFoodList();
      return;
    }

    timeout = setTimeout(async () => {
      try {
        state.foodResults = await fetchFoodDb(query);
      } catch {
        state.foodResults = [];
        document.getElementById('food-list').innerHTML = '<p class="muted">Не удалось загрузить базу. Проверь подключение или добавь backend-прокси/FatSecret API.</p>';
        return;
      }
      renderFoodList();
    }, 350);
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
  list.innerHTML = '';
  if (!state.sleep.length) {
    document.getElementById('sleep-average').textContent = 'Пока нет записей сна.';
    return;
  }

  state.sleep.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = `${entry.date}: ${entry.duration} ч, качество ${entry.quality}/5`;
    list.appendChild(li);
  });

  const avg = state.sleep.reduce((acc, s) => acc + s.duration, 0) / state.sleep.length;
  document.getElementById('sleep-average').textContent = `Средний сон: ${avg.toFixed(2)} ч`;
}

function setupSleep() {
  const form = document.getElementById('sleep-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('sleep-date').value;
    const start = document.getElementById('sleep-start').value;
    const end = document.getElementById('sleep-end').value;
    const quality = Number(document.getElementById('sleep-quality').value);
    const duration = durationHours(start, end);

    state.sleep.unshift({ date, duration, quality });
    state.sleep = state.sleep.slice(0, 20);
    saveState();
    renderSleep();
    renderDashboard();
    form.reset();
  });
  renderSleep();
}

function renderWater() {
  const percent = Math.min(100, Math.round((state.waterCurrent / state.waterGoal) * 100));
  document.getElementById('water-progress-bar').style.width = `${percent}%`;
  document.getElementById('water-stats').textContent = `${state.waterCurrent} / ${state.waterGoal} мл (${percent}%)`;
  document.getElementById('water-goal').value = state.waterGoal;
}

function setupWater() {
  document.getElementById('save-goal').addEventListener('click', () => {
    state.waterGoal = Number(document.getElementById('water-goal').value);
    saveState();
    renderWater();
    renderDashboard();
  });

  document.querySelectorAll('.water-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.waterCurrent += Number(btn.dataset.ml);
      saveState();
      renderWater();
      renderDashboard();
    });
  });

  document.getElementById('water-reset').addEventListener('click', () => {
    state.waterCurrent = 0;
    saveState();
    renderWater();
    renderDashboard();
  });

  renderWater();
}

function setupFallbackProfile() {
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

function renderDashboard() {
  const totals = totalsFromMeals();
  const avgSleep = state.sleep.length ? state.sleep.reduce((acc, s) => acc + s.duration, 0) / state.sleep.length : 0;
  document.getElementById('dash-water').textContent = `${state.waterCurrent} / ${state.waterGoal} мл`;
  document.getElementById('dash-kcal').textContent = `${totals.kcal} ккал`;
  document.getElementById('dash-sleep').textContent = `${avgSleep.toFixed(2)} ч`;

  const feed = document.getElementById('today-feed');
  feed.innerHTML = '';
  const items = [
    `Добавлено продуктов: ${state.meals.length}`,
    `Выпито воды: ${state.waterCurrent} мл`,
    state.sleep[0] ? `Последний сон: ${state.sleep[0].duration} ч, качество ${state.sleep[0].quality}/5` : 'Сон еще не записан'
  ];
  items.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    feed.appendChild(li);
  });
}

function initNavigation() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

initNavigation();
setupFallbackProfile();
setupKcalCalculator();
setupFoodSearch();
setupSleep();
setupWater();
renderProfile();
renderFoodList();
renderMealLog();
renderDashboard();
connectTelegram();

document.getElementById('connect-telegram').addEventListener('click', connectTelegram);
