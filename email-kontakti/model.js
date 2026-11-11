// Pure rules for Email kontakti. No DOM and no network.
// A contact is saved in exactly one brand and one country. Blank fields stay blank.

export const NEED_ONE = "Unesite barem jedan podatak. Dovoljan je samo email, ili samo naziv firme.";
export const EMPTY_HINT = "Dovoljan je samo email. Naziv firme, ime i ostala polja mogu ostati prazna.";
export const SAVE_HINT = "Sva polja su opcionalna. Možete spremiti samo email, ili samo naziv firme. Podatke o poslanom emailu upišite tek kad ga budete bilježili.";
export const SEND_NEEDS_FROM_AND_WHO = "Kad bilježite poslani email, upišite email s kojega je poslano i tko je poslao.";
export const EMPTY_SEND = "Još nema zabilježenog poslanog emaila. Sanduče i kolega ostaju prazni dok ga ne upišete.";

export const BRANDS = {
  tadex: {
    title: "Tadex Baza",
    text: "Uvoz iz Kine · TADEX. Zasebna baza.",
  },
  strong: {
    title: "Strong Baza",
    text: "strong.ba · Mladen. Zasebna baza.",
  },
};

export const COUNTRIES = {
  HR: "Hrvatska",
  BA: "Bosna i Hercegovina",
};

export const STATUSES = [
  { value: "poslano", label: "Poslano" },
  { value: "čeka odgovor", label: "Čeka odgovor" },
  { value: "odgovorio", label: "Odgovorio" },
  { value: "dogovoreno", label: "Dogovoreno" },
];

const STATUS_VALUES = new Set(STATUSES.map(item => item.value));

export const FIELD_DEFS = [
  { key: "company_name", label: "Naziv firme", max: 200 },
  { key: "first_name", label: "Ime", max: 80 },
  { key: "last_name", label: "Prezime", max: 80 },
  { key: "job_title", label: "Funkcija", max: 120 },
  { key: "email", label: "Email", max: 320 },
  { key: "phone", label: "Telefon ili WhatsApp", max: 80 },
  { key: "city", label: "Grad", max: 120 },
  { key: "language", label: "Jezik", max: 80, placeholder: "npr. bosanski" },
  { key: "what_they_buy", label: "Što kupuju", max: 500, wide: true },
  { key: "owner_name", label: "Odgovorna osoba", max: 80, suggestions: ["Aida", "Magdalena", "Mladen"] },
  { key: "last_email_on", label: "Datum", type: "date", group: "send" },
  { key: "last_email_subject", label: "Naslov", max: 300, group: "send" },
  { key: "from_address", label: "Email s kojega je poslano", max: 320, group: "send" },
  { key: "sent_by", label: "Tko je poslao", max: 80, group: "send", suggestions: ["Tadija", "Aida", "Magdalena", "Mladen"] },
  { key: "status", label: "Status", type: "status" },
  { key: "next_follow_up", label: "Sljedeći follow-up", type: "date" },
  { key: "deal_ref", label: "Veza na posao (deal)", max: 120, hint: "Samo ako ID već postoji u hubu. Ostavite prazno ako nema." },
  { key: "predracun_ref", label: "Veza na predračun", max: 120, hint: "Samo ako ID već postoji u hubu. Ostavite prazno ako nema." },
  { key: "note", label: "Bilješka", max: 4000, type: "textarea", wide: true },
];

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isId(value) {
  return ID_RE.test(String(value || ""));
}

export function partition(brand, country) {
  if (brand !== "tadex" && brand !== "strong") return null;
  if (country !== "HR" && country !== "BA") return null;
  return { brand, country };
}

export function brandTitle(brand) {
  return BRANDS[brand] ? BRANDS[brand].title : "";
}

export function samePartition(row, brand, country) {
  return !!row && row.brand === brand && row.country === country;
}

export function rowsForPartition(rows, brand, country) {
  return (rows || []).filter(row => samePartition(row, brand, country));
}

function parseDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return { ok: true, value: null };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return { ok: false };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return { ok: false };
  return { ok: true, value: text };
}

function parseStatus(value) {
  const text = String(value ?? "").trim();
  if (!text) return { ok: true, value: null };
  if (!STATUS_VALUES.has(text)) return { ok: false };
  return { ok: true, value: text };
}

/** Build the row to insert or update. Brand and country come from the open baza, never from the form. */
export function buildWrite(form, brand, country) {
  const part = partition(brand, country);
  if (!part) return { ok: false, message: "Nepoznata baza ili država." };
  const source = form && typeof form === "object" ? form : {};
  const row = {};
  for (const field of FIELD_DEFS) {
    if (field.type === "date") {
      const parsed = parseDate(source[field.key]);
      if (!parsed.ok) return { ok: false, message: `Datum u polju "${field.label}" nije ispravan.` };
      row[field.key] = parsed.value;
      continue;
    }
    if (field.type === "status") {
      const parsed = parseStatus(source[field.key]);
      if (!parsed.ok) return { ok: false, message: "Status nije prepoznat. Ostavite prazno ili odaberite jedan sa liste." };
      row[field.key] = parsed.value;
      continue;
    }
    const text = source[field.key] == null ? "" : String(source[field.key]).trim();
    if (text.length > field.max) return { ok: false, message: `Polje "${field.label}" je predugo.` };
    row[field.key] = text || null;
  }
  const recordedSend = row.last_email_on != null || row.last_email_subject != null;
  if (recordedSend && (row.from_address == null || row.sent_by == null)) {
    return { ok: false, message: SEND_NEEDS_FROM_AND_WHO };
  }
  if (!Object.values(row).some(value => value != null && value !== "")) {
    return { ok: false, message: NEED_ONE };
  }
  return { ok: true, row: { ...row, brand: part.brand, country: part.country } };
}

