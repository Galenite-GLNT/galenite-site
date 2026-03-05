import { el, fmt } from "./ui.js";
import { toast } from "./toast.js";

function num(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function clamp(n, a, b){ return Math.min(b, Math.max(a, n)); }

function pickName(p){
  return (p.product_name_ru || p.product_name || p.product_name_en || "").trim() || "Без названия";
}
function pickImg(p){
  return p.image_front_small_url || p.image_front_url || p.image_small_url || "";
}
function nutr100(n){
  return {
    kcal: num(n?.["energy-kcal_100g"] ?? n?.["energy-kcal"] ?? 0),
    protein: num(n?.["proteins_100g"] ?? 0),
    fat: num(n?.["fat_100g"] ?? 0),
    carbs: num(n?.["carbohydrates_100g"] ?? 0),
  };
}

export function renderFood(state, icons, onUpdate, apiBase){
  const root = el("div", { class:"grid" }, [
    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Nutrition"]),
          el("div", { class:"card__hint" }, ["Поиск и добавление КБЖУ через OpenFoodFacts"]),
        ]),
        el("span", { class:"pill" }, [el("b", {}, ["OFF"]), " search"]),
      ]),

      el("div", { class:"row" }, [
        el("div", { class:"field", style:"flex:1; min-width:220px" }, [
          el("div", { class:"label" }, ["Поиск продукта"]),
          el("input", { class:"input", placeholder:"Например: banana / творог / йогурт", "data-id":"q" }),
        ]),
        el("div", { class:"field", style:"max-width:160px" }, [
          el("div", { class:"label" }, ["Кол-во (шт)"]),
          el("input", { class:"input", type:"number", value:"8", min:"1", max:"30", "data-id":"limit" }),
        ]),
      ]),

      el("div", { style:"margin-top:10px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;" }, [
        el("button", { class:"btn btn--accent", onclick: ()=>search() }, ["Искать"]),
        el("button", { class:"btn", onclick: ()=>searchExample() }, ["Пример: banana"]),
        el("span", { class:"pill" }, [el("b", {}, ["Barcode"]), " optional"]),
      ]),

      el("div", { class:"row", style:"margin-top:12px" }, [
        el("div", { class:"field", style:"flex:1; min-width:220px" }, [
          el("div", { class:"label" }, ["Штрихкод (если есть)"]),
          el("input", { class:"input", placeholder:"Напр: 737628064502", "data-id":"barcode" }),
        ]),
        el("div", { class:"field", style:"max-width:220px" }, [
          el("div", { class:"label" }, ["Граммы при добавлении"]),
          el("input", { class:"input", type:"number", value:"100", min:"1", max:"5000", "data-id":"grams" }),
        ]),
      ]),

      el("div", { style:"margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;" }, [
        el("button", { class:"btn", onclick: ()=>fetchBarcode() }, ["Найти по штрихкоду"]),
        el("button", { class:"btn", onclick: ()=>quickAddManual() }, ["+ вручную КБЖУ"]),
      ]),

      el("div", { class:"card__hint", style:"margin-top:10px" }, [
        "OFF отдаёт КБЖУ на 100г. Мы умножаем на граммы. Если у продукта нет нутриентов — он будет без цифр."
      ]),

      el("div", { style:"margin-top:12px; display:flex; flex-direction:column; gap:10px;" , "data-id":"results" }, [
        emptyState("Пока пусто", "Сделай поиск — появятся результаты.")
      ])
    ]),

    el("div", { class:"card" }, [
      el("div", { class:"card__head" }, [
        el("div", {}, [
          el("h3", { class:"card__title" }, ["Today total"]),
          el("div", { class:"card__hint" }, ["Сумма по дню"]),
        ])
      ]),
      totals(state, icons),
      el("div", { style:"margin-top:12px" }, [
        el("h3", { class:"card__title" }, ["Entries"]),
        el("div", { class:"card__hint" }, [state.nutrition.entries.length ? "Нажми, чтобы удалить" : "Пока пусто"]),
      ]),
      el("div", { style:"margin-top:10px; display:flex; flex-direction:column; gap:8px;" , "data-id":"entries" }, [
        ...renderEntries(state)
      ])
    ])
  ]);

  const $ = (id)=>root.querySelector(`[data-id="${id}"]`);

  function api(path){
    const base = (apiBase || "").replace(/\/$/,"");
    return base + path;
  }

  async function search(){
    const q = ($("q").value || "").trim();
    const limit = clamp(num($("limit").value || 8), 1, 30);
    if(!q){ toast("warn","Поиск пустой","Напиши что-нибудь (banana / творог / рис)."); return; }

    const box = $("results");
    box.innerHTML = "";
    box.appendChild(skeleton("Ищу…"));

    try{
      const u = api(`/api/off/search?q=${encodeURIComponent(q)}&page=1&page_size=${limit}`);
      const r = await fetch(u);
      const j = await r.json();

      const products = j?.products || j?.data?.products || [];
      box.innerHTML = "";

      if(!products.length){
        box.appendChild(emptyState("Ничего не нашлось", "Попробуй другое слово или английский запрос."));
        return;
      }

      for(const p of products){
        box.appendChild(productCard(p));
      }
    }catch(e){
      box.innerHTML = "";
      box.appendChild(emptyState("Ошибка", "Проверь Worker URL и CORS."));
      toast("danger","OFF не отвечает", String(e?.message || e));
    }
  }

  function searchExample(){
    $("q").value = "banana";
    search();
  }

  async function fetchBarcode(){
    const code = ($("barcode").value || "").trim();
    if(!code){ toast("warn","Штрихкод пустой","Вставь цифры штрихкода."); return; }
    const box = $("results");
    box.innerHTML = "";
    box.appendChild(skeleton("Ищу по штрихкоду…"));
    try{
      const u = api(`/api/off/product/${encodeURIComponent(code)}`);
      const r = await fetch(u);
      const j = await r.json();
      const product = j?.product || j?.data?.product;
      box.innerHTML = "";
      if(!product){
        box.appendChild(emptyState("Не найдено", "OFF не знает этот штрихкод."));
        return;
      }
      box.appendChild(productCard(product, true));
    }catch(e){
      box.innerHTML = "";
      box.appendChild(emptyState("Ошибка", "Проверь Worker URL и CORS."));
      toast("danger","OFF не отвечает", String(e?.message || e));
    }
  }

  function quickAddManual(){
    const title = prompt("Название (например: домашняя еда)", "Домашняя еда");
    if(!title) return;
    const kcal = num(prompt("Калории (kcal)", "400"));
    const protein = num(prompt("Белки (g)", "25"));
    const fat = num(prompt("Жиры (g)", "15"));
    const carbs = num(prompt("Углеводы (g)", "40"));

    addEntry({
      title: title.trim(),
      grams: 0,
      kcal, protein, fat, carbs,
      ts: Date.now(),
      source: "manual"
    });
    toast("ok","Добавлено", title.trim());
  }

  function productCard(p, single=false){
    const name = pickName(p);
    const img = pickImg(p);
    const n = nutr100(p.nutriments || {});

    const gramsDefault = clamp(num($("grams").value || 100), 1, 5000);
    const kcal = Math.round(n.kcal * gramsDefault / 100);
    const protein = Math.round(n.protein * gramsDefault / 100 * 10)/10;
    const fat = Math.round(n.fat * gramsDefault / 100 * 10)/10;
    const carbs = Math.round(n.carbs * gramsDefault / 100 * 10)/10;

    const row = el("div", { class:"macro", style:"gap:12px; align-items:flex-start;" }, [
      el("div", { class:"macro__left", style:"align-items:flex-start;" }, [
        img ? el("img", { src: img, alt:"", style:"width:38px;height:38px;border-radius:10px;object-fit:cover;border:1px solid rgba(255,255,255,.10)" }) :
              el("div", { style:"width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10)" }),
        el("div", {}, [
          el("div", { class:"macro__name" }, [name]),
          el("div", { class:"macro__sub" }, [
            `на 100г: ${fmt(n.kcal)} kcal · P${fmt(n.protein)} F${fmt(n.fat)} C${fmt(n.carbs)}`
          ]),
          el("div", { class:"macro__sub", style:"margin-top:4px" }, [
            `добавится (${gramsDefault}г): ${kcal} kcal · P${protein} F${fat} C${carbs}`
          ]),
        ])
      ]),
      el("div", { style:"display:flex; flex-direction:column; gap:8px; align-items:flex-end;" }, [
        el("button", { class:"btn btn--accent", onclick: ()=>{
          const grams = clamp(num(prompt("Сколько грамм?", String(gramsDefault))), 1, 10000);
          addEntry({
            title: name,
            grams,
            kcal: n.kcal * grams / 100,
            protein: n.protein * grams / 100,
            fat: n.fat * grams / 100,
            carbs: n.carbs * grams / 100,
            ts: Date.now(),
            source: single ? "barcode" : "search",
            code: p.code || p.id || null,
            img
          });
          toast("ok","Добавлено", `${name} · ${grams}г`);
        } }, ["Добавить"]),
        el("button", { class:"btn", onclick: ()=>{
          copyText(`${name} | 100g: ${fmt(n.kcal)}kcal P${fmt(n.protein)} F${fmt(n.fat)} C${fmt(n.carbs)}`);
          toast("ok","Скопировано","В буфер.");
        } }, ["Copy"]),
      ])
    ]);

    return row;
  }

  function addEntry(e){
    state.nutrition.entries.push(e);
    state.nutrition.kcal += num(e.kcal);
    state.nutrition.protein += num(e.protein);
    state.nutrition.fat += num(e.fat);
    state.nutrition.carbs += num(e.carbs);

    onUpdate(state);

    const ent = $("entries");
    if(ent){
      ent.innerHTML = "";
      renderEntries(state).forEach(x=>ent.appendChild(x));
    }
    const tot = root.querySelector('[data-totals="1"]');
    if(tot){
      tot.replaceWith(totals(state, icons));
    }
  }

  return root;
}

