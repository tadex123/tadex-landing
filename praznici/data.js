// Kalendar praznika i rokova za TADEX Hub (Tadija, 28. 11. 2026).
// Layers: "ba" BiH (FBiH, Vitez), "hr" Hrvatska, "cn" Kina, "global" svijet i sajmovi, "faith" vjerski.
// off: true = neradni dan na tom tržištu. approx: true = datum ovisi o mjesecu ili ga treba potvrditi (prikazuje se s ≈).
// Vjerski praznici su blago naglašeni: negdje se ne radi, negdje radi, pa ih imamo na umu pri planiranju.
// HOW TO UPDATE: add rows below (date "YYYY-MM-DD"). Keep one row per day; a multi-day item gets `to`.
// Kina: raspored neradnih dana za 2027. objavljuje kineska Vlada (State Council) krajem 2026. — tada provjeri `cn` redove.

export const LAYERS = [
  { id: "ba", label: "BiH", hint: "Državni praznici u FBiH" },
  { id: "hr", label: "Hrvatska", hint: "Državni praznici u HR" },
  { id: "cn", label: "Kina", hint: "Praznici i rokovi u Kini" },
  { id: "global", label: "Svijet i sajmovi", hint: "Sajmovi i važni svjetski datumi" },
  { id: "faith", label: "Vjerski", hint: "Katolički, pravoslavni i islamski praznici" },
];

/** Default layers for a new viewer; each person can change them (saved in the browser). */
export const DEFAULT_ON = { ba: true, hr: false, cn: true, global: true, faith: true };

export const FIRST_MONTH = "2026-12";
export const LAST_MONTH = "2027-12";

