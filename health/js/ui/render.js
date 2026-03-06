import { MEAL_TYPES, NAV_ITEMS } from '../lib/constants.js';
import { buildDisplayName, initials, fmtNum } from '../lib/utils.js';
import { progress } from '../lib/calculations.js';

export function renderShell(state) {
  document.getElementById('todayLine').textContent = new Date(state.selectedDate).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  const display = buildDisplayName(state.me);
  document.getElementById('accountName').textContent = display;
  const avatar = document.getElementById('accountAvatar');
  if (state.me?.photo_url) avatar.innerHTML = `<img src="${state.me.photo_url}" alt="avatar">`;
  else avatar.textContent = initials(display);

  renderNav(state.section);
  renderSections(state);
}

export function renderNav(active) {
  const side = document.getElementById('sideNav');
  const bottom = document.getElementById('bottomNav');
  const make = (item) => `<button class="nav-btn ${item.key === active ? 'active' : ''}" data-nav="${item.key}">${item.label}</button>`;
  side.innerHTML = NAV_ITEMS.map(make).join('');
  bottom.innerHTML = NAV_ITEMS.slice(0, 5).map(make).join('');
}

function metricCard(title, value, unit, pct, sub = '') {
  return `<article class="card metric-card">
    <div class="card__title">${title}</div>
    <div class="metric">${value}<span class="muted"> ${unit}</span></div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    ${sub ? `<p class="muted">${sub}</p>` : ''}
  </article>`;
}

