/* Galenite Health — single-file front-end MVP
   - LocalStorage data model (food/sleep/water)
   - Nice dashboard charts (Chart.js)
   - Telegram auth placeholders (Login Widget + WebApp initData)

   Hook points:
   - auth: /api/auth/telegram (validate hash/initData on backend)
   - data sync: /api/health/*
*/

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const todayISO = () => new Date().toISOString().slice(0,10);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(n);

const ICONS = {
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.8 5.8L20 10l-6.2 2.2L12 18l-1.8-5.8L4 10l6.2-2.2L12 2z"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13a9 9 0 1 1 18 0"/><path d="M12 7v5l3 3"/><path d="M3 13h18"/></svg>`,
  food: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h16"/><path d="M6 3v7a6 6 0 0 0 12 0V3"/><path d="M7 21h10"/><path d="M12 14v7"/></svg>`,
  sleep: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9 7 7 0 0 1 0-14 9 9 0 0 0 9 5z"/></svg>`,
  water: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12z"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 3.4 17l.06-.06A1.65 1.65 0 0 0 3.79 15a1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 6.03 3.4l.06.06A1.65 1.65 0 0 0 7.91 3.79 1.65 1.65 0 0 0 9.42 2.28V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06A2 2 0 1 1 20.6 7l-.06.06A1.65 1.65 0 0 0 20.21 9a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
};

const Storage = {
  key: 'glnt.health.v1',
  load(){
    try{
      const raw = localStorage.getItem(this.key);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch{ return null; }
  },
  save(data){
    localStorage.setItem(this.key, JSON.stringify(data));
  },
  reset(){
    localStorage.removeItem(this.key);
  }
};

function seed(){
  // 14 days demo data
  const start = new Date();
  start.setDate(start.getDate() - 13);
  const days = [];
  for(let i=0;i<14;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    const iso = d.toISOString().slice(0,10);
    const kcal = 1700 + Math.round(Math.sin(i/3)*220) + (i%4===0?120:0);
    const p = Math.round(kcal*0.28/4);
    const f = Math.round(kcal*0.30/9);
    const c = Math.round(kcal*0.42/4);
    const water = clamp(1600 + (i%3)*250 + Math.round(Math.cos(i/4)*120), 800, 3200);
    const sleep = clamp(6.2 + Math.sin(i/2)*.8 + (i%5===0?-0.7:0), 4.2, 9.2);
    days.push({
      date: iso,
      food: {
        kcal,
        p, f, c,
        entries: [
          {time:'09:10', title:'Овсянка + ягоды', kcal: Math.round(kcal*0.28)},
          {time:'14:40', title:'Курица + рис', kcal: Math.round(kcal*0.38)},
          {time:'19:30', title:'Салат + творог', kcal: Math.round(kcal*0.26)},
        ]
      },
      water: { ml: water, target: 2200 },
      sleep: { hours: Number(sleep.toFixed(1)), quality: clamp(72 + Math.round(Math.sin(i/3)*10), 45, 95) },
      weight: { kg: Number((62.4 - i*0.05 + Math.sin(i/3)*0.15).toFixed(1)) },
    });
  }
  return {
    user: { name: 'Гость', handle: '@guest', auth: { provider: 'local-demo' } },
    targets: {
      kcal: 1850,
      p: 120,
      f: 65,
      c: 180,
      waterMl: 2200,
      sleepH: 8.0,
    },
    days,
    ui: { lastRoute: 'dashboard' }
  };
}

const State = {
  data: Storage.load() ?? seed(),
  save(){ Storage.save(this.data); },
  getDay(date=todayISO()){
    let d = this.data.days.find(x=>x.date===date);
    if(!d){
      d = { date, food:{kcal:0,p:0,f:0,c:0,entries:[]}, water:{ml:0,target:this.data.targets.waterMl}, sleep:{hours:0,quality:0}, weight:{kg:null} };
      this.data.days.push(d);
      this.data.days.sort((a,b)=>a.date.localeCompare(b.date));
      this.save();
    }
    return d;
  }
};

const Toast = {
  el: null,
  ensure(){
    if(this.el) return;
    this.el = document.createElement('div');
    this.el.className = 'toastwrap';
    document.body.appendChild(this.el);
  },
  show({title, text, kind='ok'}={}){
    this.ensure();
    const t = document.createElement('div');
    t.className='toast';
    t.innerHTML = `${kind==='ok'?ICONS.check:ICONS.warn}<div><b>${escapeHtml(title||'Готово')}</b><div><span>${escapeHtml(text||'')}</span></div></div>`;
    this.el.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(6px)'; t.style.transition='all .22s ease'; }, 2600);
    setTimeout(()=>t.remove(), 3100);
  }
};

function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
}

const Router = {
  route: State.data.ui?.lastRoute || 'dashboard',
  set(route){
    this.route = route;
    State.data.ui.lastRoute = route;
    State.save();
    render();
  }
};

let charts = [];
function destroyCharts(){ charts.forEach(c=>{ try{c.destroy();}catch{}}); charts=[]; }