export const EVENTS = [
  // ---------- Decembar 2026 ----------
  { date: "2026-12-24", layer: "faith", title: "Badnjak (katolički)" },
  { date: "2026-12-25", layer: "faith", title: "Božić (katolički)", note: "U BiH neradni za katolike; u Vitezu većina firmi ne radi." },
  { date: "2026-12-25", layer: "hr", title: "Božić", off: true },
  { date: "2026-12-25", layer: "global", title: "Božić u Evropi i SAD", note: "Kupci i špediteri iz EU uglavnom ne rade do 2. 1." },
  { date: "2026-12-26", layer: "hr", title: "Sveti Stjepan", off: true },
  { date: "2026-12-31", layer: "global", title: "Stara godina" },

  // ---------- Januar 2027 ----------
  { date: "2027-01-01", layer: "ba", title: "Nova godina", off: true, to: "2027-01-02" },
  { date: "2027-01-01", layer: "hr", title: "Nova godina", off: true },
  { date: "2027-01-01", layer: "cn", title: "Nova godina", off: true },
  { date: "2027-01-06", layer: "hr", title: "Sveta tri kralja", off: true },
  { date: "2027-01-06", layer: "faith", title: "Badnji dan (pravoslavni) · Sveta tri kralja (katolički)" },
  { date: "2027-01-07", layer: "faith", title: "Božić (pravoslavni)", note: "U BiH neradni za pravoslavne." },
  { date: "2027-01-10", layer: "cn", title: "Rok: potvrde narudžbi prije kineske Nove godine", approx: true,
    note: "Sve što treba stići do marta potvrdite s kupcem i fabrikom do ovog datuma.", deadline: true },
  { date: "2027-01-14", layer: "faith", title: "Pravoslavna Nova godina" },
  { date: "2027-01-25", layer: "cn", title: "Fabrike usporavaju, radnici kreću kući", approx: true,
    note: "Odgovori i proizvodnja kasne do kraja februara." },

  // ---------- Februar 2027 ----------
  { date: "2027-02-06", layer: "cn", title: "Kineska Nova godina (Proljetni festival)", off: true, approx: true, to: "2027-02-12",
    note: "Službeni praznik traje oko 7 dana; fabrike stoje 2 do 4 sedmice. Tačne neradne dane potvrđuje kineska Vlada." },
  { date: "2027-02-08", layer: "faith", title: "Početak ramazana", approx: true, note: "Kod dijela kupaca i kolega kraći radni dan." },
  { date: "2027-02-10", layer: "faith", title: "Pepelnica (katolički)" },
  { date: "2027-02-20", layer: "cn", title: "Lantern festival · fabrike se vraćaju", approx: true },
  { date: "2027-02-26", layer: "cn", title: "Većina fabrika opet radi punim kapacitetom", approx: true,
    note: "Tada šaljite nove upite i provjerite rokove." },

  // ---------- Mart 2027 ----------
  { date: "2027-03-01", layer: "ba", title: "Dan nezavisnosti BiH", off: true },
  { date: "2027-03-10", layer: "faith", title: "Ramazanski bajram", approx: true, note: "U BiH neradni za muslimane, obično 1 do 3 dana." },
  { date: "2027-03-26", layer: "faith", title: "Veliki petak (katolički)" },
  { date: "2027-03-28", layer: "faith", title: "Uskrs (katolički)" },
  { date: "2027-03-28", layer: "hr", title: "Uskrs", off: true },
  { date: "2027-03-29", layer: "hr", title: "Uskrsni ponedjeljak", off: true },
  { date: "2027-03-29", layer: "faith", title: "Uskrsni ponedjeljak (katolički)", note: "U BiH neradni za katolike." },

  // ---------- April 2027 ----------
  { date: "2027-04-05", layer: "cn", title: "Qingming (Dan čišćenja grobova)", off: true, approx: true },
  { date: "2027-04-15", layer: "global", title: "Canton Fair, proljeće · 1. faza (mašine, alati)", approx: true, to: "2027-04-19" },
  { date: "2027-04-23", layer: "global", title: "Canton Fair · 2. faza (kuća, dekor, poklon)", approx: true, to: "2027-04-27" },
  { date: "2027-04-30", layer: "faith", title: "Veliki petak (pravoslavni)" },

  // ---------- Maj 2027 ----------
  { date: "2027-05-01", layer: "ba", title: "Praznik rada", off: true, to: "2027-05-02" },
  { date: "2027-05-01", layer: "hr", title: "Praznik rada", off: true },
  { date: "2027-05-01", layer: "cn", title: "Praznik rada", off: true, approx: true, to: "2027-05-05",
    note: "Kina ne radi oko 5 dana." },
  { date: "2027-05-01", layer: "global", title: "Canton Fair · 3. faza (tekstil, hrana, zdravlje)", approx: true, to: "2027-05-05" },
  { date: "2027-05-02", layer: "faith", title: "Uskrs (pravoslavni)" },
  { date: "2027-05-03", layer: "faith", title: "Uskrsni ponedjeljak (pravoslavni)", note: "U BiH neradni za pravoslavne." },
  { date: "2027-05-17", layer: "faith", title: "Kurban-bajram", approx: true, note: "U BiH neradni za muslimane, obično 1 do 4 dana." },
  { date: "2027-05-27", layer: "hr", title: "Tijelovo", off: true },
  { date: "2027-05-27", layer: "faith", title: "Tijelovo (katolički)" },
  { date: "2027-05-30", layer: "hr", title: "Dan državnosti", off: true },

  // ---------- Juni 2027 ----------
  { date: "2027-06-06", layer: "faith", title: "Nova hidžretska godina", approx: true },
  { date: "2027-06-09", layer: "cn", title: "Festival zmajevih čamaca (Duanwu)", off: true, approx: true },
  { date: "2027-06-22", layer: "hr", title: "Dan antifašističke borbe", off: true },

  // ---------- August 2027 ----------
  { date: "2027-08-05", layer: "hr", title: "Dan pobjede i domovinske zahvalnosti", off: true },
  { date: "2027-08-15", layer: "hr", title: "Velika Gospa", off: true },
  { date: "2027-08-15", layer: "faith", title: "Velika Gospa (katolički)" },
  { date: "2027-08-15", layer: "faith", title: "Mevlud", approx: true },

  // ---------- Septembar 2027 ----------
  { date: "2027-09-15", layer: "cn", title: "Mid-Autumn festival (Mjesečev festival)", off: true, approx: true },
  { date: "2027-09-15", layer: "cn", title: "Rok: narudžbe prije Golden Weeka", approx: true, deadline: true,
    note: "Potvrdite proizvodnju prije 1. 10., Kina tada stoji sedmicu dana." },

  // ---------- Oktobar 2027 ----------
  { date: "2027-10-01", layer: "cn", title: "Dan državnosti Kine · Golden Week", off: true, approx: true, to: "2027-10-07",
    note: "Fabrike, luke i uredi ne rade oko 7 dana; poslije toga gužva u proizvodnji." },
  { date: "2027-10-15", layer: "global", title: "Canton Fair, jesen · 1. faza", approx: true, to: "2027-10-19" },
  { date: "2027-10-21", layer: "global", title: "Yiwu sajam (China Yiwu Int. Commodities Fair)", approx: true, to: "2027-10-24" },
  { date: "2027-10-23", layer: "global", title: "Canton Fair · 2. faza", approx: true, to: "2027-10-27" },
  { date: "2027-10-31", layer: "global", title: "Canton Fair · 3. faza", approx: true, to: "2027-11-04" },

  // ---------- Novembar 2027 ----------
  { date: "2027-11-01", layer: "hr", title: "Svi sveti", off: true },
  { date: "2027-11-01", layer: "faith", title: "Svi sveti (katolički)", note: "U BiH neradni za katolike." },
  { date: "2027-11-11", layer: "cn", title: "Singles' Day (11.11.) · najveća online prodaja u Kini" },
  { date: "2027-11-18", layer: "hr", title: "Dan sjećanja na Vukovar i Škabrnju", off: true },
  { date: "2027-11-25", layer: "ba", title: "Dan državnosti BiH", off: true },
  { date: "2027-11-26", layer: "global", title: "Black Friday" },

  // ---------- Decembar 2027 ----------
  { date: "2027-12-24", layer: "faith", title: "Badnjak (katolički)" },
  { date: "2027-12-25", layer: "faith", title: "Božić (katolički)", note: "U BiH neradni za katolike." },
  { date: "2027-12-25", layer: "hr", title: "Božić", off: true },
  { date: "2027-12-26", layer: "hr", title: "Sveti Stjepan", off: true },
  { date: "2027-12-31", layer: "global", title: "Stara godina" },
];

