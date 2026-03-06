import { DEFAULT_GOALS } from './constants.js';
import { todayIso } from './utils.js';
import { fetchHealthState, fetchMe } from './api.js';
import { buildSummary } from './calculations.js';

export const state = {
  selectedDate: todayIso(),
  section: 'today',
  me: null,
  profile: {},
  goals: { ...DEFAULT_GOALS },
  logs: { calories: [], water: [], sleep: [], weight: [] },
  favorites: [],
  recentFoods: [],
  summary: null,
};

export async function hydrateState() {
  const [me, health] = await Promise.all([
    fetchMe(),
    fetchHealthState(state.selectedDate),
  ]);

  state.me = me.user;
  state.goals = { ...DEFAULT_GOALS, ...(health.goals || {}) };
  state.profile = health.profile || {};
  state.logs = health.logs || { calories: [], water: [], sleep: [], weight: [] };
  state.favorites = health.favorites || [];
  state.recentFoods = health.recentFoods || [];
  state.summary = buildSummary(state);
  return state;
}

export function setSection(section) {
  state.section = section;
}

export function setDate(date) {
  state.selectedDate = date || todayIso();
}
