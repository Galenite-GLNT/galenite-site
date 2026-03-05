export function el(tag, attrs = {}, children = []){
  const n = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){
    if(k === "class") n.className = v;
    else if(k === "html") n.innerHTML = v;
    else if(k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  }
  for(const c of children){
    if(c == null) continue;
    if(typeof c === "string") n.appendChild(document.createTextNode(c));
    else n.appendChild(c);
  }
  return n;
}

export function fmt(n){
  const x = Number(n);
  return Number.isFinite(x) ? String(Math.round(x*10)/10) : "0";
}
