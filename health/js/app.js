import {
  askCoach,
  createLog,
  deleteLog,
  findFoodByBarcode,
  logout,
  saveGoals,
  saveProfile,
  searchFoods,
  toggleFavorite,
  updateLog,
} from './lib/api.js';
import { DEFAULT_GOALS, MEAL_TYPES } from './lib/constants.js';
import { progress } from './lib/calculations.js';
import { hydrateState, setDate, setSection, state } from './lib/state.js';
import { fromDateTimeLocalValue, sleepDurationMinutes, toDateTimeLocalValue } from './lib/utils.js';
import { renderCoachResponse, renderShell } from './ui/render.js';

const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');

async function refresh() {
  try {
    await hydrateState();
    renderShell(state);
  } catch {
    window.location.href = '/auth/?return=/health/';
  }
}

function getLogById(type, id) {
  return (state.logs[type] || []).find((x) => Number(x.id) === Number(id));
}

function openModal(html) {
  modalContent.innerHTML = html;
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
}

function bindRootEvents() {
  document.body.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action],[data-nav]');
    if (!target) return;

    if (target.dataset.nav) {
      setSection(target.dataset.nav);
      renderShell(state);
      return;
    }

    if (target.dataset.action === 'quick-water') {
      openWaterQuickModal();
      return;
    }

    if (target.dataset.action === 'add-food') {
      openFoodModal({ meal: target.dataset.meal || 'snacks' });
      return;
    }

    if (target.dataset.action === 'reuse-food') {
      const product = JSON.parse(decodeURIComponent(target.dataset.food || '{}'));
      openFoodModal({ meal: 'snacks', product });
      return;
    }

    if (target.dataset.action === 'ask-coach') {
      const q = (document.getElementById('coachQuestion')?.value || '').trim();
      if (!q) return;
      const data = await askCoach(q);
      renderCoachResponse(data);
      return;
    }

    if (target.dataset.action === 'delete-log') {
      if (!confirm('Удалить запись?')) return;
      await deleteLog(target.dataset.id);
      await refresh();
      return;
    }

    if (target.dataset.action === 'edit-log') {
      openEditMetricModal(target.dataset.type, target.dataset.id);
      return;
    }

    if (target.dataset.action === 'edit-food') {
      const entry = getLogById('calories', target.dataset.id);
      if (entry) openFoodModal({ meal: entry.meal || 'snacks', entry });
      return;
    }
  });

  document.body.addEventListener('submit', async (event) => {
    const form = event.target;
    if (form.id === 'goalsForm') {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const payload = Object.fromEntries(Object.entries(DEFAULT_GOALS).map(([k, v]) => [k, Number(data[k] || v)]));
      await saveGoals(payload);
      await refresh();
      return;
    }

    if (form.id === 'profileForm') {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const payload = {
        ...data,
        height_cm: Number(data.height_cm || 0),
        age: Number(data.age || 0),
        current_weight: Number(data.current_weight || 0),
        target_weight: Number(data.target_weight || 0),
      };
      await saveProfile(payload);
      await refresh();
      return;
    }
  });

  document.body.addEventListener('change', async (event) => {
    const el = event.target;
    if (el.id === 'historyDate') {
      setDate(el.value);
      await refresh();
    }
  });

  document.getElementById('goalsBtn').onclick = () => {
    setSection('goals');
    renderShell(state);
  };

  document.getElementById('closeModal').onclick = closeModal;
  document.getElementById('accountBtn').onclick = () => document.getElementById('accountMenu').classList.toggle('hidden');
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.account')) document.getElementById('accountMenu').classList.add('hidden');
  });
  document.getElementById('logoutBtn').onclick = async () => {
    await logout();
    localStorage.removeItem('glnt_session_id');
    window.location.href = '/auth/';
  };
}

function openWaterQuickModal() {
  openModal(`
    <h2>Добавить воду</h2>
    <div class='water-quick'>
      <button class='ghost' data-ml='200'>+200 мл</button>
      <button class='ghost' data-ml='250'>+250 мл</button>
      <button class='ghost' data-ml='500'>+500 мл</button>
    </div>
    <input id='customWater' type='number' placeholder='свой объём, мл'>
    <button class='primary' id='saveCustomWater'>Сохранить</button>
  `);

  modalContent.querySelectorAll('[data-ml]').forEach((btn) => {
    btn.onclick = async () => {
      await createLog({ type: 'water', ml: Number(btn.dataset.ml), date: state.selectedDate });
      closeModal();
      await refresh();
    };
  });

  document.getElementById('saveCustomWater').onclick = async () => {
    const ml = Number(document.getElementById('customWater').value || 0);
    if (!ml) return;
    await createLog({ type: 'water', ml, date: state.selectedDate });
    closeModal();
    await refresh();
  };
}

