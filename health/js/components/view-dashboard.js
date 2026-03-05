import { el, fmt } from "./ui.js";

export function renderDashboard(state, icons){
  const kcalLeft = Math.max(0, state.goals.kcal - state.nutrition.kcal);
  const waterLeft = Math.max(0, state.goals.water - state.water.ml);
  const sleepLeft = Math.max(0, state.goals.sleep - state.sleep.hours);

  return el("div", { class:"grid" }, [
    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Сводка за день"]),
          el("div", { class:"card__hint" }, [`${state.day}`])
        ]),
        el("span", { class:"pill" }, [
          el("b", {}, ["Local"]),
          " storage"
        ])
      ]),
      el("div", { class:"kpis" }, [
        kpi("Калории", icons.calories, `${fmt(state.nutrition.kcal)}`, "kcal", `${fmt(kcalLeft)} осталось`),
        kpi("Вода", icons.water, `${fmt(state.water.ml)}`, "ml", `${fmt(waterLeft)} осталось`),
        kpi("Сон", icons.sleep, `${fmt(state.sleep.hours)}`, "h", `${fmt(sleepLeft)} до цели`),
      ])
    ]),

    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Макронутриенты"]),
          el("div", { class:"card__hint" }, ["Баланс по целям"]),
        ])
      ]),
      el("div", { class:"split" }, [
        macro("Белки", icons.protein, state.nutrition.protein, state.goals.protein, "g"),
        macro("Жиры", icons.fat, state.nutrition.fat, state.goals.fat, "g"),
        macro("Углеводы", icons.carbs, state.nutrition.carbs, state.goals.carbs, "g"),
        macro("Калории", icons.calories, state.nutrition.kcal, state.goals.kcal, "kcal"),
      ])
    ]),
  ]);
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

function macro(name, icon, v, goal, unit){
  return el("div", { class:"macro" }, [
    el("div", { class:"macro__left" }, [
      el("img", { src: icon, alt:"" }),
      el("div", {}, [
        el("div", { class:"macro__name" }, [name]),
        el("div", { class:"macro__sub" }, [`цель: ${goal}${unit}`]),
      ])
    ]),
    el("div", { class:"macro__val" }, [
      `${Math.round(v)}`,
      el("span", {}, [`${unit}`])
    ])
  ]);
}
