import { DEFAULT_STATE, STORAGE_KEY } from './constants.js';
const LEGACY_LOGS_KEY = 'glnt.health.logs.v1';

function safeParse(v, fallback) {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function dayTemplate() {
  return {
    foodEntries: [],
    waterEntries: [],
    sleepEntries: [],
    weightEntries: [],
  };
}

function normalizeDay(day) {
  return {
    ...dayTemplate(),
    ...(day || {}),
    foodEntries: Array.isArray(day?.foodEntries) ? day.foodEntries : [],
    waterEntries: Array.isArray(day?.waterEntries) ? day.waterEntries : [],
    sleepEntries: Array.isArray(day?.sleepEntries) ? day.sleepEntries : [],
    weightEntries: Array.isArray(day?.weightEntries) ? day.weightEntries : [],
  };
}

function migrateLegacyLogs() {
  const raw = safeParse(localStorage.getItem(LEGACY_LOGS_KEY) || '', null);
  if (!raw) return null;
  const byDay = {};

  const ensure = (date) => {
    if (!byDay[date]) byDay[date] = dayTemplate();
    return byDay[date];
  };

  for (const entry of (raw.calories || [])) {
    const date = String(entry.datetime || '').slice(0, 10);
    if (!date) continue;
    ensure(date).foodEntries.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      meal: 'snacks',
      name: entry.name || 'Food',
      grams: Number(entry.grams || 100),
      calories: Number(entry.kcal || 0),
      protein: 0,
      fat: 0,
      carbs: 0,
      brand: '',
      barcode: '',
    });
  }

  for (const entry of (raw.water || [])) {
    const datetime = String(entry.datetime || '');
    const date = datetime.slice(0, 10);
    if (!date) continue;
    ensure(date).waterEntries.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ml: Number(entry.ml || 0),
      time: datetime.slice(11, 16) || '00:00',
    });
  }

  for (const entry of (raw.sleep || [])) {
    const datetime = String(entry.datetime || '');
    const date = datetime.slice(0, 10);
    if (!date) continue;
    const mins = Number(entry.minutes || 0);
    ensure(date).sleepEntries.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      start: '23:00',
      end: '07:00',
      durationMinutes: mins,
    });
  }

  for (const entry of (raw.weight || [])) {
    const datetime = String(entry.datetime || '');
    const date = datetime.slice(0, 10);
    if (!date) continue;
    ensure(date).weightEntries.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kg: Number(entry.kg || 0),
      time: datetime.slice(11, 16) || '00:00',
    });
  }

  return byDay;
}

export function ensureDay(state, date) {
  state.days[date] = normalizeDay(state.days[date]);
  return state.days[date];
}

export function loadState() {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY) || '', null);
  const state = parsed ? { ...DEFAULT_STATE, ...parsed } : cloneDefaultState();
  state.profile = { ...DEFAULT_STATE.profile, ...(parsed?.profile || {}) };
  state.goals = { ...DEFAULT_STATE.goals, ...(parsed?.goals || {}) };
  state.days = parsed?.days || migrateLegacyLogs() || {};
  for (const date of Object.keys(state.days)) {
    state.days[date] = normalizeDay(state.days[date]);
  }
  state.favorites = parsed?.favorites || [];
  state.recentFoods = parsed?.recentFoods || [];
  if (!state.selectedDate) state.selectedDate = new Date().toISOString().slice(0, 10);
  ensureDay(state, state.selectedDate);
  return state;
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
