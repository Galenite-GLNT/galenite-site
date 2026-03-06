import { DEFAULT_STATE, STORAGE_KEY } from './constants.js';

function safeParse(v, fallback) {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function dayTemplate() {
  return {
    foodEntries: [],
    waterEntries: [],
    sleepEntries: [],
    weightEntries: [],
  };
}

export function ensureDay(state, date) {
  if (!state.days[date]) state.days[date] = dayTemplate();
  return state.days[date];
}

export function loadState() {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY) || '', null);
  const state = parsed ? { ...DEFAULT_STATE, ...parsed } : structuredClone(DEFAULT_STATE);
  state.profile = { ...DEFAULT_STATE.profile, ...(parsed?.profile || {}) };
  state.goals = { ...DEFAULT_STATE.goals, ...(parsed?.goals || {}) };
  state.days = parsed?.days || {};
  state.favorites = parsed?.favorites || [];
  state.recentFoods = parsed?.recentFoods || [];
  if (!state.selectedDate) state.selectedDate = new Date().toISOString().slice(0, 10);
  ensureDay(state, state.selectedDate);
  return state;
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