function shellHTML(){
  const u = State.data.user;
  return `
  <div class="shell">
    <div class="topbar">
      <div class="topbar__row">
        <div class="brand">
          <div class="brand__mark"></div>
          <div class="brand__txt">
            <b>Galenite Health</b>
            <span>KBJU • сон • вода • привычки</span>
          </div>
        </div>
        <div class="actions">
          <div class="pill" title="Быстрый поиск по продуктам (демо)">
            <span class="pill__icon">${ICONS.search}</span>
            <input id="search" placeholder="Поиск: курица, рис, протеин…" />
          </div>
          <button class="btn btn--primary" id="quickAdd">${ICONS.plus}<span>Записать</span></button>
          <button class="btn" id="aiHint" title="Подсказки по привычкам">${ICONS.spark}</button>
        </div>
      </div>
    </div>

    <div class="layout">
      <aside class="side">
        <div class="nav">
          <div class="nav__head">
            <div class="profile">
              <div class="profile__left">
                <div class="avatar"></div>
                <div class="profile__meta">
                  <b>${escapeHtml(u.name)}</b>
                  <span>${escapeHtml(u.handle || u.auth?.provider || '')}</span>
                </div>
              </div>
              <span class="badge">${escapeHtml((u.auth?.provider||'').replace('local-demo','demo'))}</span>
            </div>
          </div>
          <div class="nav__items">
            ${navItem('dashboard','Дашборд',ICONS.dashboard)}
            ${navItem('nutrition','Питание',ICONS.food)}
            ${navItem('sleep','Сон',ICONS.sleep)}
            ${navItem('water','Вода',ICONS.water)}
            ${navItem('goals','Цели',ICONS.target)}
            ${navItem('settings','Настройки',ICONS.settings)}
          </div>
          <div class="nav__foot">
            <button class="btn btn--ghost" id="tgLogin">Telegram</button>
            <button class="btn btn--danger" id="reset">${ICONS.logout}<span>Сброс</span></button>
          </div>
        </div>
      </aside>

      <main class="main">
        <div id="view"></div>
      </main>
    </div>
  </div>`;
}

function navItem(id,label,icon){
  const cls = id===Router.route ? 'nav__item nav__item--active' : 'nav__item';
  return `<div class="${cls}" data-route="${id}">${icon}<div>${escapeHtml(label)}</div></div>`;
}

function viewDashboard(){
  const t = State.data.targets;
  const d = State.getDay();

  const last7 = lastNDays(7);
  const avgKcal = Math.round(avg(last7.map(x=>x.food.kcal)));
  const avgSleep = Number(avg(last7.map(x=>x.sleep.hours)).toFixed(1));
  const avgWater = Math.round(avg(last7.map(x=>x.water.ml)));

  return `
    <h1 class="h1">Сегодня</h1>
    <p class="sub">Снимок по метрикам + 7‑дневные тренды. Без лишнего шума.</p>

    <div class="grid grid--3">
      ${kpiCard('Калории', `${fmt(d.food.kcal)}`, `ккал из ${fmt(t.kcal)}`, deltaText(d.food.kcal - t.kcal), 'kpi-kcal')}
      ${kpiCard('Сон', `${d.sleep.hours||0}`, `ч из ${t.sleepH}`, qualityText(d.sleep.quality), 'kpi-sleep')}
      ${kpiCard('Вода', `${fmt(d.water.ml)}`, `мл из ${fmt(t.waterMl)}`, waterHint(d.water.ml, t.waterMl), 'kpi-water')}
    </div>

    <div class="grid grid--2" style="margin-top:14px">
      <div class="card"><div class="card__in">
        <div class="card__head">
          <div class="card__title"><b>Макросы</b><span>КБЖУ за сегодня</span></div>
          <span class="badge">граммы</span>
        </div>
        <div class="grid" style="grid-template-columns: 220px 1fr; align-items:center; gap:14px">
          <canvas id="macroDonut" height="220"></canvas>
          <div class="grid" style="gap:10px">
            ${macroRow('Белки', d.food.p, t.p)}
            ${macroRow('Жиры', d.food.f, t.f)}
            ${macroRow('Углеводы', d.food.c, t.c)}
            <div class="sep"></div>
            <div class="small">Фишка: на больших данных можно добавить микро‑нутриенты как в Cronometer (железо, магний и т.д.).</div>
          </div>
        </div>
      </div></div>

      <div class="card"><div class="card__in">
        <div class="card__head">
          <div class="card__title"><b>Тренды</b><span>7 дней — калории, вода, сон</span></div>
          <span class="badge">avg: ${fmt(avgKcal)} ккал • ${fmt(avgWater)} мл • ${avgSleep} ч</span>
        </div>
        <canvas id="trendLine" height="250"></canvas>
      </div></div>
    </div>

    <div class="grid grid--2" style="margin-top:14px">
      <div class="card"><div class="card__in">
        <div class="card__head">
          <div class="card__title"><b>Лента питания</b><span>Что ты записал сегодня</span></div>
          <button class="btn" data-open="meal">${ICONS.plus}<span>Добавить</span></button>
        </div>
        ${foodTable(d)}
      </div></div>

      <div class="card"><div class="card__in">
        <div class="card__head">
          <div class="card__title"><b>Быстрые действия</b><span>Минимум кликов</span></div>
          <span class="badge">habit loop</span>
        </div>
        <div class="row">
          <button class="btn" data-open="water">${ICONS.water}<span>+250 мл</span></button>
          <button class="btn" data-open="sleep">${ICONS.sleep}<span>Записать сон</span></button>
          <button class="btn" data-open="meal">${ICONS.food}<span>Записать приём</span></button>
        </div>
        <div class="sep"></div>
        <div class="small">Фокус на UX как у топ‑трекеров: быстрые кнопки, аккуратные отчёты, и ноль дешёвых градиентов “вырви‑глаз”.</div>
      </div></div>
    </div>
  `;
}

