import { apiFetch } from '/shared/config.js';
import { DEFAULT_STATE, MEAL_TYPES, NAV_ITEMS, QUICK_WATER } from './lib/constants.js';
import { ensureDay, loadState, saveState } from './lib/storage.js';
import { computeSleepDuration, daySummary, formatDate, formatMinutes, macrosForAmount, mealGroups, progress, toNum, uid, weightTrend } from './lib/utils.js';

const el = {
  sections: document.getElementById('appSections'),
  todayLine: document.getElementById('todayLine'),
  statusLine: document.getElementById('statusLine'),
  dayPicker: document.getElementById('dayPicker'),
  modal: document.getElementById('modal'),
  modalContent: document.getElementById('modalContent'),
  closeModal: document.getElementById('closeModal'),
  bottomNav: document.getElementById('bottomNav'),
  sideNav: document.getElementById('sideNav'),
};

let state = loadState();
let foodSearchResults = [];
let selectedFood = null;
let editEntryId = null;

init();

async function init() {
  const me = await apiFetch('/api/auth/me').catch(() => null);
  if (!me?.ok) {
    window.location.href = '/auth/?return=/health/';
    return;
  }

  document.getElementById('logoutBtn').onclick = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('glnt_session_id');
    window.location.href = '/auth/';
  };

  el.dayPicker.value = state.selectedDate;
  el.dayPicker.onchange = () => {
    state.selectedDate = el.dayPicker.value;
    ensureDay(state, state.selectedDate);
    persist();
  };

  el.closeModal.onclick = closeModal;
  el.modal.onclick = (e) => { if (e.target === el.modal) closeModal(); };

  renderNav();
  render();
}

function persist() {
  saveState(state);
  render();
}

