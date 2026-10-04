// "Pomoć / Help" floating chat for signed-in hub users. Answers come from the calculator's /kalkulator/api/help
// (how-to only, grounded in the help guide; no business data). Independent of app.js; failures never affect sign-in.
import * as auth from "./auth.js";

const LIMIT = 30, MAX = 800;
const SUGGEST = ["Kako dodijeliti aplikaciju korisniku?", "Kako napraviti novu kalkulaciju?", "Kako podesiti prava za Direktora?", "Kako dodati novi lead u CRM?"];
const el = (tag, attrs = {}, kids = []) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } for (const c of [].concat(kids)) if (c) e.append(c); return e; };
const tidy = s => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s*/gm, "");
const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 20.5l1.5-4.6A8.4 8.4 0 1 1 21 11.5z"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2.2-2.4 2.2M12 15.5h.01"/></svg>';

const css = `
.hc-btn{position:fixed;right:16px;bottom:16px;z-index:60;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;background:var(--deep,#0E4C80);color:#fff;font:600 .9rem Inter,system-ui,sans-serif;padding:12px 16px;box-shadow:0 10px 24px rgba(14,76,128,.35);cursor:pointer}
.hc-btn:hover{background:var(--blue-d,#1E78B8)}
.hc-panel{position:fixed;left:8px;right:8px;bottom:8px;z-index:60;display:flex;flex-direction:column;max-height:min(80vh,640px);background:#fff;border:1px solid var(--line,#D6ECF8);border-radius:14px;box-shadow:0 20px 50px rgba(15,42,68,.3);overflow:hidden;font-family:Inter,system-ui,sans-serif;color:var(--navy,#0F2A44)}
@media(min-width:640px){.hc-panel{left:auto;right:16px;bottom:16px;width:380px}}
.hc-head{display:flex;justify-content:space-between;align-items:center;background:var(--deep,#0E4C80);color:#fff;padding:12px 16px}
.hc-head b{display:block;font-size:.9rem}.hc-head small{opacity:.8;font-size:.75rem}
.hc-x{background:none;border:0;color:#fff;font-size:1.4rem;line-height:1;cursor:pointer;padding:2px 6px;border-radius:6px}
.hc-list{flex:1;overflow-y:auto;padding:12px 16px;font-size:.88rem;display:flex;flex-direction:column;gap:10px}
.hc-msg{white-space:pre-wrap;overflow-wrap:anywhere;padding:8px 12px;border-radius:10px;line-height:1.45}
.hc-msg[data-role=user]{margin-left:32px;background:var(--deep,#0E4C80);color:#fff}
.hc-msg[data-role=assistant],.hc-busy{margin-right:16px;background:var(--blue-l,#E8F6FD)}
.hc-busy{padding:8px 12px;border-radius:10px;color:var(--muted,#4A6178)}
.hc-intro{color:var(--muted,#4A6178);display:flex;flex-direction:column;gap:6px}
.hc-chips{display:flex;flex-wrap:wrap;gap:6px}
.hc-chip{border:1px solid var(--line,#D6ECF8);background:#fff;color:var(--deep,#0E4C80);border-radius:999px;padding:4px 10px;font-size:.75rem;cursor:pointer}
.hc-err{color:#b45309}
.hc-form{display:flex;gap:8px;align-items:flex-end;border-top:1px solid var(--line,#D6ECF8);padding:10px}
.hc-form textarea{flex:1;resize:none;min-height:44px;border:1px solid #c9dbe8;border-radius:10px;padding:8px 10px;font:16px Inter,system-ui,sans-serif}
.hc-send{border:0;border-radius:10px;background:var(--deep,#0E4C80);color:#fff;padding:0 14px;height:44px;font-weight:600;cursor:pointer}
.hc-send:disabled{opacity:.4}
.hc-use{font-size:11px;color:var(--muted,#4A6178);text-align:right;padding:0 10px 8px}
@media print{.hc-btn,.hc-panel{display:none}}`;