function kpiCard(title, big, unit, delta, id){
  return `
    <div class="card" id="${id}"><div class="card__in">
      <div class="card__head">
        <div class="card__title"><b>${escapeHtml(title)}</b><span>за сегодня</span></div>
        <span class="badge">7д: см. тренд</span>
      </div>
      <div class="kpi">
        <div class="kpi__big">${escapeHtml(String(big))}</div>
        <div class="kpi__unit">${escapeHtml(String(unit))}</div>
        <div class="kpi__delta">${escapeHtml(String(delta))}</div>
      </div>
    </div></div>`;
}

function macroRow(name, val, target){
  const pct = target ? clamp(Math.round(val/target*100),0,200) : 0;
  return `
    <div style="display:grid; gap:6px">
      <div style="display:flex; justify-content:space-between; font-size:13px">
        <span>${escapeHtml(name)}</span>
        <span style="color: var(--muted)">${fmt(val)} / ${fmt(target)} г • ${pct}%</span>
      </div>
      <div style="height:10px; border-radius:999px; background: rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.10); overflow:hidden">
        <div style="height:100%; width:${clamp(pct,0,100)}%; border-radius:999px; background: linear-gradient(135deg, rgba(99,102,241,.9), rgba(16,185,129,.85));"></div>
      </div>
    </div>`;
}

