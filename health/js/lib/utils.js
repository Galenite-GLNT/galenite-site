import { MEAL_TYPES } from './constants.js';

export const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

export function toNum(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function computeSleepDuration(start, end) {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  let startM = sH * 60 + sM;
  let endM = eH * 60 + eM;
  if (endM <= startM) endM += 24 * 60;
  return endM - startM;
}

export function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function macrosForAmount(item, grams) {
  const ratio = grams / 100;
  return {
    calories: toNum(item.calories_100g) * ratio,
    protein: toNum(item.protein_100g) * ratio,
    fat: toNum(item.fat_100g) * ratio,
    carbs: toNum(item.carbs_100g) * ratio,
  };
}

export function sumFood(entries) {
  return entries.reduce((acc, e) => {
    acc.calories += toNum(e.calories);
    acc.protein += toNum(e.protein);
    acc.fat += toNum(e.fat);
    acc.carbs += toNum(e.carbs);
    return acc;
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 });
}

export function daySummary(day) {
  const food = sumFood(day.foodEntries || []);
  const waterMl = (day.waterEntries || []).reduce((a, x) => a + toNum(x.ml), 0);
  const sleepArr = day.sleepEntries || [];
  const sleepLast = sleepArr.length ? sleepArr[sleepArr.length - 1] : null;
  const sleepMinutes = sleepLast ? toNum(sleepLast.durationMinutes) : 0;
  const weightArr = day.weightEntries || [];
  const weightLast = weightArr.length ? weightArr[weightArr.length - 1] : null;
  return {
    ...food,
    waterMl,
    sleepMinutes,
    sleepLast,
    weightKg: weightLast ? toNum(weightLast.kg) : 0,
  };
}

export function mealGroups(entries) {
  const groups = Object.fromEntries(MEAL_TYPES.map((m) => [m.id, []]));
  if (!Array.isArray(entries)) return groups;
  for (const e of entries) groups[e.meal || 'snacks']?.push(e);
  return groups;
}

export function weightTrend(daysMap) {
  const entries = Object.entries(daysMap)
    .flatMap(([date, day]) => (day.weightEntries || []).map((w) => ({ date, kg: toNum(w.kg) })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const last30 = entries.slice(-30);
  const latest = last30.length ? (last30[last30.length - 1].kg || 0) : 0;
  const weekIdx = Math.max(0, last30.length - 7);
  const weekAgo = last30.length ? (last30[weekIdx]?.kg || latest) : latest;
  const monthAgo = last30.length ? (last30[0]?.kg || latest) : latest;
  return { points: last30, weekDelta: latest - weekAgo, monthDelta: latest - monthAgo };
}

export function progress(current, goal) {
  if (!goal) return 0;
  return clamp((current / goal) * 100, 0, 180);
}