function formatSleep(summary) {
  if (!summary.sleep.start || !summary.sleep.end) return '—';
  const s = new Date(summary.sleep.start).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const e = new Date(summary.sleep.end).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${s} → ${e}`;
}

function formatSleepDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function weightSparkline(values) {
  if (!values.length) return '<div class="muted">Добавьте вес</div>';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((v, i) => `${(i / (values.length - 1 || 1)) * 100},${40 - ((v - min) / (max - min || 1)) * 30}`).join(' ');
  return `<svg class="spark" viewBox="0 0 100 40"><polyline fill="none" stroke="#0f172a" stroke-width="2" points="${points}"/></svg>`;
}

export function renderSections(state) {
  const root = document.getElementById('sections');
  const s = state.summary;
  const g = state.goals;

  const mealBlocks = s.meals.map((meal) => `
    <section class="card meal-card" data-meal="${meal.key}">
      <div class="meal-head"><h3>${meal.label}</h3><button class="ghost" data-action="add-food" data-meal="${meal.key}">+ Добавить еду</button></div>
      ${meal.entries.length ? `<ul class="entry-list">${meal.entries.map((e) => `<li><div><b>${e.name || 'Без названия'}</b><p class="muted">${fmtNum(e.grams, 0)} г · ${fmtNum(e.kcal, 0)} kcal · P${fmtNum(e.protein, 1)} F${fmtNum(e.fat, 1)} C${fmtNum(e.carbs, 1)}</p></div><div class="entry-actions"><button class="ghost" data-action="edit-food" data-id="${e.id}">Изм.</button><button class="ghost" data-action="delete-log" data-type="calories" data-id="${e.id}">Удалить</button></div></li>`).join('')}</ul>` : '<p class="muted">Пока пусто</p>'}
      <div class="meal-totals muted">Итого: ${fmtNum(meal.totals.calories, 0)} kcal · P${fmtNum(meal.totals.protein, 1)} F${fmtNum(meal.totals.fat, 1)} C${fmtNum(meal.totals.carbs, 1)}</div>
    </section>
  `).join('');

  root.innerHTML = `
    <section class="view ${state.section === 'today' ? 'active' : ''}" data-view="today">
      <div class="cards-grid">
        ${metricCard('Calories', fmtNum(s.totals.calories, 0), 'kcal', progress(s.totals.calories, g.calories), `Цель ${g.calories}`)}
        ${metricCard('Protein', fmtNum(s.totals.protein, 1), 'g', progress(s.totals.protein, g.protein), `Цель ${g.protein}`)}
        ${metricCard('Fat', fmtNum(s.totals.fat, 1), 'g', progress(s.totals.fat, g.fat), `Цель ${g.fat}`)}
        ${metricCard('Carbs', fmtNum(s.totals.carbs, 1), 'g', progress(s.totals.carbs, g.carbs), `Цель ${g.carbs}`)}
        ${metricCard('Water', fmtNum(s.totals.water, 0), 'ml', progress(s.totals.water, g.water), `<button class='ghost' data-action='quick-water'>+ вода</button>`)}
        ${metricCard('Sleep', formatSleep(s), '', progress(s.sleep.minutes / 60, g.sleep), formatSleepDuration(s.sleep.minutes))}
        <article class="card metric-card"><div class="card__title">Weight</div><div class="metric">${fmtNum(s.weight.current, 1)}<span class="muted"> kg</span></div>${weightSparkline(s.weight.trend)}<p class="muted">7д: ${fmtNum(s.weight.weekDelta,1)} кг · 30д: ${fmtNum(s.weight.monthDelta,1)} кг</p></article>
      </div>

      <section class="coach card">
        <div class="meal-head"><h3>AI Coach</h3><span class="pill">online</span></div>
        <div class="coach-ask">
          <input id="coachQuestion" placeholder="Спроси коуча" value="Что мне улучшить сегодня по питанию, воде и сну?">
          <button class="primary" data-action="ask-coach">Спросить</button>
        </div>
        <div id="coachOutput" class="coach-list"><p class="muted">Спроси коуча, чтобы получить рекомендации.</p></div>
      </section>

      <section class="food-log">${mealBlocks}</section>
    </section>

    <section class="view ${state.section === 'food' ? 'active' : ''}" data-view="food">
      <section class="card">
        <div class="meal-head"><h3>Food log</h3><button class="ghost" data-action="add-food" data-meal="breakfast">+ Добавить</button></div>
        ${mealBlocks}
      </section>
      <section class="card">
        <h3>Recent foods</h3>
        ${state.recentFoods.length ? `<ul class='entry-list'>${state.recentFoods.map((f) => `<li><div><b>${f.name}</b><p class='muted'>${f.brand || '—'} · ${fmtNum(f.calories_100g,0)} kcal/100g</p></div><button class='ghost' data-action='reuse-food' data-food='${encodeURIComponent(JSON.stringify(f))}'>Быстро добавить</button></li>`).join('')}</ul>` : '<p class="muted">Пока пусто</p>'}
      </section>
      <section class="card">
        <h3>Favorites</h3>
        ${state.favorites.length ? `<ul class='entry-list'>${state.favorites.map((f) => `<li><div><b>${f.name}</b><p class='muted'>${f.brand || '—'}</p></div><button class='ghost' data-action='reuse-food' data-food='${encodeURIComponent(JSON.stringify(f))}'>Добавить</button></li>`).join('')}</ul>` : '<p class="muted">Нет избранного</p>'}
      </section>
    </section>

    <section class="view ${state.section === 'progress' ? 'active' : ''}" data-view="progress">
      <section class="card"><h3>Weight trend</h3>${weightSparkline(s.weight.trend)}<p class='muted'>Изменение за неделю: ${fmtNum(s.weight.weekDelta,1)} кг</p></section>
      <section class="card"><h3>Water history</h3>${renderSimpleList(state.logs.water, (x)=>`${new Date(x.datetime).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} · ${fmtNum(x.ml,0)} мл`, 'water')}</section>
      <section class="card"><h3>Sleep history</h3>${renderSimpleList(state.logs.sleep, (x)=>`${new Date(x.start_time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} → ${new Date(x.end_time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} · ${formatSleepDuration(Number(x.minutes||0))}`, 'sleep')}</section>
    </section>

    <section class="view ${state.section === 'goals' ? 'active' : ''}" data-view="goals">
      <section class='card'>
        <h3>Goals</h3>
        <form id='goalsForm' class='form-grid'>
          ${['calories','protein','fat','carbs','water','sleep','weight'].map((k)=>`<label>${k}<input name='${k}' type='number' step='0.1' value='${g[k] ?? ''}'></label>`).join('')}
          <button class='primary' type='submit'>Сохранить цели</button>
        </form>
      </section>
    </section>

    <section class="view ${state.section === 'profile' ? 'active' : ''}" data-view="profile">
      <section class='card'>
        <h3>Profile</h3>
        <form id='profileForm' class='form-grid'>
          <label>Display name<input name='display_name' value='${state.profile.display_name || ''}'></label>
          <label>Gender<input name='gender' value='${state.profile.gender || ''}'></label>
          <label>Height cm<input type='number' name='height_cm' value='${state.profile.height_cm || ''}'></label>
          <label>Age<input type='number' name='age' value='${state.profile.age || ''}'></label>
          <label>Activity<input name='activity_level' value='${state.profile.activity_level || ''}'></label>
          <label>Current weight<input type='number' step='0.1' name='current_weight' value='${state.profile.current_weight || ''}'></label>
          <label>Target weight<input type='number' step='0.1' name='target_weight' value='${state.profile.target_weight || ''}'></label>
          <button class='primary' type='submit'>Сохранить профиль</button>
        </form>
      </section>
    </section>

    <section class="view ${state.section === 'history' ? 'active' : ''}" data-view="history">
      <section class='card'>
        <div class='meal-head'><h3>История</h3><input id='historyDate' type='date' value='${state.selectedDate}'></div>
        <p class='muted'>Выберите дату и редактируйте записи того дня.</p>
        ${mealBlocks}
      </section>
    </section>
  `;
}

function renderSimpleList(items, map, type) {
  if (!items.length) return '<p class="muted">Нет записей</p>';
  return `<ul class='entry-list'>${items.map((x) => `<li><div>${map(x)}</div><div class='entry-actions'><button class='ghost' data-action='edit-log' data-type='${type}' data-id='${x.id}'>Изм.</button><button class='ghost' data-action='delete-log' data-type='${type}' data-id='${x.id}'>Удалить</button></div></li>`).join('')}</ul>`;
}

export function renderCoachResponse(data) {
  const out = document.getElementById('coachOutput');
  if (!out) return;
  const tips = Array.isArray(data.tips) ? data.tips : [];
  out.innerHTML = `
    ${data.summary ? `<article class='coach-tip'><h4>Итог</h4><p>${data.summary}</p></article>` : ''}
    ${tips.map((tip) => `<article class='coach-tip'><p>${tip}</p></article>`).join('') || '<p class="muted">Нет подсказок.</p>'}
  `;
}
