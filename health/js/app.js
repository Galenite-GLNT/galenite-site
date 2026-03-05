const goals = { calories: 2200, water: 2500, sleep: 8 };
const cards = document.getElementById('cards');
const statusLine = document.getElementById('statusLine');
const todayLine = document.getElementById('todayLine');
const coach = document.getElementById('coach');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');

todayLine.textContent = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

document.getElementById('logoutBtn').onclick = async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/auth/?return=/health/';
};
document.getElementById('closeModal').onclick = () => modal.classList.add('hidden');

async function api(path, options = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!r.ok) throw new Error('API');
  return r.json();
}

function ring(percent, text) {
  return `<div class="ring" style="--p:${Math.min(100, percent)}%"><span>${text}</span></div>`;
}

function bars(data) {
  const max = Math.max(1, ...data);
  return `<div class="bars">${data.map((v) => `<div class="bar" style="height:${(v / max) * 100}%"></div>`).join('')}</div>`;
}

function sparkline(data) {
  if (!data.length) return '';
  const max = Math.max(...data), min = Math.min(...data);
  const points = data.map((v, i) => `${(i / (data.length - 1 || 1)) * 100},${50 - ((v - min) / (max - min || 1)) * 40}`).join(' ');
  return `<svg class="spark" viewBox="0 0 100 50"><polyline fill="none" stroke="#111827" stroke-width="2" points="${points}"/></svg>`;
}

function openModal(type, summary) {
  modal.classList.remove('hidden');
  if (type === 'water') {
    modalContent.innerHTML = `<h2>Вода</h2><input id='waterMl' type='number' placeholder='мл'><button class='primary' id='saveWater'>Добавить</button>`;
    document.getElementById('saveWater').onclick = async () => {
      await api('/api/health/water', { method: 'POST', body: JSON.stringify({ ml: Number(document.getElementById('waterMl').value) }) });
      modal.classList.add('hidden'); refresh();
    };
  }
  if (type === 'sleep') {
    modalContent.innerHTML = `<h2>Сон</h2><input id='sleepHours' type='number' step='0.1' placeholder='часы'><button class='primary' id='saveSleep'>Добавить</button>`;
    document.getElementById('saveSleep').onclick = async () => {
      await api('/api/health/sleep', { method: 'POST', body: JSON.stringify({ duration_minutes: Number(document.getElementById('sleepHours').value) * 60 }) });
      modal.classList.add('hidden'); refresh();
    };
  }
  if (type === 'weight') {
    modalContent.innerHTML = `<h2>Вес</h2><input id='weightKg' type='number' step='0.1' placeholder='кг'><button class='primary' id='saveWeight'>Добавить</button>`;
    document.getElementById('saveWeight').onclick = async () => {
      await api('/api/health/weight', { method: 'POST', body: JSON.stringify({ kg: Number(document.getElementById('weightKg').value) }) });
      modal.classList.add('hidden'); refresh();
    };
  }
  if (type === 'calories') {
    modalContent.innerHTML = `<h2>Питание по штрихкоду</h2><input id='barcode' placeholder='штрихкод'><input id='grams' type='number' value='100'><div id='productName' class='muted'></div><button class='primary' id='findProduct'>Найти</button><button class='primary' id='saveFood'>Добавить в дневник</button>`;
    let product = null;
    document.getElementById('findProduct').onclick = async () => {
      const data = await api('/api/products/barcode?value=' + encodeURIComponent(document.getElementById('barcode').value));
      product = data.product;
      document.getElementById('productName').textContent = `${product.name} (${product.kcal_100g} ккал/100г)`;
    };
    document.getElementById('saveFood').onclick = async () => {
      if (!product) return;
      const grams = Number(document.getElementById('grams').value || 100);
      const factor = grams / 100;
      await api('/api/health/meal-item', { method: 'POST', body: JSON.stringify({ product_id: product.id, grams, kcal: product.kcal_100g * factor, p: product.protein_100g * factor, f: product.fat_100g * factor, c: product.carbs_100g * factor }) });
      modal.classList.add('hidden'); refresh();
    };
  }
}

async function refresh() {
  const me = await api('/api/auth/me');
  if (!me.user) {
    window.location.href = '/auth/?return=/health/';
    return;
  }
  const summary = await api('/api/health/summary');
  statusLine.textContent = `Ты на ${Math.round((summary.water / goals.water) * 100)}% от цели по воде`;

  cards.innerHTML = `
    <article class='card' data-type='calories'><h3>Calories</h3><div class='metric'>${Math.round(summary.calories)} <span class='muted'>kcal</span></div>${ring((summary.calories / goals.calories) * 100, `${Math.round((summary.calories / goals.calories) * 100)}%`)}</article>
    <article class='card' data-type='water'><h3>Water</h3><div class='metric'>${Math.round(summary.water)} <span class='muted'>ml</span></div>${ring((summary.water / goals.water) * 100, `${Math.round((summary.water / goals.water) * 100)}%`)}</article>
    <article class='card' data-type='sleep'><h3>Sleep</h3><div class='metric'>${summary.sleepHours.toFixed(1)} <span class='muted'>hours</span></div>${bars(summary.sleepTrend.length ? summary.sleepTrend : [4,5,6,7,6,8,7])}</article>
    <article class='card' data-type='weight'><h3>Weight</h3><div class='metric'>${summary.weight ? Number(summary.weight).toFixed(1) : '—'} <span class='muted'>kg</span></div>${sparkline(summary.weightTrend)}</article>
  `;

  cards.querySelectorAll('.card').forEach((el) => el.onclick = () => openModal(el.dataset.type, summary));

  const advice = await api('/api/ai/health-coach', { method: 'POST', body: JSON.stringify({ metrics: summary, goals }) });
  coach.innerHTML = `<h3>AI Coach</h3><p>${advice.advice}</p>`;
}

refresh();