export function personName(row) {
  return [row && row.first_name, row && row.last_name].filter(Boolean).join(" ");
}

export function cardTitle(row) {
  return personName(row) || (row && row.company_name) || (row && row.email) || (row && row.phone) || "Kontakt";
}

export function statusLabel(value) {
  if (!value) return "";
  const found = STATUSES.find(item => item.value === value);
  return found ? found.label : String(value);
}

export function formatDate(value) {
  if (value == null || value === "") return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return "";
  return `${Number(match[3])}.${Number(match[2])}.${match[1]}.`;
}

export function formatTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("bs-BA", {
      timeZone: "Europe/Sarajevo",
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

export function contactCountLabel(count) {
  if (count == null || Number.isNaN(Number(count))) return "";
  const n = Number(count);
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "kontakt"
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "kontakta"
    : "kontakata";
  return `${n} ${word}`;
}

/** Lines for the last sent email. Empty fields are omitted so nothing is invented. */
export function activitySummary(row) {
  if (!row) return [];
  const lines = [];
  if (row.last_email_on) lines.push({ k: "Datum", v: formatDate(row.last_email_on) });
  if (row.last_email_subject) lines.push({ k: "Naslov", v: String(row.last_email_subject) });
  if (row.from_address) lines.push({ k: "Sanduče", v: String(row.from_address) });
  if (row.sent_by) lines.push({ k: "Tko", v: String(row.sent_by) });
  return lines;
}

export function searchContacts(rows, query) {
  const q = String(query || "").trim().toLocaleLowerCase("bs");
  if (!q) return rows.slice();
  return rows.filter(row => {
    const name = `${row.first_name || ""} ${row.last_name || ""}`.trim().toLocaleLowerCase("bs");
    const parts = [row.email, row.first_name, row.last_name, name, row.company_name];
    return parts.some(part => String(part || "").toLocaleLowerCase("bs").includes(q));
  });
}

export function parseRoute(search) {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const brandRaw = params.get("baza");
  const countryRaw = params.get("drzava");
  const brand = brandRaw === "tadex" || brandRaw === "strong" ? brandRaw : null;
  const country = countryRaw === "HR" || countryRaw === "BA" ? countryRaw : null;
  if (!brand) return { screen: "brands" };
  if (!country) return { screen: "countries", brand };
  const q = (params.get("q") || "").trim();
  const id = isId(params.get("id")) ? params.get("id") : null;
  let mode = "list";
  if (params.get("novi") === "1") mode = "create";
  else if (params.get("uredi") === "1" && id) mode = "edit";
  else if (id) mode = "view";
  return {
    screen: "list",
    brand,
    country,
    mode,
    id: mode === "edit" || mode === "view" ? id : null,
    q,
  };
}

export function hrefFor(route = {}) {
  const params = new URLSearchParams();
  if (route.brand === "tadex" || route.brand === "strong") params.set("baza", route.brand);
  if ((route.country === "HR" || route.country === "BA") && params.has("baza")) params.set("drzava", route.country);
  if (route.q && params.has("drzava")) params.set("q", route.q);
  if (route.mode === "create" && params.has("drzava")) params.set("novi", "1");
  if (isId(route.id) && params.has("drzava") && (route.mode === "edit" || route.mode === "view")) params.set("id", route.id);
  if (route.mode === "edit" && params.has("id")) params.set("uredi", "1");
  const query = params.toString();
  return "/email-kontakti/" + (query ? `?${query}` : "");
}

export function brandChoices() {
  return ["tadex", "strong"].map(id => ({
    id,
    title: BRANDS[id].title,
    text: BRANDS[id].text,
    href: hrefFor({ brand: id }),
  }));
}

export function countryChoices(brand) {
  if (brand !== "tadex" && brand !== "strong") return [];
  return ["HR", "BA"].map(id => ({
    id,
    title: COUNTRIES[id],
    href: hrefFor({ brand, country: id }),
  }));
}

export function documentTitle(route) {
  const parts = [];
  if (route.country && COUNTRIES[route.country]) parts.push(COUNTRIES[route.country]);
  if (route.brand && brandTitle(route.brand)) parts.push(brandTitle(route.brand));
  parts.push("Email kontakti");
  return parts.join(" · ");
}

export function fieldGroups() {
  const groups = [];
  let current = null;
  for (const field of FIELD_DEFS) {
    const group = field.group || "";
    if (!current || current.group !== group) {
      current = { group, fields: [] };
      groups.push(current);
    }
    current.fields.push(field);
  }
  return groups;
}
