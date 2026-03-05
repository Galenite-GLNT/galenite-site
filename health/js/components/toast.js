export function ensureToastRoot(){
  let el = document.querySelector(".toastwrap");
  if(!el){
    el = document.createElement("div");
    el.className = "toastwrap";
    document.body.appendChild(el);
  }
  return el;
}

export function toast(type, title, message){
  const root = ensureToastRoot();
  const t = document.createElement("div");
  t.className = `toast toast--${type || "ok"}`;
  t.innerHTML = `<b>${escapeHtml(title || "")}</b><span>${escapeHtml(message || "")}</span>`;
  root.appendChild(t);
  setTimeout(()=>{ t.style.opacity = "0"; t.style.transform = "translateY(-4px)"; }, 2600);
  setTimeout(()=>{ t.remove(); }, 3100);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
