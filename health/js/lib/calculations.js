import { MEAL_TYPES } from './constants.js';

function sum(items, key) {
  return items.reduce((acc, item) => acc + Number(item[key] || 0), 0);
}

export function aggregateMeals(foodEntries = []) {
  const groups = Object.fromEntries(MEAL_TYPES.map((m) => [m.key, []]));
  foodEntries.forEach((entry) => {
    const meal = entry.meal || 'snacks';
    if (!groups[meal]) groups[meal] = [];
    groups[meal].push(entry);
  });

  return MEAL_TYPES.map((meal) => {
    const entries = groups[meal.key] || [];
    return {
      ...meal,
      entries,
      totals: {
        calories: sum(entries, 'kcal'),
        protein: sum(entries, 'protein'),
        fat: sum(entries, 'fat'),
        carbs: sum(entries, 'carbs'),
      },
    };
  });
}

export function buildSummary(state) {
  const food = state.logs.calories || [];
  const waterEntries = state.logs.water || [];
  const sleepEntries = state.logs.sleep || [];
  const weightEntries = state.logs.weight || [];

  const totals = {
    calories: sum(food, 'kcal'),
    protein: sum(food, 'protein'),
    fat: sum(food, 'fat'),
    carbs: sum(food, 'carbs'),
    water: sum(waterEntries, 'ml'),
  };

  const lastSleep = sleepEntries.at(-1);
  const lastWeight = weightEntries.at(-1);

  return {
    totals,
    meals: aggregateMeals(food),
    sleep: {
      start: lastSleep?.start_time || '',
      end: lastSleep?.end_time || '',
      minutes: Number(lastSleep?.minutes || 0),
    },
    weight: {
      current: Number(lastWeight?.kg || 0),
      trend: weightEntries.slice(-30).map((x) => Number(x.kg || 0)),
      weekDelta: delta(weightEntries, 7),
      monthDelta: delta(weightEntries, 30),
    },
  };
}

function delta(entries, days) {
  if (entries.length < 2) return 0;
  const latest = Number(entries.at(-1)?.kg || 0);
  const old = Number(entries[Math.max(0, entries.length - days)]?.kg || entries[0]?.kg || 0);
  return latest - old;
}

export function progress(current, goal) {
  const g = Number(goal || 0);
  if (!g) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(current || 0) / g) * 100)));
}
