import { apiFetch } from '/shared/config.js';

const DEFAULT_GOALS = { calories: 2200, water: 2500, sleep: 8 };
const cards = document.getElementById('cards');
const statusLine = document.getElementById('statusLine');
const todayLine = document.getElementById('todayLine');
const coach = document.getElementById('coach');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');

const accountBtn = document.getElementById('accountBtn');
const accountName = document.getElementById('accountName');
const accountAvatar = document.getElementById('accountAvatar');
const accountMenu = document.getElementById('accountMenu');
const logoutBtn = document.getElementById('logoutBtn');

let appState = {
  me: null,
  goals: { ...DEFAULT_GOALS },
  logs: { water: [], sleep: [], weight: [], calories: [] },
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sameDay(iso) {
  return String(iso || '').slice(0, 10) === todayIso();
}

function buildDisplayName(user) {
  if (!user) return 'Профиль';
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  if (name) return name;
  if (user.username) return `@${user.username}`;
  return `User ${user.telegram_user_id}`;
}

function toInitials(user) {
  const full = buildDisplayName(user).replace('@', '').trim();
  const parts = full.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return parts.slice(0, 2).map((x) => x[0].toUpperCase()).join('');
}

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

function computeSummary(logs, goals) {
  const calories = logs.calories.filter((x) => sameDay(x.datetime)).reduce((a, x) => a + Number(x.kcal || 0), 0);
  const water = logs.water.filter((x) => sameDay(x.datetime)).reduce((a, x) => a + Number(x.ml || 0), 0);
  const sleepToday = logs.sleep.filter((x) => sameDay(x.datetime)).at(-1);
  const sleepTrend = logs.sleep.slice(-7).map((x) => Number((Number(x.minutes || 0) / 60).toFixed(1)));
  const weightTrend = logs.weight.slice(-14).map((x) => Number(x.kg || 0));

  const sleepHours = Number(((sleepToday?.minutes || 0) / 60).toFixed(1));
  return {
    calories,
    water,
    sleepHours,
    sleepTrend,
    weight: logs.weight.at(-1)?.kg || 0,
    weightTrend,
    calorieProgress: Math.min(100, Math.round((calories / goals.calories) * 100)),
    waterProgress: Math.min(100, Math.round((water / goals.water) * 100)),
    sleepProgress: Math.min(100, Math.round((sleepHours / goals.sleep) * 100)),
    mealCount: logs.calories.length,
    hydrationCount: logs.water.length,
  };
}

async function loadStateFromApi() {
  const meResponse = await apiFetch('/api/auth/me', { method: 'GET' });
  if (!meResponse.ok) {
    window.location.href = '/auth/?return=/health/';
    return false;
  }
  const meData = await meResponse.json();

  const stateResponse = await apiFetch('/api/health/state', { method: 'GET' });
  if (!stateResponse.ok) {
    statusLine.textContent = 'Не удалось загрузить Health из БД';
    return false;
  }
  const stateData = await stateResponse.json();

  appState = {
    me: meData.user,
    goals: stateData.goals || { ...DEFAULT_GOALS },
    logs: stateData.logs || { water: [], sleep: [], weight: [], calories: [] },
  };
  return true;
}

function renderAccount() {
  const user = appState.me;
  accountName.textContent = buildDisplayName(user);
  if (user?.photo_url) {
    accountAvatar.innerHTML = `<img src="${user.photo_url}" alt="avatar">`;
  } else {
    accountAvatar.textContent = toInitials(user);
  }
}

async function fetchRecentLogs(type) {
  const response = await apiFetch(`/api/health/logs?type=${encodeURIComponent(type)}&limit=8`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

function entryList(type, rows) {
  const mapText = {
    water: (x) => `${new Date(x.datetime).toLocaleString('ru-RU')} · ${x.value || x.ml} мл`,
    sleep: (x) => `${new Date(x.datetime).toLocaleDateString('ru-RU')} · ${((x.value || x.minutes) / 60).toFixed(1)} ч`,
    weight: (x) => `${new Date(x.datetime).toLocaleDateString('ru-RU')} · ${Number(x.value || x.kg).toFixed(1)} кг`,
    calories: (x) => `${x.name || 'Без названия'} · ${Math.round(x.value || x.kcal)} ккал`,
  };

  if (!rows.length) return '<p class="muted">Пока нет записей</p>';
  return `<ul class="quick-list">${rows.map((row) => `<li>${mapText[type](row)}</li>`).join('')}</ul>`;
}

async function searchFood(query) {
  const response = await apiFetch(`/api/food/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

async function saveLog(payload) {
  const response = await apiFetch('/api/health/logs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.ok;
}

async function saveGoals(goals) {
  const response = await apiFetch('/api/health/goals', {
    method: 'POST',
    body: JSON.stringify(goals),
  });
  return response.ok;
}

async function openModal(type) {
  modal.classList.remove('hidden');

  if (type === 'goals') {
    const goals = appState.goals;
    modalContent.innerHTML = `
      <h2>Дневные цели</h2>
      <p class='muted'>Цели сохраняются в вашем аккаунте и доступны с любого устройства.</p>
      <input id='goalCalories' type='number' value='${goals.calories}' placeholder='ккал'>
      <input id='goalWater' type='number' value='${goals.water}' placeholder='мл'>
      <input id='goalSleep' type='number' step='0.5' value='${goals.sleep}' placeholder='часы'>
      <button class='primary' id='saveGoals'>Сохранить цели</button>
    `;
    document.getElementById('saveGoals').onclick = async () => {
      const nextGoals = {
        calories: Number(document.getElementById('goalCalories').value || DEFAULT_GOALS.calories),
        water: Number(document.getElementById('goalWater').value || DEFAULT_GOALS.water),
        sleep: Number(document.getElementById('goalSleep').value || DEFAULT_GOALS.sleep),
      };
      if (!(await saveGoals(nextGoals))) return;
      modal.classList.add('hidden');
      await refresh();
    };
    return;
  }

  if (type === 'calories') {
    modalContent.innerHTML = `
      <h2>Калории</h2>
      <p class='muted'>Выберите продукт из каталога и добавьте порцию.</p>
      <input id='foodQuery' placeholder='например, banana / творог / йогурт'>
      <div class='search-toolbar'>
        <input id='grams' type='number' value='100' placeholder='граммы'>
        <button class='primary' id='findFood'>Искать</button>
      </div>
      <div id='foodSearchResults' class='food-results'></div>
      <h3>Последние записи</h3>
      <div id='caloriesRecent'>Загрузка...</div>
    `;

    const recent = await fetchRecentLogs('calories');
    document.getElementById('caloriesRecent').innerHTML = entryList('calories', recent);

    let items = [];
    document.getElementById('findFood').onclick = async () => {
      const q = document.getElementById('foodQuery').value || '';
      items = await searchFood(q);
      const el = document.getElementById('foodSearchResults');
      if (!items.length) {
        el.innerHTML = '<p class="muted">Ничего не найдено</p>';
        return;
      }
      el.innerHTML = items.map((item, idx) => `
        <article class="food-item" data-idx="${idx}">
          <div class="food-item__left">
            ${item.image ? `<img src="${item.image}" alt="">` : '<div class="food-fallback">🍽️</div>'}
            <div>
              <h4>${item.name}</h4>
              <p>${item.brand || 'Без бренда'} · ${item.calories_100g} ккал/100г</p>
            </div>
          </div>
          <button class="ghost addFoodBtn" data-idx="${idx}">Добавить</button>
        </article>
      `).join('');

      el.querySelectorAll('.addFoodBtn').forEach((btn) => {
        btn.onclick = async () => {
          const item = items[Number(btn.dataset.idx)];
          const grams = Number(document.getElementById('grams').value || 100);
          if (!item || grams <= 0) return;
          const kcal = (Number(item.calories_100g || 0) * grams) / 100;
          const ok = await saveLog({ type: 'calories', name: item.name, grams, kcal, calories_100g: Number(item.calories_100g || 0) });
          if (!ok) return;
          modal.classList.add('hidden');
          await refresh();
        };
      });
    };
    return;
  }

  const modalByType = {
    water: {
      title: 'Вода',
      hint: 'Добавляйте воду в течение дня — запись попадёт в базу аккаунта.',
      input: `<input id='modalValue' type='number' placeholder='мл'>`,
      payload: (v) => ({ type: 'water', ml: v }),
      label: 'Добавить',
    },
    sleep: {
      title: 'Сон',
      hint: 'Укажите длительность сна, чтобы AI Coach строил персональные рекомендации.',
      input: `<input id='modalValue' type='number' step='0.1' placeholder='часы'>`,
      payload: (v) => ({ type: 'sleep', minutes: v * 60 }),
      label: 'Сохранить',
    },
    weight: {
      title: 'Вес',
      hint: 'Добавляйте вес стабильно в одно время для корректного тренда.',
      input: `<input id='modalValue' type='number' step='0.1' placeholder='кг'>`,
      payload: (v) => ({ type: 'weight', kg: v }),
      label: 'Сохранить',
    },
  };

  const c = modalByType[type];
  if (!c) return;

  modalContent.innerHTML = `
    <h2>${c.title}</h2>
    <p class='muted'>${c.hint}</p>
    ${c.input}
    <button class='primary' id='saveMetric'>${c.label}</button>
    <h3>Последние записи</h3>
    <div id='metricRecent'>Загрузка...</div>
  `;

  const recent = await fetchRecentLogs(type);
  document.getElementById('metricRecent').innerHTML = entryList(type, recent);

  document.getElementById('saveMetric').onclick = async () => {
    const value = Number(document.getElementById('modalValue').value || 0);
    if (!Number.isFinite(value) || value <= 0) return;
    const ok = await saveLog(c.payload(value));
    if (!ok) return;
    modal.classList.add('hidden');
    await refresh();
  };
}

async function askCoach(question, summary) {
  const response = await apiFetch('/api/health/coach', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    document.getElementById('coachOutput').innerHTML = `<p class="muted">Сервис коуча временно недоступен${error?.error ? `: ${error.error}` : ''}.</p>`;
    return;
  }

  const data = await response.json();
  const tips = Array.isArray(data.tips) ? data.tips : [];
  const summaryText = data.summary || '';

  document.getElementById('coachOutput').innerHTML = `
    ${summaryText ? `<article class="coach-tip"><h4>Итог</h4><p>${summaryText}</p></article>` : ''}
    ${tips.map((tip) => `<article class="coach-tip"><p>${tip}</p></article>`).join('') || '<p class="muted">Подсказки пока не пришли.</p>'}
  `;
  document.getElementById('coachMeta').textContent = `Сегодня: ${summary.mealCount} приём(ов) пищи, ${summary.hydrationCount} записи(ей) воды.`;
}

function renderCoachShell(summary) {
  coach.innerHTML = `
    <div class="coach__head">
      <h3>AI Coach</h3>
      <span class="pill">online</span>
    </div>
    <p id="coachMeta" class="muted">Сегодня: ${summary.mealCount} приём(ов) пищи, ${summary.hydrationCount} записи(ей) воды.</p>
    <div class="coach-ask">
      <input id="coachQuestion" placeholder="Спроси коуча: что улучшить сегодня?" value="Что мне улучшить сегодня по питанию, воде и сну?">
      <button id="coachAskBtn" class="primary">Спросить</button>
    </div>
    <div id="coachOutput" class="coach-list"><p class="muted">Получаем рекомендации...</p></div>
  `;

  document.getElementById('coachAskBtn').onclick = async () => {
    const question = (document.getElementById('coachQuestion').value || '').trim();
    if (!question) return;
    document.getElementById('coachOutput').innerHTML = '<p class="muted">Думаю...</p>';
    await askCoach(question, summary);
  };
}

async function refresh() {
  const ok = await loadStateFromApi();
  if (!ok) return;

  const summary = computeSummary(appState.logs, appState.goals);
  renderAccount();

  statusLine.textContent = `Вода: ${summary.waterProgress}% · Калории: ${summary.calorieProgress}% · Сон: ${summary.sleepProgress}%`;
  cards.innerHTML = `
    <article class='card' data-type='calories'><h3>Calories</h3><div class='metric'>${Math.round(summary.calories)} <span class='muted'>kcal</span></div>${ring((summary.calories / appState.goals.calories) * 100, `${Math.round((summary.calories / appState.goals.calories) * 100)}%`)}</article>
    <article class='card' data-type='water'><h3>Water</h3><div class='metric'>${Math.round(summary.water)} <span class='muted'>ml</span></div>${ring((summary.water / appState.goals.water) * 100, `${Math.round((summary.water / appState.goals.water) * 100)}%`)}</article>
    <article class='card' data-type='sleep'><h3>Sleep</h3><div class='metric'>${summary.sleepHours.toFixed(1)} <span class='muted'>hours</span></div>${bars(summary.sleepTrend)}</article>
    <article class='card' data-type='weight'><h3>Weight</h3><div class='metric'>${summary.weight ? Number(summary.weight).toFixed(1) : '—'} <span class='muted'>kg</span></div>${sparkline(summary.weightTrend)}</article>
  `;

  cards.querySelectorAll('.card').forEach((el) => {
    el.onclick = () => openModal(el.dataset.type);
  });

  renderCoachShell(summary);
  await askCoach('Что мне улучшить сегодня по питанию, воде и сну?', summary);
}

todayLine.textContent = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
document.getElementById('goalsBtn').onclick = () => openModal('goals');
document.getElementById('closeModal').onclick = () => modal.classList.add('hidden');

accountBtn.onclick = () => accountMenu.classList.toggle('hidden');
document.addEventListener('click', (e) => {
  if (!e.target.closest('.account')) accountMenu.classList.add('hidden');
});

logoutBtn.onclick = async () => {
  await apiFetch('/api/auth/logout', { method: 'POST' });
  localStorage.removeItem('glnt_session_id');
  window.location.href = '/auth/';
};

refresh();