function renderNav() {
  const navMarkup = NAV_ITEMS.map((item, i) => `<button class="nav-btn ${i === 0 ? 'active' : ''}" data-target="${item.id}">${item.label}</button>`).join('');
  el.bottomNav.innerHTML = navMarkup;
  el.sideNav.innerHTML = `<div class="brand">Galenite</div>${navMarkup}`;
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(`.nav-btn[data-target="${btn.dataset.target}"]`).forEach((n) => n.classList.add('active'));
      document.querySelectorAll('.nav-btn').forEach((n) => { if (n.dataset.target !== btn.dataset.target) n.classList.remove('active'); });
      document.getElementById(`sec-${btn.dataset.target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
}

function cardMetric(title, value, unit, pct) {
  return `<article class="metric-card"><h3>${title}</h3><div class="metric">${value}<span>${unit}</span></div><div class="progress"><i style="width:${Math.min(pct, 100)}%"></i></div></article>`;
}

function render() {
  const day = ensureDay(state, state.selectedDate);
  const sum = daySummary(day);
  const meals = mealGroups(day.foodEntries);
  const weightData = weightTrend(state.days);

  el.todayLine.textContent = formatDate(state.selectedDate);
  el.statusLine.textContent = `Вода: ${Math.round(sum.waterMl)} / ${state.goals.waterMl} мл · Сон: ${formatMinutes(sum.sleepMinutes || 0)} · Калории: ${Math.round(sum.calories)} / ${state.goals.calories}`;

  el.sections.innerHTML = `
    <section class="section" id="sec-today">
      <div class="cards-grid">
        ${cardMetric('Calories', Math.round(sum.calories), 'kcal', progress(sum.calories, state.goals.calories))}
        ${cardMetric('Protein', Math.round(sum.protein), 'g', progress(sum.protein, state.goals.protein))}
        ${cardMetric('Fat', Math.round(sum.fat), 'g', progress(sum.fat, state.goals.fat))}
        ${cardMetric('Carbs', Math.round(sum.carbs), 'g', progress(sum.carbs, state.goals.carbs))}
        ${cardMetric('Water', Math.round(sum.waterMl), 'ml', progress(sum.waterMl, state.goals.waterMl))}
        ${cardMetric('Sleep', sum.sleepLast ? `${sum.sleepLast.start} → ${sum.sleepLast.end}` : '—', '', progress((sum.sleepMinutes || 0) / 60, state.goals.sleepHours))}
        ${cardMetric('Weight', sum.weightKg ? sum.weightKg.toFixed(1) : '—', 'kg', progress(sum.weightKg, state.goals.weightKg))}
      </div>
      <article class="coach"><h3>AI Coach</h3><p>${coachAdvice(sum)}</p></article>
    </section>

    <section class="section" id="sec-food">
      <div class="section-head"><h2>Food log</h2><button class="btn" id="addFoodBtn">Добавить еду</button></div>
      <div class="food-blocks">${MEAL_TYPES.map((meal) => renderMealBlock(meal, meals[meal.id] || [])).join('')}</div>
      <div class="split-cards">
        <article class="panel"><h4>Recent foods</h4>${renderQuickFoods(state.recentFoods, 'recent')}</article>
        <article class="panel"><h4>Favorites</h4>${renderQuickFoods(state.favorites, 'favorite')}</article>
      </div>
    </section>

    <section class="section" id="sec-progress">
      <div class="split-cards">
        <article class="panel">
          <div class="section-head"><h2>Water</h2><button class="btn" id="customWaterBtn">Свой объем</button></div>
          <div class="quick-actions">${QUICK_WATER.map((x) => `<button class="btn btn--ghost" data-water="${x}">+${x} мл</button>`).join('')}</div>
          ${renderWaterList(day.waterEntries)}
        </article>
        <article class="panel">
          <div class="section-head"><h2>Sleep</h2><button class="btn" id="addSleepBtn">Записать сон</button></div>
          ${renderSleepList(day.sleepEntries)}
        </article>
      </div>
      <article class="panel">
        <div class="section-head"><h2>Weight trend</h2><button class="btn" id="addWeightBtn">Записать вес</button></div>
        <p class="muted">7 дней: ${weightData.weekDelta >= 0 ? '+' : ''}${weightData.weekDelta.toFixed(1)} кг · 30 дней: ${weightData.monthDelta >= 0 ? '+' : ''}${weightData.monthDelta.toFixed(1)} кг</p>
        ${renderWeightChart(weightData.points)}
        ${renderWeightList(day.weightEntries)}
      </article>
    </section>

    <section class="section" id="sec-goals">
      <article class="panel"><div class="section-head"><h2>Goals</h2><button class="btn" id="saveGoalsBtn">Сохранить</button></div>${renderGoalsForm()}</article>
    </section>

    <section class="section" id="sec-profile">
      <article class="panel"><div class="section-head"><h2>Profile</h2><button class="btn" id="saveProfileBtn">Сохранить</button></div>${renderProfileForm()}</article>
    </section>

    <section class="section" id="sec-history">
      <article class="panel"><h2>History</h2><p class="muted">Выберите дату выше, чтобы открыть записи прошлых дней. Все записи доступны для редактирования и удаления.</p></article>
    </section>
  `;

  bindEvents();
}

function coachAdvice(sum) {
  if (sum.calories < state.goals.calories * 0.5) return 'Низкий набор калорий за день. Добавь сбалансированный приём пищи с белком и углеводами.';
  if (sum.waterMl < state.goals.waterMl * 0.6) return 'Пей воду равномерно в течение дня: добавь 250 мл сейчас.';
  if (sum.sleepMinutes / 60 < state.goals.sleepHours * 0.8) return 'Сон ниже цели — постарайся фиксировать стабильное время отхода ко сну.';
  return 'Отличный ритм. Продолжай держать баланс КБЖУ, воды и сна.';
}

function bindEvents() {
  document.getElementById('addFoodBtn').onclick = () => openFoodModal();
  document.getElementById('customWaterBtn').onclick = () => openWaterModal();
  document.getElementById('addSleepBtn').onclick = () => openSleepModal();
  document.getElementById('addWeightBtn').onclick = () => openWeightModal();

  QUICK_WATER.forEach((x) => {
    document.querySelector(`[data-water="${x}"]`).onclick = () => {
      ensureDay(state, state.selectedDate).waterEntries.push({ id: uid(), ml: x, time: nowTime() });
      persist();
    };
  });

  document.getElementById('saveGoalsBtn').onclick = saveGoals;
  document.getElementById('saveProfileBtn').onclick = saveProfile;

  document.querySelectorAll('[data-action="del-food"]').forEach((b) => b.onclick = () => deleteFood(b.dataset.id));
  document.querySelectorAll('[data-action="edit-food"]').forEach((b) => b.onclick = () => editFood(b.dataset.id));
  document.querySelectorAll('[data-action="fav-food"]').forEach((b) => b.onclick = () => toggleFavorite(b.dataset.id));

  document.querySelectorAll('[data-action="del-water"]').forEach((b) => b.onclick = () => mutateList('waterEntries', b.dataset.id, null));
  document.querySelectorAll('[data-action="edit-water"]').forEach((b) => b.onclick = () => openWaterModal(b.dataset.id));
  document.querySelectorAll('[data-action="del-sleep"]').forEach((b) => b.onclick = () => mutateList('sleepEntries', b.dataset.id, null));
  document.querySelectorAll('[data-action="edit-sleep"]').forEach((b) => b.onclick = () => openSleepModal(b.dataset.id));
  document.querySelectorAll('[data-action="del-weight"]').forEach((b) => b.onclick = () => mutateList('weightEntries', b.dataset.id, null));
  document.querySelectorAll('[data-action="edit-weight"]').forEach((b) => b.onclick = () => openWeightModal(b.dataset.id));

  document.querySelectorAll('[data-quick-food]').forEach((btn) => btn.onclick = () => quickAddFromSaved(btn.dataset.quickFood));
  document.querySelectorAll('[data-open-food]').forEach((b) => b.onclick = () => openFoodModal());
}


function renderMealBlock(meal, entries) {
  const totals = entries.reduce((a, e) => ({
    calories: a.calories + e.calories,
    protein: a.protein + e.protein,
    fat: a.fat + e.fat,
    carbs: a.carbs + e.carbs,
  }), { calories: 0, protein: 0, fat: 0, carbs: 0 });
  return `<article class="panel">
    <div class="section-head"><h4>${meal.label}</h4><button class="btn btn--ghost" data-open-food="1">+ Добавить</button></div>
    <p class="muted">${Math.round(totals.calories)} kcal · Б ${Math.round(totals.protein)} · Ж ${Math.round(totals.fat)} · У ${Math.round(totals.carbs)}</p>
    ${entries.length ? entries.map(renderFoodRow).join('') : '<p class="muted">Пока пусто</p>'}
  </article>`;
}

function renderFoodRow(e) {
  return `<div class="list-row"><div><b>${e.name}</b><div class="muted">${Math.round(e.grams)} г · ${Math.round(e.calories)} kcal</div></div><div class="row-actions"><button data-action="edit-food" data-id="${e.id}" class="text-btn">Edit</button><button data-action="fav-food" data-id="${e.id}" class="text-btn">☆</button><button data-action="del-food" data-id="${e.id}" class="text-btn danger">Delete</button></div></div>`;
}

function renderQuickFoods(items, type) {
  if (!items.length) return '<p class="muted">Нет записей</p>';
  return items.slice(0, 8).map((item) => `<button class="chip" data-quick-food="${type}:${item.id}">${item.name}</button>`).join('');
}

function renderWaterList(entries = []) {
  if (!entries.length) return '<p class="muted">Сегодня вода не записана</p>';
  return entries.map((x) => `<div class="list-row"><span>${x.ml} мл · ${x.time}</span><div class="row-actions"><button class="text-btn" data-action="edit-water" data-id="${x.id}">Edit</button><button class="text-btn danger" data-action="del-water" data-id="${x.id}">Delete</button></div></div>`).join('');
}

function renderSleepList(entries = []) {
  if (!entries.length) return '<p class="muted">Нет записей сна</p>';
  return entries.map((x) => `<div class="list-row"><span>${x.start} → ${x.end} · ${formatMinutes(x.durationMinutes)}</span><div class="row-actions"><button class="text-btn" data-action="edit-sleep" data-id="${x.id}">Edit</button><button class="text-btn danger" data-action="del-sleep" data-id="${x.id}">Delete</button></div></div>`).join('');
}

function renderWeightList(entries = []) {
  if (!entries.length) return '<p class="muted">Нет веса за дату</p>';
  return entries.map((x) => `<div class="list-row"><span>${x.kg} кг · ${x.time}</span><div class="row-actions"><button class="text-btn" data-action="edit-weight" data-id="${x.id}">Edit</button><button class="text-btn danger" data-action="del-weight" data-id="${x.id}">Delete</button></div></div>`).join('');
}

function renderWeightChart(points) {
  if (!points.length) return '<p class="muted">Добавьте минимум 2 записи веса для графика</p>';
  const vals = points.map((p) => p.kg);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const poly = points.map((p, i) => `${(i / (points.length - 1 || 1)) * 100},${60 - ((p.kg - min) / ((max - min) || 1)) * 50}`).join(' ');
  return `<svg class="chart" viewBox="0 0 100 64"><polyline points="${poly}"/></svg>`;
}

function renderGoalsForm() {
  const g = state.goals;
  return `<div class="form-grid">
    ${goalField('calories', 'Calories', g.calories)}${goalField('protein', 'Protein', g.protein)}${goalField('fat', 'Fat', g.fat)}${goalField('carbs', 'Carbs', g.carbs)}${goalField('waterMl', 'Water (ml)', g.waterMl)}${goalField('sleepHours', 'Sleep (hours)', g.sleepHours)}${goalField('weightKg', 'Weight (kg)', g.weightKg)}
  </div>`;
}

function renderProfileForm() {
  const p = state.profile;
  return `<div class="form-grid">
    ${textField('displayName', 'Display name', p.displayName)}
    ${textField('sex', 'Sex', p.sex)}
    ${textField('age', 'Age', p.age, 'number')}
    ${textField('heightCm', 'Height cm', p.heightCm, 'number')}
    ${textField('currentWeightKg', 'Current weight kg', p.currentWeightKg, 'number')}
    ${textField('targetWeightKg', 'Target weight kg', p.targetWeightKg, 'number')}
    ${textField('activityLevel', 'Activity level', p.activityLevel)}
  </div>`;
}

function goalField(key, label, value) { return `<label>${label}<input class="input" data-goal="${key}" type="number" value="${value}"></label>`; }
function textField(key, label, value, type = 'text') { return `<label>${label}<input class="input" data-profile="${key}" type="${type}" value="${value || ''}"></label>`; }

function saveGoals() {
  document.querySelectorAll('[data-goal]').forEach((inp) => { state.goals[inp.dataset.goal] = toNum(inp.value); });
  persist();
}

function saveProfile() {
  document.querySelectorAll('[data-profile]').forEach((inp) => { state.profile[inp.dataset.profile] = inp.value; });
  persist();
}

function openModal(html) {
  el.modalContent.innerHTML = html;
  el.modal.classList.remove('hidden');
}
function closeModal() {
  el.modal.classList.add('hidden');
  selectedFood = null;
  editEntryId = null;
}

function openWaterModal(id = '') {
  const day = ensureDay(state, state.selectedDate);
  const item = day.waterEntries.find((x) => x.id === id);
  openModal(`<h3>${id ? 'Редактировать воду' : 'Добавить воду'}</h3><label>Объем (мл)<input id="waterMl" class="input" type="number" value="${item?.ml || 250}"></label><button id="saveWater" class="btn">Сохранить</button>`);
  document.getElementById('saveWater').onclick = () => {
    const payload = { id: id || uid(), ml: toNum(document.getElementById('waterMl').value), time: nowTime() };
    mutateList('waterEntries', id, payload);
    closeModal();
  };
}

function openSleepModal(id = '') {
  const day = ensureDay(state, state.selectedDate);
  const item = day.sleepEntries.find((x) => x.id === id);
  openModal(`<h3>${id ? 'Редактировать сон' : 'Записать сон'}</h3><div class="form-grid"><label>Время сна<input id="sleepStart" class="input" type="time" value="${item?.start || '23:30'}"></label><label>Время пробуждения<input id="sleepEnd" class="input" type="time" value="${item?.end || '07:30'}"></label></div><button id="saveSleep" class="btn">Сохранить</button>`);
  document.getElementById('saveSleep').onclick = () => {
    const start = document.getElementById('sleepStart').value;
    const end = document.getElementById('sleepEnd').value;
    const payload = { id: id || uid(), start, end, durationMinutes: computeSleepDuration(start, end) };
    mutateList('sleepEntries', id, payload);
    closeModal();
  };
}

function openWeightModal(id = '') {
  const day = ensureDay(state, state.selectedDate);
  const item = day.weightEntries.find((x) => x.id === id);
  openModal(`<h3>${id ? 'Редактировать вес' : 'Записать вес'}</h3><label>Вес (кг)<input id="weightKg" class="input" type="number" step="0.1" value="${item?.kg || ''}"></label><button id="saveWeight" class="btn">Сохранить</button>`);
  document.getElementById('saveWeight').onclick = () => {
    const payload = { id: id || uid(), kg: toNum(document.getElementById('weightKg').value), time: nowTime() };
    mutateList('weightEntries', id, payload);
    closeModal();
  };
}

function openFoodModal() {
  foodSearchResults = [];
  selectedFood = null;
  editEntryId = null;
  openModal(renderFoodModal());
  bindFoodModal();
}

function renderFoodModal() {
  return `<h3>Добавить еду</h3>
    <div class="modal-tabs"><button class="chip active" data-tab="search">Поиск</button><button class="chip" data-tab="barcode">Сканер</button><button class="chip" data-tab="manual">Вручную</button></div>
    <div id="foodTabContent">
      <label>Поиск еды<input class="input" id="foodQuery" placeholder="Например, greek yogurt"></label>
      <button id="searchFoodBtn" class="btn">Искать</button>
      <div id="foodResults" class="results"></div>
    </div>`;
}

function bindFoodModal() {
  const results = document.getElementById('foodResults');
  document.getElementById('searchFoodBtn').onclick = async () => {
    const q = document.getElementById('foodQuery').value.trim();
    results.innerHTML = '<p class="muted">Loading...</p>';
    const res = await apiFetch(`/api/food/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) {
      results.innerHTML = '<p class="muted">Ошибка поиска</p>';
      return;
    }
    const data = await res.json();
    foodSearchResults = data.items || [];
    if (!foodSearchResults.length) {
      results.innerHTML = '<p class="muted">Ничего не найдено</p>';
      return;
    }
    results.innerHTML = foodSearchResults.map((i, idx) => `<button class="result-card" data-pick="${idx}"><b>${i.name}</b><span>${i.brand || '—'} · ${Math.round(i.calories_100g)} kcal / 100g</span></button>`).join('');
    results.querySelectorAll('[data-pick]').forEach((btn) => btn.onclick = () => openFoodPortionStep(foodSearchResults[Number(btn.dataset.pick)]));
  };

  document.querySelectorAll('[data-tab]').forEach((btn) => btn.onclick = () => switchFoodTab(btn.dataset.tab));
}

