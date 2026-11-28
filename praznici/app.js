// Kalendar praznika i rokova. Every approved hub member; holiday data is in ./data.js (no database).
import { getSession, startHeartbeat } from "/auth.js";
import * as D from "./data.js";

const app = document.querySelector("#app");
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LOCAL_PREVIEW = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has("preview");
const LAYER_BY_ID = Object.fromEntries(D.LAYERS.map(l => [l.id, l]));
const DOW = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

const today = D.isoDay(new Date());
let on = D.readLayers(globalThis.localStorage);
let month = clampMonth(today.slice(0, 7));
let picked = today;

function clampMonth(m) { return m < D.FIRST_MONTH ? D.FIRST_MONTH : m > D.LAST_MONTH ? D.LAST_MONTH : m; }
function shift(m, by) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const label = ev => (ev.approx ? "≈ " : "") + ev.title;
const evClass = ev => `ev ev-${ev.layer}${ev.off ? " off" : ""}${ev.deadline ? " deadline" : ""}`;
const chipClass = ev => ev.deadline ? "chip chip-deadline" : `chip chip-${ev.layer}`;
function tagFor(ev) {
  const l = LAYER_BY_ID[ev.layer];
  if (ev.layer === "faith") return "Vjerski";
  return l.label + (ev.off ? " · neradni" : "");
}

function itemHtml(ev, withDate = true) {
  const c = D.chip(ev.date);
  const range = ev.to ? ` do ${D.chip(ev.to).d}. ${D.chip(ev.to).m}` : "";
  return `<li>${withDate ? `<span class="${chipClass(ev)}">${esc(c.d)}<small>${esc(c.m)}</small></span>` : `<span class="${chipClass(ev)}">·</span>`}
    <span><span class="tagline">${esc(tagFor(ev))}</span><b>${esc(label(ev))}${esc(range)}</b>${ev.note ? `<span class="why">${esc(ev.note)}</span>` : ""}</span></li>`;
}

function render() {
  const byDay = D.eventsByDay(on);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  let cells = DOW.map(d => `<div class="dow">${d}</div>`).join("");
  for (let i = 0; i < lead; i++) cells += `<div class="cell empty" aria-hidden="true"></div>`;
  for (let d = 1; d <= days; d++) {
    const iso = `${month}-${String(d).padStart(2, "0")}`;
    const list = byDay.get(iso) || [];
    const wd = (lead + d - 1) % 7;
    const offHome = list.some(e => e.off && (e.layer === "ba" || e.layer === "hr"));
    const offCn = list.some(e => e.off && e.layer === "cn");
    const cls = ["cell", wd >= 5 ? "weekend" : "", iso === today ? "today" : "", offHome ? "off-ba" : offCn ? "off" : ""].filter(Boolean).join(" ");
    const aria = `${d}. ${D.MONTHS_BS[m - 1]}${list.length ? ": " + list.map(label).join(", ") : ""}`;
    cells += `<div class="${cls}" role="button" tabindex="0" data-day="${iso}" aria-label="${esc(aria)}"><span class="n">${d}</span>${list.map(e => `<span class="${evClass(e)}" title="${esc(label(e))}">${esc(label(e))}</span>`).join("")}</div>`;
  }
  const pickedList = (byDay.get(picked) || []);
  const pc = D.chip(picked);
  const next = D.upcoming(on, today, 8);
  app.innerHTML = `
    <div>
      <h1>Kalendar praznika i rokova</h1>
      <p class="lede">Praznici tvog tržišta, Kine i svijeta, sa rokovima za narudžbe. Vjerski praznici su tačkasti i blagi: negdje se tada ne radi, negdje radi, pa ih imaj na umu pri dogovoru rokova i sastanaka. Datumi s ≈ ovise o mjesecu ili ih tek treba zvanično potvrditi.</p>
    </div>
    <div class="layers" role="group" aria-label="Šta prikazati">
      ${D.LAYERS.map(l => `<button type="button" class="layer" aria-pressed="${on[l.id] ? "true" : "false"}" data-layer="${l.id}" title="${esc(l.hint)}"><span class="dot dot-${l.id}"></span>${esc(l.label)}</button>`).join("")}
    </div>
    <div class="grid2">
      <section class="card" aria-label="Mjesec">
        <div class="monthbar">
          <button type="button" class="navbtn" data-nav="-1" aria-label="Prethodni mjesec" ${month <= D.FIRST_MONTH ? "disabled" : ""}>‹</button>
          <h2 aria-live="polite">${esc(D.MONTHS_BS[m - 1])} ${y}.</h2>
          <button type="button" class="navbtn" data-nav="1" aria-label="Sljedeći mjesec" ${month >= D.LAST_MONTH ? "disabled" : ""}>›</button>
          <button type="button" class="today-btn" data-nav="0">Danas</button>
        </div>
        <div class="cal">${cells}</div>
      </section>
      <div style="display:grid;gap:18px;min-width:0">
        <section class="card" aria-label="Izabrani dan">
          <h2>${esc(pc.d)}. ${esc(D.MONTHS_BS[Number(picked.slice(5, 7)) - 1].toLowerCase())}${picked === today ? " · danas" : ""}</h2>
          ${pickedList.length ? `<ul class="list">${pickedList.map(e => itemHtml(e, false)).join("")}</ul>` : `<p class="muted">Nema praznika ni rokova za uključene slojeve.</p>`}
        </section>
        <section class="card" aria-label="Uskoro">
          <h2>Uskoro</h2>
          ${next.length ? `<ul class="list">${next.map(e => itemHtml(e)).join("")}</ul>` : `<p class="muted">Ništa u narednom periodu za uključene slojeve.</p>`}
          <p class="note">Klikni na dan u kalendaru za detalje. Izbor slojeva se pamti na ovom uređaju.</p>
        </section>
      </div>
    </div>`;
}

app.addEventListener("click", e => {
  const layer = e.target.closest("[data-layer]");
  if (layer) { const id = layer.dataset.layer; on = { ...on, [id]: !on[id] }; D.saveLayers(globalThis.localStorage, on); render(); return; }
  const nav = e.target.closest("[data-nav]");
  if (nav) {
    const by = Number(nav.dataset.nav);
    if (by === 0) { month = clampMonth(today.slice(0, 7)); picked = today; } else month = clampMonth(shift(month, by));
    render(); return;
  }
  const cell = e.target.closest("[data-day]");
  if (cell) { picked = cell.dataset.day; render(); document.querySelector('[data-day="' + picked + '"]')?.focus(); }
});
app.addEventListener("keydown", e => {
  const cell = e.target.closest && e.target.closest("[data-day]");
  if (cell && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); cell.click(); }
});

async function boot() {
  if (LOCAL_PREVIEW) { render(); return; }
  let session = null;
  try { session = await getSession(); } catch { session = null; }
  if (!session) { location.replace("/?next=" + encodeURIComponent(location.pathname)); return; }
  const who = document.querySelector("#who");
  if (who) who.textContent = session.profile.full_name || session.user.email;
  try { startHeartbeat("hub"); } catch { /* optional */ }
  render();
}
boot();
