export const STORAGE_KEY = 'glnt.health.state.v2';

export const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast / Завтрак' },
  { id: 'lunch', label: 'Lunch / Обед' },
  { id: 'dinner', label: 'Dinner / Ужин' },
  { id: 'snacks', label: 'Snacks / Перекусы' },
];

export const NAV_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'food', label: 'Food' },
  { id: 'progress', label: 'Progress' },
  { id: 'goals', label: 'Goals' },
  { id: 'profile', label: 'Profile' },
  { id: 'history', label: 'History' },
];

export const QUICK_WATER = [200, 250, 500];

export const DEFAULT_STATE = {
  selectedDate: new Date().toISOString().slice(0, 10),
  profile: {
    displayName: 'Galenite User',
    sex: 'not_set',
    age: '',
    heightCm: '',
    currentWeightKg: '',
    targetWeightKg: '',
    activityLevel: 'moderate',
  },
  goals: {
    calories: 2200,
    protein: 140,
    fat: 70,
    carbs: 240,
    waterMl: 2500,
    sleepHours: 8,
    weightKg: 70,
  },
  days: {},
  favorites: [],
  recentFoods: [],
};
