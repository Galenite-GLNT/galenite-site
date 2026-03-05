import { el, fmt } from "./ui.js";

export function progressRing(value, goal, label, unit){
  const safeGoal = Math.max(1, Number(goal) || 1);
  const safeVal = Math.max(0, Number(value) || 0);
  const p = Math.min(100, Math.round((safeVal / safeGoal) * 100));
  const deg = Math.round((p / 100) * 360);

  return el("div", { class:"ring" }, [
    el("div", { class:"ring__arc", style:`--deg:${deg}deg` }),
    el("div", { class:"ring__core" }, [
      el("div", { class:"ring__value" }, [`${p}%`]),
      el("div", { class:"ring__label" }, [label]),
      el("div", { class:"ring__hint" }, [`${fmt(safeVal)} / ${fmt(safeGoal)} ${unit}`]),
    ])
  ]);
}

export function metricBars(items){
  const max = Math.max(1, ...items.map(x=>Number(x.goal) || 0));
  return el("div", { class:"bars" }, items.map((x)=>{
    const v = Math.max(0, Number(x.value) || 0);
    const w = Math.min(100, Math.round((v / max) * 100));
    const done = Math.min(100, Math.round((v / Math.max(1, Number(x.goal)||1))*100));
    return el("div", { class:"bars__row" }, [
      el("div", { class:"bars__top" }, [
        el("span", { class:"bars__name" }, [x.name]),
        el("span", { class:"bars__nums" }, [`${fmt(v)} / ${fmt(x.goal)} ${x.unit} · ${done}%`]),
      ]),
      el("div", { class:"bars__track" }, [
        el("div", { class:"bars__fill", style:`width:${w}%` }),
      ])
    ]);
  }));
}