function switchFoodTab(tab) {
  document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const wrap = document.getElementById('foodTabContent');
  if (tab === 'manual') {
    wrap.innerHTML = `<div class="form-grid"><label>Название<input id="mName" class="input"></label><label>Калории/100г<input id="mK" class="input" type="number"></label><label>Белки/100г<input id="mP" class="input" type="number"></label><label>Жиры/100г<input id="mF" class="input" type="number"></label><label>Углеводы/100г<input id="mC" class="input" type="number"></label></div><button id="saveManual" class="btn">Дальше</button>`;
    document.getElementById('saveManual').onclick = () => {
      const item = { name: document.getElementById('mName').value || 'Custom food', calories_100g: toNum(document.getElementById('mK').value), protein_100g: toNum(document.getElementById('mP').value), fat_100g: toNum(document.getElementById('mF').value), carbs_100g: toNum(document.getElementById('mC').value) };
      openFoodPortionStep(item);
    };
    return;
  }

  if (tab === 'barcode') {
    wrap.innerHTML = `<button id="startScan" class="btn">Сканировать штрихкод</button><label>Или введите код<input id="barcodeInput" class="input"></label><button id="findBarcode" class="btn btn--ghost">Найти товар</button><div id="scanResult"></div>`;
    document.getElementById('findBarcode').onclick = () => searchByBarcode(document.getElementById('barcodeInput').value);
    document.getElementById('startScan').onclick = startBarcodeScanner;
    return;
  }

  wrap.innerHTML = `<label>Поиск еды<input class="input" id="foodQuery" placeholder="Например, greek yogurt"></label><button id="searchFoodBtn" class="btn">Искать</button><div id="foodResults" class="results"></div>`;
  bindFoodModal();
}

