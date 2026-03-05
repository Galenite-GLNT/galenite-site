import { el, fmt } from "./ui.js";
import { toast } from "./toast.js";

export function renderWater(state, icons, onUpdate){
  const root = el("div", { class:"grid" }, [
    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Water"]),
          el("div", { class:"card__hint" }, ["Стаканы, цель, быстрые кнопки"]),
        ])
      ]),
      el("div", { class:"kpis" }, [
        kpi("Выпито", icons.water, `${fmt(state.water.ml)}`, "ml", `цель: ${state.goals.water} ml`),
        kpi("Осталось", icons.water, `${fmt(Math.max(0, state.goals.water - state.water.ml))}`, "ml", "до цели"),
        kpi("Стаканов", icons.water, `${fmt(Math.round((state.water.ml||0)/250))}`, "x", "по 250ml"),
      ]),
      el("div", { style:"margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;" }, [
        btn("+250 мл", ()=>add(250)),
        btn("+500 мл", ()=>add(500)),
        btn("Сбросить", ()=>reset(), false),
      ])
    ]),

    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Targets"]),
          el("div", { class:"card__hint" }, ["Настрой цель воды"]),
        ])
      ]),
      el("div", { class:"field" }, [
        el("div", { class:"label" }, ["Цель (ml)"]),
        el("input", { class:"input", type:"number", value: state.goals.water, "data-id":"target" })
      ]),
      el("div", { style:"margin-top:12px" }, [
        el("button", { class:"btn btn--accent", onclick: ()=>saveTarget() }, ["Сохранить"])
      ])
    ])
  ]);

  function get(id){ return root.querySelector(`[data-id="${id}"]`); }

  function add(n){
    state.water.ml = Math.max(0, (state.water.ml || 0) + n);
    onUpdate(state);
    toast("ok", "Вода", `+${n} мл`);
  }
  function reset(){
    state.water.ml = 0;
    onUpdate(state);
    toast("warn","Вода","Сбросил на 0.");
  }
  function saveTarget(){
    const t = Number(get("target").value);
    if(!Number.isFinite(t) || t<250){
      toast("warn","Цель странная","Поставь хотя бы 250ml.");
      return;
    }
    state.goals.water = round(t);
    onUpdate(state);
    toast("ok","Цель обновлена", `${state.goals.water} ml`);
  }

  return root;
}

function kpi(label, icon, val, unit, hint){
  return el("div", { class:"kpi" }, [
    el("div", { class:"kpi__label" }, [
      el("img", { src: icon, alt:"" }),
      label
    ]),
    el("div", { class:"kpi__value" }, [
      val,
      el("span", { class:"kpi__unit" }, [unit])
    ]),
    el("div", { style:"margin-top:6px; font-size:12px; color: var(--muted2);" }, [hint])
  ]);
}

function btn(txt, fn, accent=true){
  return el("button", { class: accent ? "btn btn--accent" : "btn", onclick: fn }, [txt]);
}
function round(x){ return Math.round(x); }
