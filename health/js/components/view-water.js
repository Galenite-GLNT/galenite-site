import { el, fmt } from "./ui.js";
import { progressRing, metricBars } from "./charts.js";

export function renderWater(state, icons){
  const left = Math.max(0, state.goals.water - state.water.ml);

  return el("div", { class:"grid" }, [
    el("div", { class:"card card--water" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Вода"]),
          el("div", { class:"card__hint" }, ["Гидратация за текущий день"]),
        ])
      ]),
      el("div", { class:"split split--rings" }, [
        progressRing(state.water.ml, state.goals.water, "Гидратация", "мл"),
        el("div", { class:"water-stat" }, [
          el("div", { class:"water-stat__big" }, [`${fmt(state.water.ml)} мл`]),
          el("div", { class:"water-stat__sub" }, [`Осталось ${fmt(left)} мл`]),
          el("div", { class:"water-line" }, [
            el("div", { class:"water-line__fill", style:`width:${Math.min(100, Math.round((state.water.ml/Math.max(1,state.goals.water))*100))}%` })
          ])
        ])
      ]),
      el("div", { class:"card__hint", style:"margin-top:12px" }, ["Корректировка значений — в настройках."])
    ]),

    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Индикаторы"]),
          el("div", { class:"card__hint" }, ["Норматив и отклонение"]),
        ])
      ]),
      metricBars([
        { name:"Выпито", value:state.water.ml, goal:state.goals.water, unit:"мл" },
        { name:"Стаканы (250 мл)", value:Math.round((state.water.ml||0)/250), goal:Math.round((state.goals.water||0)/250), unit:"шт" },
      ])
    ])
  ]);
}