// ---------- helpers (pure, tested in data.test.mjs) ----------

const pad = n => String(n).padStart(2, "0");
export const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Every day an event covers ("to" makes it multi-day). */
export function eventDays(ev) {
  const out = [];
  const start = new Date(ev.date + "T12:00:00");
  const end = new Date((ev.to || ev.date) + "T12:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(isoDay(d));
  return out;
}

/** Events per ISO day for the layers that are on. */
export function eventsByDay(on, events = EVENTS) {
  const map = new Map();
  for (const ev of events) {
    if (!on[ev.layer]) continue;
    for (const day of eventDays(ev)) {
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(ev);
    }
  }
  return map;
}

/** Next items from `today` on (by start date, plus items still running), for the layers that are on. */
export function upcoming(on, today, limit = 4, events = EVENTS) {
  return events
    .filter(ev => on[ev.layer] && (ev.to || ev.date) >= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, limit);
}

export const MONTHS_BS = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
export const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** "2027-02-06" -> { d: "6", m: "feb" } */
export function chip(date) {
  const [, m, d] = date.split("-");
  return { d: String(Number(d)), m: MONTHS_SHORT[Number(m) - 1] };
}

export function readLayers(storage, key = "hub-praznici-layers") {
  try {
    const raw = storage && storage.getItem(key);
    if (!raw) return { ...DEFAULT_ON };
    const saved = JSON.parse(raw);
    const out = { ...DEFAULT_ON };
    for (const l of LAYERS) if (typeof saved[l.id] === "boolean") out[l.id] = saved[l.id];
    return out;
  } catch { return { ...DEFAULT_ON }; }
}

export function saveLayers(storage, on, key = "hub-praznici-layers") {
  try { storage && storage.setItem(key, JSON.stringify(on)); } catch { /* private window */ }
}