function foodTable(d){
  if(!d.food.entries.length){
    return `<div class="small">Пока пусто. Жми <b>“Добавить”</b> — и поехали.</div>`;
  }
  const rows = d.food.entries.map((e, i)=>`<tr>
    <td style="width:86px; color:var(--muted)">${escapeHtml(e.time)}</td>
    <td>${escapeHtml(e.title)}</td>
    <td style="width:110px; text-align:right">${fmt(e.kcal)} ккал</td>
    <td style="width:60px; text-align:right"><button class="btn btn--ghost" data-del-meal="${i}" title="Удалить">✕</button></td>
  </tr>`).join('');
  return `
    <table class="table">
      <thead><tr><th>Время</th><th>Еда</th><th style="text-align:right">Ккал</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function deltaText(delta){
  if(delta===0) return 'в ноль';
  return delta>0 ? `+${fmt(delta)} ккал` : `${fmt(delta)} ккал`;
}
function qualityText(q){
  if(!q) return 'без оценки';
  if(q>=85) return 'качество: топ';
  if(q>=70) return 'качество: норм';
  if(q>=55) return 'качество: так себе';
  return 'качество: плохо';
}
function waterHint(ml, target){
  const pct = target ? Math.round(ml/target*100) : 0;
  if(pct>=100) return 'цель закрыта';
  if(pct>=70) return 'почти';
  if(pct>=40) return 'ещё чуть';
  return 'надо долить';
}

function lastNDays(n){
  const arr = State.data.days.slice(-n);
  if(arr.length===n) return arr;
  // pad with empty days if needed
  const missing = n - arr.length;
  const pad = [];
  for(let i=missing;i>0;i--){
    const d = new Date();
    d.setDate(d.getDate()- (arr.length+i-1));
    pad.push({date:d.toISOString().slice(0,10), food:{kcal:0,p:0,f:0,c:0,entries:[]}, water:{ml:0}, sleep:{hours:0,quality:0}, weight:{kg:null}});
  }
  return pad.concat(arr);
}

function avg(xs){
  const v = xs.filter(x=>Number.isFinite(x));
  if(!v.length) return 0;
  return v.reduce((a,b)=>a+b,0)/v.length;
}

function viewNutrition(){
  const t = State.data.targets;
  const d = State.getDay();
  return `
    <h1 class="h1">Питание</h1>
    <p class="sub">Запись КБЖУ и еды. Тут не “калории ради калорий”, а контроль привычек.</p>

    <div class="grid grid--2">
      <div class="card"><div class="card__in">
        <div class="card__head">
          <div class="card__title"><b>Калории</b><span>сегодня + 14 дней</span></div>
          <button class="btn" data-open="meal">${ICONS.plus}<span>Приём</span></button>
        </div>
        <canvas id="kcalBar" height="260"></canvas>
        <div class="sep"></div>
        <div class="small">Идея из “премиум‑дашбордов”: показываем и цель, и фактическое, и среднее — чтобы решения были по факту, а не по настроению.</div>
      </div></div>

      <div class="card"><div class="card__in">
        <div class="card__head">
          <div class="card__title"><b>Макросы</b><span>кольца + детализация</span></div>
          <span class="badge">P/F/C</span>
        </div>
        <div class="grid" style="grid-template-columns: 220px 1fr; align-items:center; gap:14px">
          <canvas id="macroDonut2" height="220"></canvas>
          <div class="grid" style="gap:10px">
            ${macroRow('Белки', d.food.p, t.p)}
            ${macroRow('Жиры', d.food.f, t.f)}
            ${macroRow('Углеводы', d.food.c, t.c)}
          </div>
        </div>
        <div class="sep"></div>
        ${foodTable(d)}
      </div></div>
    </div>
  `;
}

function viewSleep(){
  const t = State.data.targets;
  const d = State.getDay();
  return `
    <h1 class="h1">Сон</h1>
    <p class="sub">Время сна + качество. Идея: дальше можно подмешать “готовность” (HRV/пульс), если будет источник.</p>

    <div class="grid grid--2">
      <div class="card"><div class="card__in">
        <div class="card__head">
          <div class="card__title"><b>Сегодня</b><span>быстрая запись</span></div>
          <button class="btn" data-open="sleep">${ICONS.plus}<span>Записать</span></button>
        </div>
        <div class="grid grid--2">
          <div>
            <div class="label">Длительность</div>
            <div class="kpi"><div class="kpi__big">${d.sleep.hours||0}</div><div class="kpi__unit">ч из ${t.sleepH}</div></div>
          </div>
          <div>
            <div class="label">Качество</div>
            <div class="kpi"><div class="kpi__big">${d.sleep.quality||0}</div><div class="kpi__unit">/100</div></div>
          </div>
        </div>
        <div class="sep"></div>
        <canvas id="sleepLine" height="260"></canvas>
      </div></div>

      <div class="card"><div class="card__in">
        <div class="card__head">
          <div class="card__title"><b>Микроподсказки</b><span>что реально работает</span></div>
          <span class="badge">rules</span>
        </div>
        <div class="grid" style="gap:10px">
          ${tip('Стабильное время', 'Ложиться/вставать примерно в одно и то же время — самый сильный “хак”.')}
          ${tip('Экран', 'Минус яркость и белый фон за 60–90 минут — качество растёт быстро.')}
          ${tip('Кофеин', 'Если сон в минус — сдвигай последний кофе раньше, чем кажется “разумным”.')}
          <div class="sep"></div>
          <div class="small">Это просто copy‑плейсхолдер. Дальше можно заменить на твой “Galenite Coach” (LLM), который будет подсказывать по данным.</div>
        </div>
      </div></div>
    </div>
  `;
}

function tip(title, text){
  return `<div style="padding:12px 12px; border-radius:16px; background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10)">
    <b style="font-size:13px">${escapeHtml(title)}</b>
    <div class="small" style="margin-top:4px">${escapeHtml(text)}</div>
  </div>`;
}

function viewWater(){
  const t = State.data.targets;
  const d = State.getDay();
  const pct = t.waterMl ? clamp(Math.round(d.water.ml/t.waterMl*100),0,200) : 0;
  return `
    <h1 class="h1">Вода</h1>
    <p class="sub">Быстрое добавление “стаканами” как в водных трекерах. Плюс график, чтобы не забывать.</p>

    <div class="grid grid--2">
      <div class="card"><div class="card__in">
        <div class="card__head">
          <div class="card__title"><b>Сегодня</b><span>${pct}% от цели</span></div>
          <button class="btn" data-open="water">${ICONS.plus}<span>Добавить</span></button>
        </div>

        <div style="height:14px; border-radius:999px; background: rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.10); overflow:hidden">
          <div style="height:100%; width:${clamp(pct,0,100)}%; border-radius:999px; background: linear-gradient(135deg, rgba(99,102,241,.9), rgba(16,185,129,.85));"></div>
        </div>

        <div class="sep"></div>
        <div class="row">
          ${[150,250,330,500].map(x=>`<button class="btn" data-add-water="${x}">${ICONS.water}<span>+${x} мл</span></button>`).join('')}
        </div>

        <div class="sep"></div>
        <div class="kpi">
          <div class="kpi__big">${fmt(d.water.ml)}</div>
          <div class="kpi__unit">мл из ${fmt(t.waterMl)}</div>
          <div class="kpi__delta">остаток: ${fmt(Math.max(0, t.waterMl - d.water.ml))} мл</div>
        </div>
      </div></div>

      <div class="card"><div class="card__in">
        <div class="card__head">
          <div class="card__title"><b>14 дней</b><span>динамика воды</span></div>
          <span class="badge">ml/day</span>
        </div>
        <canvas id="waterBar" height="300"></canvas>
        <div class="sep"></div>
        <div class="small">Дальше можно добавить “вода из еды” отдельным слоем (как делают некоторые приложения) — но это уже зависит от твоей БД продуктов.</div>
      </div></div>
    </div>
  `;
}

function viewGoals(){
  const t = State.data.targets;
  return `
    <h1 class="h1">Цели</h1>
    <p class="sub">Настраиваем цель. Это ядро: интерфейс подстраивается под тебя, а не наоборот.</p>

    <div class="card"><div class="card__in">
      <div class="card__head">
        <div class="card__title"><b>Твои таргеты</b><span>локально (пока без сервера)</span></div>
        <span class="badge">v1</span>
      </div>

      <div class="form" style="max-width:720px">
        <div class="form__row">
          ${goalField('Калории (ккал)', 'target_kcal', t.kcal)}
          ${goalField('Вода (мл)', 'target_water', t.waterMl)}
        </div>
        <div class="form__row">
          ${goalField('Белки (г)', 'target_p', t.p)}
          ${goalField('Жиры (г)', 'target_f', t.f)}
        </div>
        <div class="form__row">
          ${goalField('Углеводы (г)', 'target_c', t.c)}
          ${goalField('Сон (ч)', 'target_sleep', t.sleepH)}
        </div>
        <div class="row">
          <button class="btn btn--primary" id="saveGoals">${ICONS.check}<span>Сохранить</span></button>
          <span class="small">Подсказка: можно сделать “режимы” (сушка/поддержание/набор) и переключатель одним кликом.</span>
        </div>
      </div>
    </div></div>
  `;
}

function goalField(label, id, value){
  return `
    <div>
      <div class="label">${escapeHtml(label)}</div>
      <input class="input" id="${id}" type="number" value="${escapeHtml(String(value))}" />
    </div>`;
}

function viewSettings(){
  const u = State.data.user;
  const mode = u.auth?.provider || 'demo';

  return `
    <h1 class="h1">Настройки</h1>
    <p class="sub">Здесь — интеграции и не‑мусорные фичи. В перспективе: импорт из Apple Health/Google Fit, wearables и т.д.</p>

    <div class="grid grid--2">
      <div class="card"><div class="card__in">
        <div class="card__head">
          <div class="card__title"><b>Аккаунт</b><span>авторизация через Telegram</span></div>
          <span class="badge">${escapeHtml(mode)}</span>
        </div>

        <div class="small">Сейчас это фронт‑заготовка. Логика такая:</div>
        <ol class="small" style="margin:10px 0 0 18px; color:var(--muted)">
          <li>На фронте получаем <b>Telegram user</b> (Login Widget) или <b>initData</b> (Telegram WebApp).</li>
          <li>Шлём это на бек: <code>/api/auth/telegram</code>.</li>
          <li>Бек валидирует hash/подпись и создаёт сессию (JWT/cookie).</li>
        </ol>

        <div class="sep"></div>
        <div class="row">
          <button class="btn btn--primary" id="tgLogin2">Telegram Login</button>
          <button class="btn" id="fakeUser">Сменить имя (демо)</button>
        </div>
      </div></div>

      <div class="card"><div class="card__in">
        <div class="card__head">
          <div class="card__title"><b>Данные</b><span>экспорт/импорт</span></div>
          <span class="badge">json</span>
        </div>

        <div class="row">
          <button class="btn" id="export">Экспорт</button>
          <button class="btn" id="import">Импорт</button>
        </div>
        <div class="sep"></div>
        <div class="small">Экспорт — это JSON твоего Health‑модуля. Можно хранить в Git / в Firebase / в твоём BotHive storage.</div>
      </div></div>
    </div>
  `;
}

function render(){
  const app = $('#app');
  destroyCharts();
  app.innerHTML = shellHTML();

  const view = $('#view');
  view.innerHTML = (
    Router.route==='dashboard' ? viewDashboard() :
    Router.route==='nutrition' ? viewNutrition() :
    Router.route==='sleep' ? viewSleep() :
    Router.route==='water' ? viewWater() :
    Router.route==='goals' ? viewGoals() :
    viewSettings()
  );

  bindShell();
  bindView();
  requestAnimationFrame(()=> initCharts());
}

function bindShell(){
  $$('.nav__item').forEach(el=>{
    el.addEventListener('click', ()=> Router.set(el.dataset.route));
  });

  $('#reset')?.addEventListener('click', ()=>{
    Storage.reset();
    State.data = seed();
    State.save();
    Toast.show({title:'Сброшено', text:'Данные демо пересозданы.'});
    Router.set('dashboard');
  });

  $('#aiHint')?.addEventListener('click', ()=>{
    Toast.show({title:'Подсказка', text:'Сделай 1 привычку на неделю: вода до 12:00 = 1л. Потом добавим “коуча”.'});
  });

  $('#quickAdd')?.addEventListener('click', ()=> openQuickAdd());

  $('#tgLogin')?.addEventListener('click', ()=> openTelegramAuth());
}

function bindView(){
  $$('[data-open="meal"]').forEach(b=>b.addEventListener('click', ()=> openMealModal()));
  $$('[data-open="water"]').forEach(b=>b.addEventListener('click', ()=> addWater(250)));
  $$('[data-open="sleep"]').forEach(b=>b.addEventListener('click', ()=> openSleepModal()));

  $$('[data-add-water]').forEach(b=>b.addEventListener('click', ()=> addWater(Number(b.dataset.addWater||0))));

  $$('[data-del-meal]').forEach(b=>b.addEventListener('click', ()=>{
    const idx = Number(b.dataset.delMeal);
    const d = State.getDay();
    d.food.entries.splice(idx,1);
    recalcFood(d);
    State.save();
    render();
    Toast.show({title:'Удалено', text:'Убрал приём из ленты.'});
  }));

  $('#saveGoals')?.addEventListener('click', ()=>{
    const t = State.data.targets;
    t.kcal = Number($('#target_kcal')?.value||t.kcal);
    t.waterMl = Number($('#target_water')?.value||t.waterMl);
    t.p = Number($('#target_p')?.value||t.p);
    t.f = Number($('#target_f')?.value||t.f);
    t.c = Number($('#target_c')?.value||t.c);
    t.sleepH = Number($('#target_sleep')?.value||t.sleepH);
    State.save();
    Toast.show({title:'Сохранено', text:'Цели обновлены.'});
    render();
  });

  $('#tgLogin2')?.addEventListener('click', ()=> openTelegramAuth());
  $('#fakeUser')?.addEventListener('click', ()=>{
    const name = prompt('Имя (демо):', State.data.user.name||'');
    if(!name) return;
    State.data.user.name = name;
    State.save();
    Toast.show({title:'Ок', text:'Имя обновлено.'});
    render();
  });

  $('#export')?.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(State.data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `glnt-health-export-${todayISO()}.json`;
    a.click();
    Toast.show({title:'Экспорт', text:'Скачал JSON.'});
  });

  $('#import')?.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async ()=>{
      const file = input.files?.[0];
      if(!file) return;
      try{
        const text = await file.text();
        const obj = JSON.parse(text);
        State.data = obj;
        State.save();
        Toast.show({title:'Импорт', text:'Данные загружены.'});
        render();
      }catch(e){
        Toast.show({title:'Ошибка', text:'JSON битый или не тот формат.', kind:'bad'});
      }
    };
    input.click();
  });
}

function recalcFood(d){
  d.food.kcal = d.food.entries.reduce((a,b)=>a+Number(b.kcal||0),0);
  // rough macro split if unknown: use current ratios to distribute
  const t = State.data.targets;
  const kcal = d.food.kcal;
  // keep previous if user set via quick add
  if(!d.food.p && !d.food.f && !d.food.c){
    d.food.p = Math.round(kcal*0.28/4);
    d.food.f = Math.round(kcal*0.30/9);
    d.food.c = Math.round(kcal*0.42/4);
  }
  // clamp a bit
  d.food.p = clamp(Number(d.food.p||0),0,400);
  d.food.f = clamp(Number(d.food.f||0),0,250);
  d.food.c = clamp(Number(d.food.c||0),0,600);
}

function addWater(ml){
  const d = State.getDay();
  d.water.ml = clamp(Number(d.water.ml||0) + ml, 0, 10000);
  State.save();
  Toast.show({title:'Вода', text:`+${ml} мл`});
  render();
}

function openModal({title, bodyHTML, onPrimary, primaryText='Сохранить'}={}){
  const back = document.createElement('div');
  back.className='modalback';
  back.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <b>${escapeHtml(title||'')}</b>
        <button class="btn btn--ghost" data-close>Закрыть</button>
      </div>
      <div class="modal__body">${bodyHTML||''}</div>
      <div class="modal__foot">
        <button class="btn btn--ghost" data-close>Отмена</button>
        <button class="btn btn--primary" data-primary>${escapeHtml(primaryText)}</button>
      </div>
    </div>`;
  document.body.appendChild(back);

  const close = ()=> back.remove();
  back.addEventListener('click', (e)=>{ if(e.target===back) close(); });
  $$('[data-close]', back).forEach(b=>b.addEventListener('click', close));
  $('[data-primary]', back).addEventListener('click', async ()=>{
    try{ await onPrimary?.(back); close(); }catch(e){
      Toast.show({title:'Ошибка', text: String(e?.message||e), kind:'bad'});
    }
  });

  // Escape
  const onKey = (e)=>{ if(e.key==='Escape'){ close(); window.removeEventListener('keydown', onKey);} };
  window.addEventListener('keydown', onKey);

  return back;
}

