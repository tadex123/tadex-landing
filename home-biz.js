// Home page strip: "Zanimljivo za posao" (hub-news.js) + "Uskoro u kalendaru" (praznici/data.js).
import { currentNews } from "./hub-news.js";
import * as D from "./praznici/data.js";

const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderBiz({ companies }) {
  const box = document.querySelector("#biz-strip");
  if (!box) return;
  const today = D.isoDay(new Date());
  const news = currentNews(companies, today);
  const on = D.readLayers(globalThis.localStorage);
  // Home shows only dates that change work: neradni, rokovi, or ones with a practical note.
  const next = D.upcoming(on, today, 60).filter(ev => ev.off || ev.deadline || ev.note).slice(0, 4);
  const newsHtml = news ? `
    <article class="biz-card biz-news" aria-labelledby="biz-news-title">
      <p class="biz-kicker">Zanimljivo za posao · ${esc(news.date)}</p>
      <h3 id="biz-news-title">${esc(news.title)}</h3>
      <p>${esc(news.text)}</p>
      ${news.link ? `<a class="biz-link" href="${esc(news.link.href)}">${esc(news.link.label)} <span aria-hidden="true">→</span></a>` : ""}
    </article>` : "";
  const nextHtml = next.length ? `
    <article class="biz-card" aria-labelledby="biz-next-title">
      <p class="biz-kicker">Kalendar</p>
      <h3 id="biz-next-title">Uskoro</h3>
      <ul class="biz-list">${next.map(ev => {
        const c = D.chip(ev.date);
        const cls = ev.deadline ? "deadline" : ev.layer;
        const tag = ev.layer === "faith" ? "Vjerski" : (D.LAYERS.find(l => l.id === ev.layer) || {}).label + (ev.off ? " · neradni" : "");
        return `<li><span class="biz-chip biz-${cls}">${esc(c.d)}<small>${esc(c.m)}</small></span><span><b>${esc((ev.approx ? "≈ " : "") + ev.title)}</b><span class="biz-tag">${esc(tag)}</span></span></li>`;
      }).join("")}</ul>
      <a class="biz-link" href="/praznici/">Otvori kalendar <span aria-hidden="true">→</span></a>
    </article>` : "";
  box.innerHTML = newsHtml + nextHtml;
  box.classList.toggle("biz-one", !(newsHtml && nextHtml));
  box.hidden = !(newsHtml || nextHtml);
}
