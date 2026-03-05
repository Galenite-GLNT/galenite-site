import { el } from "./ui.js";
import { toast } from "./toast.js";

export function renderSettings(state, icons, onUpdate){
  const root = el("div", { class:"grid" }, [
    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Цели"]),
          el("div", { class:"card__hint" }, ["КБЖУ / сон / вода"]),
        ])
      ]),

      goalsForm(state),
      el("div", { style:"margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;" }, [
        el("button", { class:"btn btn--accent", onclick: ()=>save() }, ["Сохранить цели"]),
        el("button", { class:"btn", onclick: ()=>reset() }, ["Вернуть базовые значения"]),
      ])
    ]),

    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Интеграции"]),
          el("div", { class:"card__hint" }, ["API и подключения"]),
        ])
      ]),
      el("div", { class:"card__hint" }, [
        "Ключи FatSecret НЕ кладём в фронт. Делаем /api в Worker и проксируем запросы."
      ])
    ])
  ]);

  function get(name){ return root.querySelector(`[data-id="${name}"]`); }

  function save(){
    const g = {
      kcal: num(get("kcal").value, 2200),
      protein: num(get("protein").value, 140),
      fat: num(get("fat").value, 70),
      carbs: num(get("carbs").value, 240),
      water: num(get("water").value, 2000),
      sleep: num(get("sleep").value, 8),
    };
    state.goals = g;
    onUpdate(state);
    toast("ok","Сохранено","Цели обновлены.");
  }

  function reset(){
    state.goals = { kcal: 2200, protein: 140, fat: 70, carbs: 240, sleep: 8, water: 2000 };
    onUpdate(state);
    toast("warn","Возврат","Базовые цели восстановлены.");
  }

  return root;
}

function goalsForm(state){
  return el("div", {}, [
    row([ field("Калории (kcal)", "kcal", state.goals.kcal), field("Белки (g)", "protein", state.goals.protein) ]),
    row([ field("Жиры (g)", "fat", state.goals.fat), field("Углеводы (g)", "carbs", state.goals.carbs) ]),
    row([ field("Вода (ml)", "water", state.goals.water), field("Сон (h)", "sleep", state.goals.sleep) ]),
  ]);
}
function row(children){ return el("div", { class:"row" }, children); }
function field(label, id, val){
  return el("div", { class:"field" }, [
    el("div", { class:"label" }, [label]),
    el("input", { class:"input", type:"number", value: val, "data-id": id })
  ]);
}
function num(v, d){
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x) : d;
}