function openMealModal(){
  const d = State.getDay();
  openModal({
    title:'Добавить приём пищи',
    primaryText:'Добавить',
    bodyHTML:`
      <div class="form">
        <div>
          <div class="label">Название</div>
          <input class="input" id="m_title" placeholder="Например: курица + рис" />
        </div>
        <div class="form__row">
          <div>
            <div class="label">Время</div>
            <input class="input" id="m_time" placeholder="19:30" value="${new Date().toTimeString().slice(0,5)}" />
          </div>
          <div>
            <div class="label">Калории</div>
            <input class="input" id="m_kcal" type="number" placeholder="450" />
          </div>
        </div>
        <div class="small">Быстрая запись. Потом можно сделать полноценную БД продуктов + скан штрихкода.</div>
      </div>
    `,
    onPrimary: async (root)=>{
      const title = $('#m_title', root).value.trim();
      const time = $('#m_time', root).value.trim() || '—';
      const kcal = Number($('#m_kcal', root).value||0);
      if(!title) throw new Error('Название пустое');
      if(!kcal || kcal<0) throw new Error('Калории не ок');
      d.food.entries.unshift({time, title, kcal});
      recalcFood(d);
      State.save();
      Toast.show({title:'Добавлено', text:`${title} • ${fmt(kcal)} ккал`});
      render();
    }
  });
}

