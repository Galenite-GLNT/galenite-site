import { el } from "./ui.js";
import { toast } from "./toast.js";

const PANELS = [
  { id:"goals", title:"Цели питания", hint:"Калории и КБЖУ" },
  { id:"water", title:"Вода", hint:"Суточная норма и текущее значение" },
  { id:"sleep", title:"Сон", hint:"Цель, часы, качество" },
  { id:"daily", title:"Дневные значения", hint:"Быстрое заполнение на сегодня" },
];

export function renderSettings(state, icons, onUpdate){
  let active = "goals";

  const root = el("div", { class:"grid settings-grid" }, [
    el("aside", { class:"card settings-menu", "data-id":"menu" }),
    el("section", { class:"card settings-panel", "data-id":"panel" }),
  ]);

  const menu = root.querySelector('[data-id="menu"]');
  const panel = root.querySelector('[data-id="panel"]');

  function renderMenu(){
    menu.innerHTML = "";
    menu.append(
      el("h3", { class:"card__title" }, ["Настройки"]),
      el("div", { class:"card__hint", style:"margin-top:4px" }, ["Выберите раздел для изменения данных"])
    );
    PANELS.forEach((p)=>{
      const item = el("button", { class:`settings-item ${active===p.id?"is-active":""}`, onclick:()=>{ active = p.id; renderMenu(); renderPanel(); } }, [
        el("div", { class:"settings-item__title" }, [p.title]),
        el("div", { class:"settings-item__hint" }, [p.hint]),
      ]);
      menu.appendChild(item);
    });
  }

  function field(label, id, val){
    return el("div", { class:"field" }, [
      el("div", { class:"label" }, [label]),
      el("input", { class:"input", type:"number", value: val, "data-id":id })
    ]);
  }
  const get = (id)=>panel.querySelector(`[data-id="${id}"]`);

  function renderPanel(){
    panel.innerHTML = "";
    if(active === "goals"){
      panel.append(
        el("h3", { class:"card__title" }, ["Цели питания"]),
        el("div", { class:"row" }, [field("Калории (kcal)","kcal",state.goals.kcal), field("Белки (г)","protein",state.goals.protein)]),
        el("div", { class:"row" }, [field("Жиры (г)","fat",state.goals.fat), field("Углеводы (г)","carbs",state.goals.carbs)]),
        action("Сохранить", ()=>{
          state.goals.kcal = num(get("kcal").value, state.goals.kcal);
          state.goals.protein = num(get("protein").value, state.goals.protein);
          state.goals.fat = num(get("fat").value, state.goals.fat);
          state.goals.carbs = num(get("carbs").value, state.goals.carbs);
          onUpdate(state);
          toast("ok","Сохранено","Цели питания обновлены.");
        })
      );
      return;
    }

    if(active === "water"){
      panel.append(
        el("h3", { class:"card__title" }, ["Вода"]),
        el("div", { class:"row" }, [field("Цель воды (мл)","waterGoal",state.goals.water), field("Выпито сегодня (мл)","waterNow",state.water.ml)]),
        action("Сохранить", ()=>{
          state.goals.water = num(get("waterGoal").value, state.goals.water);
          state.water.ml = num(get("waterNow").value, state.water.ml);
          onUpdate(state);
          toast("ok","Сохранено","Данные по воде обновлены.");
        })
      );
      return;
    }

    if(active === "sleep"){
      panel.append(
        el("h3", { class:"card__title" }, ["Сон"]),
        el("div", { class:"row" }, [field("Цель сна (ч)","sleepGoal",state.goals.sleep), field("Часы сна сегодня","sleepNow",state.sleep.hours)]),
        el("div", { class:"row" }, [field("Качество сна (1-5)","sleepQuality",state.sleep.quality)]),
        el("div", { class:"field" }, [
          el("div", { class:"label" }, ["Заметка"]),
          el("input", { class:"input", type:"text", value: state.sleep.notes || "", "data-id":"sleepNotes" })
        ]),
        action("Сохранить", ()=>{
          state.goals.sleep = num(get("sleepGoal").value, state.goals.sleep);
          state.sleep.hours = num(get("sleepNow").value, state.sleep.hours);
          state.sleep.quality = Math.max(1, Math.min(5, num(get("sleepQuality").value, state.sleep.quality)));
          state.sleep.notes = (get("sleepNotes").value || "").trim();
          onUpdate(state);
          toast("ok","Сохранено","Данные по сну обновлены.");
        })
      );
      return;
    }

    panel.append(
      el("h3", { class:"card__title" }, ["Дневные значения"]),
      el("div", { class:"row" }, [field("Калории факт","dKcal",state.nutrition.kcal), field("Белки факт","dProtein",state.nutrition.protein)]),
      el("div", { class:"row" }, [field("Жиры факт","dFat",state.nutrition.fat), field("Углеводы факт","dCarbs",state.nutrition.carbs)]),
      action("Сохранить", ()=>{
        state.nutrition.kcal = num(get("dKcal").value, state.nutrition.kcal);
        state.nutrition.protein = num(get("dProtein").value, state.nutrition.protein);
        state.nutrition.fat = num(get("dFat").value, state.nutrition.fat);
        state.nutrition.carbs = num(get("dCarbs").value, state.nutrition.carbs);
        onUpdate(state);
        toast("ok","Сохранено","Дневные значения обновлены.");
      }),
      el("div", { class:"card__hint", style:"margin-top:8px" }, ["Здесь задаются итоговые значения за день."])
    );
  }

  renderMenu();
  renderPanel();
  return root;
}

function action(label, fn){
  return el("div", { style:"margin-top:12px" }, [el("button", { class:"btn btn--accent", onclick:fn }, [label])]);
}

function num(v, fallback){
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : fallback;
}