function totals(state, icons){
  const wrap = el("div", { class:"split", "data-totals":"1" }, [
    macro("Калории", icons.calories, state.nutrition.kcal, state.goals.kcal, "kcal"),
    macro("Белки", icons.protein, state.nutrition.protein, state.goals.protein, "g"),
    macro("Жиры", icons.fat, state.nutrition.fat, state.goals.fat, "g"),
    macro("Угли", icons.carbs, state.nutrition.carbs, state.goals.carbs, "g"),
  ]);
  return wrap;
}

function macro(name, icon, v, goal, unit){
  const left = Math.max(0, goal - v);
  return el("div", { class:"macro" }, [
    el("div", { class:"macro__left" }, [
      el("img", { src: icon, alt:"" }),
      el("div", {}, [
        el("div", { class:"macro__name" }, [name]),
        el("div", { class:"macro__sub" }, [`осталось: ${Math.round(left)}${unit}`]),
      ])
    ]),
    el("div", { class:"macro__val" }, [
      `${Math.round(v*10)/10}`,
      el("span", {}, [unit])
    ])
  ]);
}

function renderEntries(state){
  return state.nutrition.entries.slice().reverse().map((e, idxRev) => {
    const idx = state.nutrition.entries.length - 1 - idxRev;
    const line = el("div", { class:"macro", style:"cursor:pointer;" }, [
      el("div", { class:"macro__left" }, [
        e.img ? el("img", { src: e.img, alt:"", style:"width:18px;height:18px;border-radius:6px;object-fit:cover;border:1px solid rgba(255,255,255,.10)" }) :
                el("div", { style:"width:10px; height:10px; border-radius:999px; background:rgba(124,92,255,.8)" }),
        el("div", {}, [
          el("div", { class:"macro__name" }, [e.title || "Запись"]),
          el("div", { class:"macro__sub" }, [
            `${Math.round(num(e.kcal))} kcal · P${Math.round(num(e.protein)*10)/10} F${Math.round(num(e.fat)*10)/10} C${Math.round(num(e.carbs)*10)/10}`
            + (e.grams ? ` · ${e.grams}g` : "")
          ]),
        ])
      ]),
      el("div", { class:"macro__val" }, ["✕"])
    ]);
    line.addEventListener("click", ()=>{
      const item = state.nutrition.entries[idx];
      if(!item) return;
      state.nutrition.entries.splice(idx,1);
      window.dispatchEvent(new CustomEvent("glnt:food:changed"));
      toast("ok","Удалено", item.title || "Запись");
    });
    return line;
  });
}

function emptyState(title, desc){
  return el("div", { class:"macro", style:"justify-content:flex-start;" }, [
    el("div", { class:"macro__left" }, [
      el("div", { style:"width:10px;height:10px;border-radius:999px;background:rgba(255,255,255,.18)" }),
      el("div", {}, [
        el("div", { class:"macro__name" }, [title]),
        el("div", { class:"macro__sub" }, [desc]),
      ])
    ])
  ]);
}

function skeleton(txt){
  return el("div", { class:"macro" }, [
    el("div", { class:"macro__left" }, [
      el("div", { style:"width:10px;height:10px;border-radius:999px;background:rgba(124,92,255,.8)" }),
      el("div", {}, [
        el("div", { class:"macro__name" }, [txt]),
        el("div", { class:"macro__sub" }, ["…"]),
      ])
    ])
  ]);
}

function copyText(s){
  try{ navigator.clipboard?.writeText?.(String(s)); }catch{}
}