function openSleepModal(){
  const d = State.getDay();
  openModal({
    title:'Записать сон',
    bodyHTML:`
      <div class="form">
        <div class="form__row">
          <div>
            <div class="label">Часы сна</div>
            <input class="input" id="s_hours" type="number" step="0.1" value="${d.sleep.hours||8}" />
          </div>
          <div>
            <div class="label">Качество (0–100)</div>
            <input class="input" id="s_q" type="number" value="${d.sleep.quality||80}" />
          </div>
        </div>
        <div class="small">Качество — субъективно, но тренды видны моментально.</div>
      </div>
    `,
    onPrimary: async (root)=>{
      d.sleep.hours = clamp(Number($('#s_hours', root).value||0), 0, 16);
      d.sleep.quality = clamp(Number($('#s_q', root).value||0), 0, 100);
      State.save();
      Toast.show({title:'Сон сохранён', text:`${d.sleep.hours} ч • ${d.sleep.quality}/100`});
      render();
    }
  });
}

function openQuickAdd(){
  const d = State.getDay();
  openModal({
    title:'Быстрая запись (сегодня)',
    primaryText:'Сохранить',
    bodyHTML:`
      <div class="form">
        <div class="form__row">
          <div>
            <div class="label">Калории</div>
            <input class="input" id="q_k" type="number" value="${d.food.kcal||0}" />
          </div>
          <div>
            <div class="label">Вода (мл)</div>
            <input class="input" id="q_w" type="number" value="${d.water.ml||0}" />
          </div>
        </div>
        <div class="form__row">
          <div>
            <div class="label">Белки (г)</div>
            <input class="input" id="q_p" type="number" value="${d.food.p||0}" />
          </div>
          <div>
            <div class="label">Жиры (г)</div>
            <input class="input" id="q_f" type="number" value="${d.food.f||0}" />
          </div>
        </div>
        <div class="form__row">
          <div>
            <div class="label">Углеводы (г)</div>
            <input class="input" id="q_c" type="number" value="${d.food.c||0}" />
          </div>
          <div>
            <div class="label">Сон (ч)</div>
            <input class="input" id="q_s" type="number" step="0.1" value="${d.sleep.hours||0}" />
          </div>
        </div>
        <div class="small">Эта штука — для случаев “мне некогда”. Потом добавим нормальный дневник + умный ввод.</div>
      </div>
    `,
    onPrimary: async (root)=>{
      d.food.kcal = clamp(Number($('#q_k', root).value||0),0,8000);
      d.water.ml = clamp(Number($('#q_w', root).value||0),0,10000);
      d.food.p = clamp(Number($('#q_p', root).value||0),0,400);
      d.food.f = clamp(Number($('#q_f', root).value||0),0,250);
      d.food.c = clamp(Number($('#q_c', root).value||0),0,600);
      d.sleep.hours = clamp(Number($('#q_s', root).value||0),0,16);
      if(!d.food.entries.length && d.food.kcal>0){
        d.food.entries = [{time:'—', title:'Суммой (quick)', kcal: d.food.kcal}];
      }
      State.save();
      Toast.show({title:'Сохранено', text:'Обновил сегодняшний лог.'});
      render();
    }
  });
}