function mapProduct(item) {
  return {
    name: item.name || 'Без названия',
    brand: item.brand || '',
    image: item.image || '',
    calories_100g: Number(item.calories_100g || 0),
    protein_100g: Number(item.protein_100g || 0),
    fat_100g: Number(item.fat_100g || 0),
    carbs_100g: Number(item.carbs_100g || 0),
    barcode: item.barcode || '',
  };
}

function openFoodModal({ meal = 'snacks', product = null, entry = null } = {}) {
  let selected = product ? mapProduct(product) : null;
  let selectedMeal = meal;
  let grams = Number(entry?.grams || 100);

  openModal(`
    <h2>${entry ? 'Редактировать еду' : 'Добавить еду'}</h2>
    <div class='food-flow'>
      <div class='search-toolbar'>
        <input id='foodQuery' placeholder='Поиск продукта'>
        <button class='primary' id='foodSearchBtn'>Искать</button>
      </div>
      <div class='search-toolbar'>
        <input id='barcodeInput' placeholder='Штрихкод'>
        <button class='ghost' id='barcodeFindBtn'>Сканировать штрихкод</button>
      </div>
      <div id='foodSearchResults' class='food-results'></div>
      <hr>
      <div id='selectedFoodBox' class='card tight'></div>
      <label>Граммы<input id='foodGrams' type='number' value='${grams}'></label>
      <label>Приём пищи
        <select id='foodMeal'>${MEAL_TYPES.map((m) => `<option ${m.key===selectedMeal?'selected':''} value='${m.key}'>${m.label}</option>`).join('')}</select>
      </label>
      <div id='foodPreview' class='muted'></div>
      <div class='modal-actions'>
        <button class='ghost' id='toggleFavoriteBtn'>☆ В избранное</button>
        <button class='primary' id='saveFoodEntryBtn'>${entry ? 'Сохранить изменения' : 'Добавить в дневник'}</button>
      </div>
      <button class='ghost' id='manualFoodBtn'>+ Ручное добавление продукта</button>
    </div>
  `);

  const findBtn = document.getElementById('foodSearchBtn');
  const queryInput = document.getElementById('foodQuery');
  const resultsEl = document.getElementById('foodSearchResults');
  const selectedBox = document.getElementById('selectedFoodBox');
  const gramsInput = document.getElementById('foodGrams');
  const previewEl = document.getElementById('foodPreview');
  const mealEl = document.getElementById('foodMeal');

  function renderSelected() {
    selectedMeal = mealEl.value;
    grams = Number(gramsInput.value || 0);
    if (!selected) {
      selectedBox.innerHTML = '<p class="muted">Выберите продукт</p>';
      previewEl.textContent = 'КБЖУ пересчитается после выбора продукта и граммовки.';
      return;
    }
    selectedBox.innerHTML = `<h4>${selected.name}</h4><p class='muted'>${selected.brand || 'Без бренда'} · ${selected.calories_100g} kcal/100g</p>`;
    const factor = grams / 100;
    previewEl.innerHTML = `Итого: ${Math.round(selected.calories_100g * factor)} kcal · P ${(selected.protein_100g * factor).toFixed(1)} · F ${(selected.fat_100g * factor).toFixed(1)} · C ${(selected.carbs_100g * factor).toFixed(1)}`;
  }

  renderSelected();

  findBtn.onclick = async () => {
    const q = queryInput.value.trim();
    if (!q) return;
    resultsEl.innerHTML = '<p class="muted">Загрузка...</p>';
    try {
      const data = await searchFoods(q);
      const items = data.items || [];
      if (!items.length) {
        resultsEl.innerHTML = '<p class="muted">Ничего не найдено</p>';
        return;
      }
      resultsEl.innerHTML = items.map((item, idx) => `
        <article class='food-item' data-idx='${idx}'>
          <div class='food-item__left'>${item.image ? `<img src='${item.image}' alt=''>` : '<div class="food-fallback">🍽️</div>'}
            <div><h4>${item.name}</h4><p>${item.brand || '—'} · ${item.calories_100g} kcal/100g</p></div>
          </div>
          <button class='ghost pick-food' data-idx='${idx}'>Выбрать</button>
        </article>
      `).join('');
      resultsEl.querySelectorAll('.pick-food').forEach((btn) => {
        btn.onclick = () => {
          selected = mapProduct(items[Number(btn.dataset.idx)]);
          renderSelected();
        };
      });
    } catch {
      resultsEl.innerHTML = '<p class="muted">Ошибка поиска</p>';
    }
  };

  document.getElementById('barcodeFindBtn').onclick = async () => {
    const codeInput = document.getElementById('barcodeInput');
    let code = codeInput.value.trim();
    if (!code && 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia) {
      code = await scanBarcodeWithCamera();
      if (code) codeInput.value = code;
    }
    if (!code) return;
    const data = await findFoodByBarcode(code);
    if (!data.item) {
      resultsEl.innerHTML = '<p class="muted">Штрихкод не найден. Попробуйте поиск или ручной ввод.</p>';
      return;
    }
    selected = mapProduct(data.item);
    renderSelected();
  };

  document.getElementById('manualFoodBtn').onclick = () => {
    selected = {
      name: prompt('Название продукта') || 'Мой продукт',
      brand: '',
      calories_100g: Number(prompt('Калории на 100г', '150') || 0),
      protein_100g: Number(prompt('Белки на 100г', '8') || 0),
      fat_100g: Number(prompt('Жиры на 100г', '5') || 0),
      carbs_100g: Number(prompt('Углеводы на 100г', '12') || 0),
    };
    renderSelected();
  };

  gramsInput.oninput = renderSelected;
  mealEl.onchange = renderSelected;

  document.getElementById('toggleFavoriteBtn').onclick = async () => {
    if (!selected) return;
    const exists = state.favorites.some((x) => x.name === selected.name && x.brand === selected.brand);
    await toggleFavorite(selected, exists);
    await refresh();
    closeModal();
  };

  document.getElementById('saveFoodEntryBtn').onclick = async () => {
    if (!selected) return;
    const gramsNow = Number(gramsInput.value || 0);
    if (!gramsNow) return;
    const factor = gramsNow / 100;
    const payload = {
      type: 'calories',
      date: state.selectedDate,
      meal: mealEl.value,
      name: selected.name,
      brand: selected.brand,
      image: selected.image,
      barcode: selected.barcode,
      grams: gramsNow,
      calories_100g: selected.calories_100g,
      protein_100g: selected.protein_100g,
      fat_100g: selected.fat_100g,
      carbs_100g: selected.carbs_100g,
      kcal: selected.calories_100g * factor,
      protein: selected.protein_100g * factor,
      fat: selected.fat_100g * factor,
      carbs: selected.carbs_100g * factor,
    };
    if (entry?.id) await updateLog(entry.id, payload);
    else await createLog(payload);
    closeModal();
    await refresh();
  };
}

