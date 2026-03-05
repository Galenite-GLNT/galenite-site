import { el, fmt } from "./ui.js";
import { progressRing, metricBars } from "./charts.js";

export function renderFood(state, icons){
  return el("div", { class:"grid" }, [
    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Питание"]),
          el("div", { class:"card__hint" }, ["Текущее состояние дневника и прогресс"]),
        ])
      ]),
      el("div", { class:"split split--rings" }, [
        progressRing(state.nutrition.kcal, state.goals.kcal, "Калории", "kcal"),
        progressRing(state.nutrition.protein + state.nutrition.fat + state.nutrition.carbs, state.goals.protein + state.goals.fat + state.goals.carbs, "Макро итого", "г")
      ]),
      el("div", { style:"margin-top:12px" }, [
        metricBars([
          { name:"Белки", value:state.nutrition.protein, goal:state.goals.protein, unit:"г" },
          { name:"Жиры", value:state.nutrition.fat, goal:state.goals.fat, unit:"г" },
          { name:"Углеводы", value:state.nutrition.carbs, goal:state.goals.carbs, unit:"г" },
        ])
      ]),
      el("div", { class:"card__hint", style:"margin-top:12px" }, ["Изменение значений и целей доступно в разделе «Настройки». "])
    ]),

    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Последние записи"]),
          el("div", { class:"card__hint" }, [state.nutrition.entries.length ? "Журнал за текущий день" : "Записей пока нет"]),
        ])
      ]),
      el("div", { style:"display:flex; flex-direction:column; gap:8px;" }, [
        ...renderEntries(state, icons)
      ])
    ])
  ]);
}

function renderEntries(state, icons){
  if(!state.nutrition.entries.length){
    return [
      el("div", { class:"macro" }, [
        el("div", { class:"macro__left" }, [
          el("img", { src: icons.food, alt:"" }),
          el("div", {}, [
            el("div", { class:"macro__name" }, ["Пока без записей"]),
            el("div", { class:"macro__sub" }, ["Добавьте данные в настройках"]),
          ])
        ])
      ])
    ];
  }

  return state.nutrition.entries.slice().reverse().slice(0,10).map((e)=>{
    return el("div", { class:"macro" }, [
      el("div", { class:"macro__left" }, [
        e.img ? el("img", { src:e.img, alt:"", style:"width:18px;height:18px;border-radius:6px;object-fit:cover" }) : el("img", { src:icons.food, alt:"" }),
        el("div", {}, [
          el("div", { class:"macro__name" }, [e.title || "Запись"]),
          el("div", { class:"macro__sub" }, [`${Math.round(Number(e.kcal)||0)} kcal · P${fmt(e.protein)} F${fmt(e.fat)} C${fmt(e.carbs)}`]),
        ])
      ]),
      el("div", { class:"macro__val" }, [e.grams ? `${e.grams}г` : "—"])
    ]);
  });
}
