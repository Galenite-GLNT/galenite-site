import { el, fmt } from "./ui.js";
import { progressRing, metricBars } from "./charts.js";

export function renderDashboard(state, icons){
  const kcalLeft = Math.max(0, state.goals.kcal - state.nutrition.kcal);
  const waterLeft = Math.max(0, state.goals.water - state.water.ml);
  const sleepLeft = Math.max(0, state.goals.sleep - state.sleep.hours);

  return el("div", { class:"grid" }, [
    el("section", { class:"card card--hero" }, [
      el("div", { class:"hero" }, [
        el("div", {}, [
          el("div", { class:"eyebrow" }, ["Galenite Health"]),
          el("h3", { class:"hero__title" }, ["Дневной ритм"]),
          el("div", { class:"card__hint" }, [`${state.day} · краткая аналитика по целям`])
        ]),
        progressRing(state.nutrition.kcal, state.goals.kcal, "Калории", "kcal")
      ]),
      el("div", { class:"kpis" }, [
        kpi("Калории", icons.calories, `${fmt(state.nutrition.kcal)}`, "kcal", `${fmt(kcalLeft)} осталось`),
        kpi("Вода", icons.water, `${fmt(state.water.ml)}`, "мл", `${fmt(waterLeft)} до цели`),
        kpi("Сон", icons.sleep, `${fmt(state.sleep.hours)}`, "ч", `${fmt(sleepLeft)} до цели`),
      ])
    ]),

    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Баланс КБЖУ"]),
          el("div", { class:"card__hint" }, ["Прогресс к суточным ориентирам"]),
        ])
      ]),
      metricBars([
        { name:"Белки", value:state.nutrition.protein, goal:state.goals.protein, unit:"г" },
        { name:"Жиры", value:state.nutrition.fat, goal:state.goals.fat, unit:"г" },
        { name:"Углеводы", value:state.nutrition.carbs, goal:state.goals.carbs, unit:"г" },
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
    el("div", { class:"kpi__hint" }, [hint])
  ]);
}