async function scanBarcodeWithCamera() {
  if (!('BarcodeDetector' in window)) return '';
  const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

  return new Promise((resolve) => {
    openModal(`
      <h2>Сканирование штрихкода</h2>
      <video id='barcodeVideo' autoplay playsinline style='width:100%;border-radius:12px;'></video>
      <button class='ghost' id='stopScanBtn'>Отмена</button>
    `);

    const video = document.getElementById('barcodeVideo');
    video.srcObject = stream;
    let active = true;

    document.getElementById('stopScanBtn').onclick = () => {
      active = false;
      stream.getTracks().forEach((t) => t.stop());
      closeModal();
      resolve('');
    };

    const loop = async () => {
      if (!active) return;
      const codes = await detector.detect(video).catch(() => []);
      if (codes.length) {
        const value = codes[0].rawValue || '';
        stream.getTracks().forEach((t) => t.stop());
        closeModal();
        resolve(value);
        return;
      }
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  });
}

function openEditMetricModal(type, id) {
  const map = {
    water: { field: 'ml', title: 'Вода, мл' },
    sleep: { field: 'minutes', title: 'Сон, минуты' },
    weight: { field: 'kg', title: 'Вес, кг' },
  };
  const cfg = map[type];
  if (!cfg) return;
  const entry = getLogById(type, id);
  if (!entry) return;

  const currentValue = Number(entry[cfg.field] || 0);
  const step = type === 'weight' ? " step='0.1'" : '';
  openModal(`<h2>Редактировать</h2><label>${cfg.title}<input id='editMetricValue' type='number'${step} value='${currentValue}'></label><button class='primary' id='saveMetricEdit'>Сохранить</button>`);

  document.getElementById('saveMetricEdit').onclick = async () => {
    const value = Number(document.getElementById('editMetricValue').value || 0);
    if (!value) return;
    await updateLog(id, { type, [cfg.field]: value, date: state.selectedDate });
    closeModal();
    await refresh();
  };
}

bindRootEvents();
refresh();