async function searchByBarcode(code) {
  const scanResult = document.getElementById('scanResult');
  scanResult.innerHTML = '<p class="muted">Loading...</p>';
  const res = await apiFetch(`/api/food/search?q=${encodeURIComponent(code)}`);
  if (!res.ok) {
    scanResult.innerHTML = '<p class="muted">Ошибка поиска, попробуйте вручную</p>';
    return;
  }
  const data = await res.json();
  const item = (data.items || [])[0];
  if (!item) {
    scanResult.innerHTML = '<p class="muted">Штрихкод не найден. Попробуйте поиск по названию или ручное добавление.</p>';
    return;
  }
  openFoodPortionStep(item);
}

async function startBarcodeScanner() {
  const container = document.getElementById('scanResult');
  if (!('BarcodeDetector' in window)) {
    container.innerHTML = '<p class="muted">Сканер недоступен в этом браузере. Введите код вручную.</p>';
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  container.innerHTML = '<video id="scannerVideo" autoplay playsinline class="scanner"></video>';
  const video = document.getElementById('scannerVideo');
  video.srcObject = stream;
  const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  const timer = setInterval(async () => {
    const codes = await detector.detect(video).catch(() => []);
    if (!codes.length) return;
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    searchByBarcode(codes[0].rawValue);
  }, 450);
}

function openFoodPortionStep(item) {
  selectedFood = item;
  const m = macrosForAmount(item, 100);
  openModal(`<h3>${item.name}</h3><p class="muted">${item.brand || ''} · ${Math.round(item.calories_100g || 0)} kcal / 100g</p>
  <div class="form-grid"><label>Граммы<input id="fGrams" class="input" type="number" value="100"></label><label>Приём пищи<select id="fMeal" class="input">${MEAL_TYPES.map((mType) => `<option value="${mType.id}">${mType.label}</option>`).join('')}</select></label></div>
  <p id="fMacros" class="muted">${Math.round(m.calories)} kcal · Б ${Math.round(m.protein)} · Ж ${Math.round(m.fat)} · У ${Math.round(m.carbs)}</p>
  <div class="row-actions"><button id="favBtn" class="btn btn--ghost">В избранное</button><button id="saveFoodEntry" class="btn">Добавить</button></div>`);

  const gramsInput = document.getElementById('fGrams');
  gramsInput.oninput = () => {
    const cur = macrosForAmount(item, toNum(gramsInput.value));
    document.getElementById('fMacros').textContent = `${Math.round(cur.calories)} kcal · Б ${Math.round(cur.protein)} · Ж ${Math.round(cur.fat)} · У ${Math.round(cur.carbs)}`;
  };

  document.getElementById('favBtn').onclick = () => addFavorite(item);
  document.getElementById('saveFoodEntry').onclick = () => {
    const grams = toNum(gramsInput.value);
    const meal = document.getElementById('fMeal').value;
    const m2 = macrosForAmount(item, grams);
    const entry = {
      id: editEntryId || uid(),
      meal,
      name: item.name,
      brand: item.brand || '',
      grams,
      calories: m2.calories,
      protein: m2.protein,
      fat: m2.fat,
      carbs: m2.carbs,
      barcode: item.barcode || '',
    };
    mutateList('foodEntries', editEntryId, entry);
    addRecent(item);
    closeModal();
  };
}

function addRecent(item) {
  const rec = { ...item, id: item.id || uid() };
  state.recentFoods = [rec, ...state.recentFoods.filter((x) => x.name !== rec.name)].slice(0, 20);
}
function addFavorite(item) {
  const fav = { ...item, id: item.id || uid() };
  if (state.favorites.some((x) => x.name === fav.name)) return;
  state.favorites.unshift(fav);
  persist();
}
function toggleFavorite(entryId) {
  const day = ensureDay(state, state.selectedDate);
  const entry = day.foodEntries.find((x) => x.id === entryId);
  if (!entry) return;
  addFavorite({
    name: entry.name,
    brand: entry.brand,
    calories_100g: (entry.calories / entry.grams) * 100,
    protein_100g: (entry.protein / entry.grams) * 100,
    fat_100g: (entry.fat / entry.grams) * 100,
    carbs_100g: (entry.carbs / entry.grams) * 100,
  });
}

function quickAddFromSaved(key) {
  const [type, id] = key.split(':');
  const source = type === 'recent' ? state.recentFoods : state.favorites;
  const item = source.find((x) => x.id === id);
  if (item) openFoodPortionStep(item);
}

function deleteFood(id) {
  mutateList('foodEntries', id, null);
}
function editFood(id) {
  const day = ensureDay(state, state.selectedDate);
  const entry = day.foodEntries.find((x) => x.id === id);
  if (!entry) return;
  editEntryId = id;
  openFoodPortionStep({
    name: entry.name,
    brand: entry.brand,
    calories_100g: (entry.calories / entry.grams) * 100,
    protein_100g: (entry.protein / entry.grams) * 100,
    fat_100g: (entry.fat / entry.grams) * 100,
    carbs_100g: (entry.carbs / entry.grams) * 100,
  });
}

function mutateList(listName, id, payload) {
  const day = ensureDay(state, state.selectedDate);
  day[listName] = (day[listName] || []).filter((x) => x.id !== id);
  if (payload) day[listName].push(payload);
  persist();
}

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

window.__healthDebug = { state, DEFAULT_STATE };
