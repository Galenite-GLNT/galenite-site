import { el, fmt } from "./ui.js";
import { toast } from "./toast.js";

export function renderSleep(state, icons, onUpdate){
  const root = el("div", { class:"grid" }, [
    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Сон"]),
          el("div", { class:"card__hint" }, ["Часы, качество, заметка"]),
        ])
      ]),

      el("div", { class:"row" }, [
        el("div", { class:"field" }, [
          el("div", { class:"label" }, ["Часы сна"]),
          el("input", { class:"input", type:"number", step:"0.5", value: state.sleep.hours, "data-id":"hours" })
        ]),
        el("div", { class:"field" }, [
          el("div", { class:"label" }, ["Качество (1-5)"]),
          el("input", { class:"input", type:"number", min:"1", max:"5", value: state.sleep.quality, "data-id":"q" })
        ]),
      ]),

      el("div", { class:"field" }, [
        el("div", { class:"label" }, ["Заметка"]),
        el("input", { class:"input", placeholder:"Например: лёг поздно, просыпался 2 раза", value: state.sleep.notes || "", "data-id":"notes" })
      ]),

      el("div", { style:"margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;" }, [
        el("button", { class:"btn btn--accent", onclick: ()=>save() }, ["Сохранить"]),
        el("button", { class:"btn", onclick: ()=>preset(8,4) }, ["Шаблон: 8 часов"]),
      ])
    ]),

    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Статус"]),
          el("div", { class:"card__hint" }, ["Фактические данные за сегодня"]),
        ])
      ]),
      status(state, icons)
    ])
  ]);

  function get(id){ return root.querySelector(`[data-id="${id}"]`); }
  function preset(h,q){ get("hours").value=h; get("q").value=q; }

  function save(){
    const h = Number(get("hours").value);
    const q = Number(get("q").value);
    const notes = (get("notes").value || "").trim();

    if(!Number.isFinite(h) || h<0 || h>18){
      toast("warn","Часы не те","Поставь 0..18.");
      return;
    }
    if(!Number.isFinite(q) || q<1 || q>5){
      toast("warn","Качество 1..5","Поставь 1..5.");
      return;
    }
    state.sleep.hours = h;
    state.sleep.quality = Math.round(q);
    state.sleep.notes = notes;
    onUpdate(state);
    toast("ok","Сон сохранён", `${fmt(h)}ч, качество ${Math.round(q)}/5`);
  }

  return root;
}

function status(state, icons){
  const left = Math.max(0, state.goals.sleep - state.sleep.hours);
  return el("div", { class:"split" }, [
    macro("Сон", icons.sleep, state.sleep.hours, state.goals.sleep, "h"),
    macro("Осталось", icons.sleep, left, state.goals.sleep, "h"),
    el("div", { class:"macro" }, [
      el("div", { class:"macro__left" }, [
        el("img", { src: icons.settings, alt:"" }),
        el("div", {}, [
          el("div", { class:"macro__name" }, ["Качество"]),
          el("div", { class:"macro__sub" }, ["субъективно"]),
        ])
      ]),
      el("div", { class:"macro__val" }, [
        `${state.sleep.quality}`,
        el("span", {}, ["/5"])
      ])
    ]),
    el("div", { class:"macro" }, [
      el("div", { class:"macro__left" }, [
        el("img", { src: icons.notes, alt:"" }),
        el("div", {}, [
          el("div", { class:"macro__name" }, ["Заметка"]),
          el("div", { class:"macro__sub" }, [state.sleep.notes ? "есть" : "пусто"]),
        ])
      ]),
      el("div", { class:"macro__val" }, ["…"])
    ]),
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
      `${Math.round(v*10)/10}`,
      el("span", {}, [unit])
    ])
  ]);
}