function openTelegramAuth(){
  // Front-only placeholder: show both approaches.
  const inWebApp = Boolean(window.Telegram?.WebApp?.initData);
  const initData = window.Telegram?.WebApp?.initData || '';

  openModal({
    title:'Telegram авторизация',
    primaryText: 'Понял',
    bodyHTML:`
      <div class="form">
        <div style="padding:12px 12px; border-radius:16px; background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10)">
          <b style="font-size:13px">Вариант 1 — Telegram WebApp (идеально для in-app)</b>
          <div class="small" style="margin-top:6px">Если модуль открывается внутри Telegram, у тебя есть <code>Telegram.WebApp.initData</code>. Его надо отправить на бек и провалидировать hash.</div>
          <div class="sep"></div>
          <div class="small">Статус: <b>${inWebApp ? 'внутри Telegram WebApp' : 'обычный браузер'}</b></div>
          <div class="small" style="margin-top:6px; word-break: break-all">initData: ${escapeHtml(initData ? initData.slice(0,220)+'…' : '—')}</div>
        </div>

        <div style="padding:12px 12px; border-radius:16px; background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10)">
          <b style="font-size:13px">Вариант 2 — Telegram Login Widget (для сайта)</b>
          <div class="small" style="margin-top:6px">На проде сюда вставляешь виджет. Он отдаёт объект пользователя + hash → проверяешь на сервере.</div>
          <div class="sep"></div>
          <div class="small">Документация: Telegram Login Widget и Telegram Login (OpenID / lib). Ссылки — в README.</div>
        </div>

        <div class="small">Если хочешь — я докину готовый минимальный бек (Cloudflare Worker / Node) для валидации Telegram подписи и выдачи JWT.</div>
      </div>
    `,
    onPrimary: async ()=>{
      Toast.show({title:'Ок', text:'Закрыл окно авторизации.'});
    }
  });
}