let msgs = [], busy = false, used = null, open = false, error = "";
let btn, panel, list, input, send, use;

function render() {
  const on = document.body.dataset.state && document.body.dataset.state !== "out";
  btn.hidden = !on || open; panel.hidden = !on || !open;
  list.replaceChildren();
  if (!msgs.length) list.append(el("div", { class: "hc-intro" }, [
    el("p", { text: "Pitaj kako se nešto radi u Hubu, Kalkulatoru, Povijesti ili CRM-u. Možeš pisati i na engleskom." }),
    el("small", { text: "Pomoć ne vidi tvoje klijente, kalkulacije ni druge podatke firme." }),
    el("div", { class: "hc-chips" }, SUGGEST.map(s => el("button", { type: "button", class: "hc-chip", "data-testid": "help-suggest", text: s, onclick: () => ask(s) }))),
  ]));
  for (const m of msgs) list.append(el("p", { class: "hc-msg", "data-role": m.role, "data-testid": "help-msg", text: m.content }));
  if (busy) list.append(el("p", { class: "hc-busy", "data-testid": "help-busy", text: "Pišem odgovor…" }));
  if (error) list.append(el("p", { class: "hc-err", role: "alert", "data-testid": "help-error", text: error }));
  send.disabled = busy || !input.value.trim();
  use.textContent = used == null ? "" : `${used}/${LIMIT} pitanja danas`;
  list.scrollTop = list.scrollHeight;
}

async function ask(q) {
  const question = String(q || "").trim().slice(0, MAX);
  if (!question || busy) return;
  const next = [...msgs, { role: "user", content: question }];
  msgs = next; input.value = ""; error = ""; busy = true; render();
  try {
    const token = await auth.accessToken().catch(() => "");
    const r = await fetch("/kalkulator/api/help", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (token || "") }, body: JSON.stringify({ messages: next }) });
    const body = await r.json().catch(() => ({}));
    if (body.usage) used = body.usage.used;
    if (!r.ok || !body.answer) throw new Error(body.error || "Pomoć trenutno nije dostupna.");
    msgs = [...next, { role: "assistant", content: tidy(body.answer) }];
  } catch (e) { error = e instanceof TypeError ? "Mreža nije dostupna." : e.message; }
  busy = false; render();
}

function mount() {
  document.head.append(el("style", { text: css }));
  btn = el("button", { type: "button", class: "hc-btn", "data-testid": "help-open", "aria-label": "Pomoć / Help", onclick: () => { open = true; render(); input.focus(); } });
  btn.innerHTML = ICON + "<span>Pomoć</span>";
  list = el("div", { class: "hc-list", "data-testid": "help-list" });
  input = el("textarea", { rows: "2", maxlength: String(MAX), placeholder: "Napiši pitanje…", "data-testid": "help-input" });
  input.addEventListener("input", () => { send.disabled = busy || !input.value.trim(); });
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input.value); } });
  send = el("button", { type: "submit", class: "hc-send", "data-testid": "help-send", "aria-label": "Pošalji", text: "➤" });
  use = el("p", { class: "hc-use", "data-testid": "help-usage" });
  panel = el("section", { class: "hc-panel", role: "dialog", "aria-label": "TADEX pomoć", "data-testid": "help-panel" }, [
    el("div", { class: "hc-head" }, [el("div", {}, [el("b", { text: "TADEX pomoć · Help" }), el("small", { text: "Kako se nešto radi u aplikacijama" })]),
      el("button", { type: "button", class: "hc-x", "aria-label": "Zatvori", "data-testid": "help-close", text: "×", onclick: () => { open = false; render(); } })]),
    list,
    el("form", { class: "hc-form", onsubmit: e => { e.preventDefault(); ask(input.value); } }, [input, send]),
    use,
  ]);
  document.body.append(btn, panel);
  new MutationObserver(render).observe(document.body, { attributes: true, attributeFilter: ["data-state"] });
  render();
}

try { mount(); } catch (e) { console.warn("help", e); }
