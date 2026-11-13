import { formatDay, t } from "./i18n.js";
// Hero clocks: Sarajevo + Shanghai. Pure Intl.DateTimeFormat with timeZone (DST-correct), no network.
const ZONES = [
  { id: "sa", tz: "Europe/Sarajevo", dateLocale: "bs" },
  { id: "sh", tz: "Asia/Shanghai", dateLocale: "zh-CN" },
];
const cache = new Map();
const fmt = (locale, opts) => { const k = locale + JSON.stringify(opts); if (!cache.has(k)) { try { cache.set(k, new Intl.DateTimeFormat(locale, opts)); } catch { cache.set(k, new Intl.DateTimeFormat("en-GB", opts)); } } return cache.get(k); };

/** Minutes the zone is ahead of UTC at instant `d`. */
export function offsetMinutes(tz, d = new Date()) {
  const p = Object.fromEntries(fmt("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  return Math.round((asUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}

function tick() {
  const root = document.getElementById("clocks");
  if (!root) return;
  const now = new Date();
  for (const z of ZONES) {
    const el = root.querySelector(`[data-clock="${z.id}"]`);
    if (!el) continue;
    const hm = fmt("en-GB", { timeZone: z.tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
    const ss = fmt("en-GB", { timeZone: z.tz, second: "2-digit" }).format(now).padStart(2, "0");
    el.querySelector(".clock-hm").textContent = hm;
    el.querySelector(".clock-ss").textContent = ss;
    el.querySelector("time").dateTime = now.toISOString();
    el.querySelector(".clock-date").textContent = formatDay(z.tz, now);
  }
  const diffH = (offsetMinutes("Asia/Shanghai", now) - offsetMinutes("Europe/Sarajevo", now)) / 60;
  const d = root.querySelector(".clocks-diff");
  if (d) { const n = String(diffH).replace(".", ","); d.textContent = t("clocks.diff", { n: document.documentElement.lang === "en" ? String(diffH) : n }); d.dataset.hours = String(diffH); }
}

export function mountClocks() {
  tick();
  // re-align to the next full second, then tick every second
  setTimeout(() => { tick(); setInterval(tick, 1000); }, 1000 - (Date.now() % 1000) + 5);
}