function initCharts(){
  if(!window.Chart) return;

  const t = State.data.targets;
  const d = State.getDay();
  const days7 = lastNDays(7);
  const days14 = lastNDays(14);

  // Global defaults
  Chart.defaults.color = 'rgba(232,235,245,.85)';
  Chart.defaults.font.family = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  Chart.defaults.font.size = 12;

  const macro = [d.food.p||0, d.food.f||0, d.food.c||0];
  const donutCfg = (canvasId)=>{
    const el = $('#'+canvasId);
    if(!el) return;
    const c = new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Белки','Жиры','Углеводы'],
        datasets: [{
          data: macro,
          borderWidth: 0,
          hoverOffset: 6,
          backgroundColor: [
            'rgba(99,102,241,.85)',
            'rgba(236,72,153,.75)',
            'rgba(16,185,129,.75)'
          ]
        }]
      },
      options: {
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx)=> `${ctx.label}: ${fmt(ctx.parsed)} г`
            }
          }
        }
      }
    });
    charts.push(c);
  };

  donutCfg('macroDonut');
  donutCfg('macroDonut2');

  const trend = $('#trendLine');
  if(trend){
    const labels = days7.map(x=>x.date.slice(5));
    const c = new Chart(trend.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Ккал',
            data: days7.map(x=>x.food.kcal||0),
            borderWidth: 2,
            tension: .35,
            pointRadius: 0,
            borderColor: 'rgba(99,102,241,.95)',
            backgroundColor: 'rgba(99,102,241,.20)',
            fill: true,
            yAxisID: 'y'
          },
          {
            label: 'Вода (л)',
            data: days7.map(x=>Number(((x.water.ml||0)/1000).toFixed(2))),
            borderWidth: 2,
            tension: .35,
            pointRadius: 0,
            borderColor: 'rgba(16,185,129,.95)',
            backgroundColor: 'rgba(16,185,129,.16)',
            fill: true,
            yAxisID: 'y1'
          },
          {
            label: 'Сон (ч)',
            data: days7.map(x=>x.sleep.hours||0),
            borderWidth: 2,
            tension: .35,
            pointRadius: 0,
            borderColor: 'rgba(236,72,153,.9)',
            backgroundColor: 'rgba(236,72,153,.14)',
            fill: true,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,.08)' }, ticks:{ callback:(v)=>v } },
          y1: { position: 'right', grid: { display:false }, ticks:{ color:'rgba(169,176,199,.85)' } },
          x: { grid: { display:false }, ticks:{ color:'rgba(169,176,199,.85)' } }
        }
      }
    });
    charts.push(c);
  }

  const kcalBar = $('#kcalBar');
  if(kcalBar){
    const labels = days14.map(x=>x.date.slice(5));
    const c = new Chart(kcalBar.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'Ккал', data: days14.map(x=>x.food.kcal||0), backgroundColor:'rgba(99,102,241,.55)', borderRadius: 12 },
          { label:'Цель', data: days14.map(()=>t.kcal), borderColor:'rgba(16,185,129,.85)', borderWidth:2, type:'line', tension:.3, pointRadius:0 }
        ]
      },
      options: {
        plugins:{ legend:{ display:false } },
        scales:{
          y:{ grid:{ color:'rgba(255,255,255,.08)' }, ticks:{ color:'rgba(169,176,199,.85)' } },
          x:{ grid:{ display:false }, ticks:{ color:'rgba(169,176,199,.85)' } }
        }
      }
    });
    charts.push(c);
  }

  const sleepLine = $('#sleepLine');
  if(sleepLine){
    const labels = days14.map(x=>x.date.slice(5));
    const c = new Chart(sleepLine.getContext('2d'), {
      type:'line',
      data:{
        labels,
        datasets:[
          { label:'Сон (ч)', data: days14.map(x=>x.sleep.hours||0), borderColor:'rgba(236,72,153,.95)', backgroundColor:'rgba(236,72,153,.14)', fill:true, tension:.35, pointRadius:0, borderWidth:2 },
          { label:'Цель', data: days14.map(()=>t.sleepH), borderColor:'rgba(16,185,129,.85)', borderWidth:2, type:'line', tension:.3, pointRadius:0 }
        ]
      },
      options:{
        plugins:{ legend:{ display:false } },
        scales:{
          y:{ grid:{ color:'rgba(255,255,255,.08)' }, ticks:{ color:'rgba(169,176,199,.85)' } },
          x:{ grid:{ display:false }, ticks:{ color:'rgba(169,176,199,.85)' } }
        }
      }
    });
    charts.push(c);
  }

  const waterBar = $('#waterBar');
  if(waterBar){
    const labels = days14.map(x=>x.date.slice(5));
    const c = new Chart(waterBar.getContext('2d'), {
      type:'bar',
      data:{
        labels,
        datasets:[
          { label:'Вода (мл)', data: days14.map(x=>x.water.ml||0), backgroundColor:'rgba(16,185,129,.55)', borderRadius: 12 },
          { label:'Цель', data: days14.map(()=>t.waterMl), borderColor:'rgba(99,102,241,.85)', borderWidth:2, type:'line', tension:.3, pointRadius:0 }
        ]
      },
      options:{
        plugins:{ legend:{ display:false } },
        scales:{
          y:{ grid:{ color:'rgba(255,255,255,.08)' }, ticks:{ color:'rgba(169,176,199,.85)' } },
          x:{ grid:{ display:false }, ticks:{ color:'rgba(169,176,199,.85)' } }
        }
      }
    });
    charts.push(c);
  }
}

render();
