const KEY = "glnt.health.v4";

export function safeJSONParse(s, fallback){
  try{ return JSON.parse(s); }catch{ return fallback; }
}

export function loadState(){
  const base = {
    day: new Date().toISOString().slice(0,10),
    nutrition: { kcal: 0, protein: 0, fat: 0, carbs: 0, entries: [] },
    water: { ml: 0, target: 2000 },
    sleep: { hours: 0, quality: 3, notes: "" },
    goals: { kcal: 2200, protein: 140, fat: 70, carbs: 240, sleep: 8, water: 2000 }
  };
  const raw = localStorage.getItem(KEY);
  if(!raw) return base;
  const st = safeJSONParse(raw, base);
  const today = new Date().toISOString().slice(0,10);
  if(st.day !== today){
    st.day = today;
    st.nutrition = { ...st.nutrition, kcal:0, protein:0, fat:0, carbs:0, entries:[] };
    st.water = { ...st.water, ml:0 };
    st.sleep = { ...st.sleep, hours:0, quality:3, notes:"" };
  }
  return { ...base, ...st };
}

export function saveState(state){
  localStorage.setItem(KEY, JSON.stringify(state));
}
