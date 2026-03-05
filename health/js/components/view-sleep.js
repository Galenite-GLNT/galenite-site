import { el, fmt } from "./ui.js";
import { progressRing, metricBars } from "./charts.js";

export function renderSleep(state, icons){
  const left = Math.max(0, state.goals.sleep - state.sleep.hours);

  return el("div", { class:"grid" }, [
    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Сон"]),
          el("div", { class:"card__hint" }, ["Длительность, качество и заметка"]),
        ])
      ]),
      el("div", { class:"split split--rings" }, [
        progressRing(state.sleep.hours, state.goals.sleep, "Сон", "ч"),
        el("div", { class:"macro" }, [
          el("div", { class:"macro__left" }, [
            el("img", { src: icons.notes, alt:"" }),
            el("div", {}, [
              el("div", { class:"macro__name" }, ["Комментарий"]),
              el("div", { class:"macro__sub" }, [state.sleep.notes || "Без комментария"]) 
            ])
          ])
        ])
      ]),
      el("div", { class:"card__hint", style:"margin-top:12px" }, [`До цели осталось ${fmt(left)} ч.`])
    ]),

    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Показатели"]),
          el("div", { class:"card__hint" }, ["Оценка сна за день"]),
        ])
      ]),
      metricBars([
        { name:"Часы сна", value:state.sleep.hours, goal:state.goals.sleep, unit:"ч" },
        { name:"Качество", value:state.sleep.quality, goal:5, unit:"/5" },
      ])
    ])
  ]);
}
