// Hub languages. Signed out the hub is in English; signed in, each person picks BS / HR / SR / EN
// (saved per device in localStorage, default Bosnian). Covers the hub page only, not the Admin panel
// or the apps behind the tiles.
export const LANGS = [
  ["bs", "BS", "Bosanski"],
  ["hr", "HR", "Hrvatski"],
  ["sr", "SR", "Srpski"],
  ["en", "EN", "English"],
];
const KEY = "hub-lang";
const DEFAULT_SIGNED_IN = "bs";

// [en, bs, hr, sr]
const D = {
  "h1.a": ["Welcome,", "Dobro došli,", "Dobro došli,", "Dobro došli,"],
  "h1.b": ["TADEX team", "tim TADEX", "tim TADEX", "tim TADEX"],
  "sub.out": ["Your TADEX team workspace. Sign in to continue.", "Radni prostor tima TADEX. Prijavi se i nastavi gdje si stao.", "Radni prostor tima TADEX. Prijavi se i nastavi gdje si stao.", "Radni prostor tima TADEX. Prijavi se i nastavi gde si stao."],
  "sub.in": ["All your apps in one place.", "Sve tvoje aplikacije na jednom mjestu.", "Sve tvoje aplikacije na jednom mjestu.", "Sve tvoje aplikacije na jednom mestu."],
  "nav.login": ["Sign in", "Prijava", "Prijava", "Prijava"],
  "nav.signout": ["Sign out", "Odjava", "Odjava", "Odjava"],
  "lang.label": ["Language", "Jezik", "Jezik", "Jezik"],
  "preview": ["Preview · sample data", "Pregled · probni podaci", "Pregled · probni podaci", "Pregled · probni podaci"],
  "form.signin": ["Sign in", "Prijava", "Prijava", "Prijava"],
  "form.request": ["Request access", "Zatraži pristup", "Zatraži pristup", "Zatraži pristup"],
  "form.reset": ["New password", "Nova lozinka", "Nova lozinka", "Nova lozinka"],
  "submit.signin": ["Sign in", "Prijavi se", "Prijavi se", "Prijavi se"],
  "submit.request": ["Send request", "Pošalji zahtjev", "Pošalji zahtjev", "Pošalji zahtev"],
  "submit.reset": ["Send link", "Pošalji link", "Pošalji poveznicu", "Pošalji link"],
  "toggle.back": ["Back to sign in", "Nazad na prijavu", "Natrag na prijavu", "Nazad na prijavu"],
  "lead.request": ["Already approved?", "Već imaš pristup?", "Već imaš pristup?", "Već imaš pristup?"],
  "lead.reset": ["Remembered it?", "Sjetio si se?", "Sjetio si se?", "Setio si se?"],
  "lead.signin": ["No account yet?", "Nemaš račun?", "Nemaš račun?", "Nemaš nalog?"],
  "field.name": ["Full name", "Ime i prezime", "Ime i prezime", "Ime i prezime"],
  "field.email": ["Email", "E-mail", "E-mail", "E-mail"],
  "field.password": ["Password", "Lozinka", "Lozinka", "Lozinka"],
  "forgot": ["Forgot password?", "Zaboravljena lozinka?", "Zaboravljena lozinka?", "Zaboravljena lozinka?"],
  "reset.hint": ["Enter your email and we'll send you a link to choose a new password.", "Upiši e-mail i poslat ćemo ti link za novu lozinku.", "Upiši e-mail i poslat ćemo ti poveznicu za novu lozinku.", "Upiši e-mail i poslaćemo ti link za novu lozinku."],
  "note": ["New accounts need the admin's approval.", "Admin mora odobriti novi račun.", "Admin mora odobriti novi račun.", "Admin mora da odobri novi nalog."],
  "apps": ["Apps", "Aplikacije", "Aplikacije", "Aplikacije"],
  "apps.back": ["← Apps", "← Aplikacije", "← Aplikacije", "← Aplikacije"],
  "open": ["Open", "Otvori", "Otvori", "Otvori"],
  "apps.none": ["No apps assigned yet. Contact your admin.", "Još nemaš dodijeljenih aplikacija. Javi se adminu.", "Još nemaš dodijeljenih aplikacija. Javi se adminu.", "Još nemaš dodeljenih aplikacija. Javi se adminu."],
  "err.email": ["Please enter the email you use for TADEX Hub.", "Upiši e-mail koji koristiš za TADEX Hub.", "Upiši e-mail koji koristiš za TADEX Hub.", "Upiši e-mail koji koristiš za TADEX Hub."],
  "ok.reset": ["If {email} has a TADEX Hub account, a reset link is on its way. Open it on any device to choose a new password.", "Ako {email} ima TADEX Hub račun, link za novu lozinku je na putu. Otvori ga na bilo kojem uređaju i izaberi novu lozinku.", "Ako {email} ima TADEX Hub račun, poveznica za novu lozinku je na putu. Otvori je na bilo kojem uređaju i odaberi novu lozinku.", "Ako {email} ima TADEX Hub nalog, link za novu lozinku je na putu. Otvori ga na bilo kom uređaju i izaberi novu lozinku."],
  "err.name": ["Please enter your full name.", "Upiši ime i prezime.", "Upiši ime i prezime.", "Upiši ime i prezime."],
  "ok.request": ["Your request was sent. You'll get access once the admin approves it.", "Zahtjev je poslan. Dobit ćeš pristup kad ga admin odobri.", "Zahtjev je poslan. Dobit ćeš pristup kad ga admin odobri.", "Zahtev je poslat. Dobićeš pristup kad ga admin odobri."],
  "err.generic": ["Something went wrong. Please try again.", "Nešto nije u redu. Pokušaj ponovo.", "Nešto nije u redu. Pokušaj ponovno.", "Nešto nije u redu. Pokušaj ponovo."],
  "err.noaccess": ["You don't have access to that app yet. Ask your admin.", "Još nemaš pristup toj aplikaciji. Javi se adminu.", "Još nemaš pristup toj aplikaciji. Javi se adminu.", "Još nemaš pristup toj aplikaciji. Javi se adminu."],
  "ok.confirmed": ["Your email is confirmed. You can sign in now.", "E-mail je potvrđen. Sada se možeš prijaviti.", "E-mail je potvrđen. Sada se možeš prijaviti.", "E-mail je potvrđen. Sada možeš da se prijaviš."],
  "thought": ["Thought of the day", "Misao dana", "Misao dana", "Misao dana"],
  "clocks": ["Local time", "Lokalno vrijeme", "Lokalno vrijeme", "Lokalno vreme"],
  "clocks.diff": ["Shanghai is {n} h ahead", "Šangaj je {n} h ispred", "Šangaj je {n} h ispred", "Šangaj je {n} h ispred"],
  "city.sh": ["Shanghai", "Šangaj", "Šangaj", "Šangaj"],
  "route": ["Goods route", "Put robe", "Put robe", "Put robe"],
  "route.main": ["by sea via Suez", "morem preko Sueca", "morem preko Sueza", "morem preko Sueca"],
  "route.alt": ["around the Cape of Good Hope", "oko Rta dobre nade", "oko Rta dobre nade", "oko Rta dobre nade"],
  "foot.login": ["Sign in →", "Prijava →", "Prijava →", "Prijava →"],
  "app.calculator": ["Calculator", "Kalkulator", "Kalkulator", "Kalkulator"],
  "app.app2": ["Calculation history", "Povijest kalkulacija", "Povijest kalkulacija", "Istorija kalkulacija"],
  "app.crm": ["CRM", "CRM", "CRM", "CRM"],
  "app.email-kontakti": ["Email contacts", "Email kontakti", "Email kontakti", "Email kontakti"],
  "app.logistika": ["Logistics", "Logistika", "Logistika", "Logistika"],
  "app.posiljke": ["Shipments", "Pošiljke", "Pošiljke", "Pošiljke"],
  "app.ture": ["Trips", "Ture", "Ture", "Ture"],
  "app.flota": ["Fleet", "Flota", "Flota", "Flota"],
  "app.draft": ["draft", "nacrt", "nacrt", "nacrt"],
  "app.kalendar": ["My calendar", "Moj kalendar", "Moj kalendar", "Moj kalendar"],
  "app.kalendar.label": ["Private schedule", "Privatni raspored", "Privatni raspored", "Privatni raspored"],
  "app.soon": ["Coming soon", "Uskoro", "Uskoro", "Uskoro"],
  "app.soon.label": ["Room for a new app", "Mjesto za novu aplikaciju", "Mjesto za novu aplikaciju", "Mesto za novu aplikaciju"],
};
const IDX = { en: 0, bs: 1, hr: 2, sr: 3 };

let lang = "en";
export const getLang = () => lang;
export const has = k => k in D;

export function t(k, vars) {
  const row = D[k];
  let s = row ? row[IDX[lang]] ?? row[0] : k;
  if (vars) for (const [n, v] of Object.entries(vars)) s = s.replace(`{${n}}`, v);
  return s;
}

export function savedLang() {
  try { const v = localStorage.getItem(KEY); if (v && v in IDX) return v; } catch { /* storage blocked */ }
  return DEFAULT_SIGNED_IN;
}

export function saveLang(l) {
  try { localStorage.setItem(KEY, l); } catch { /* storage blocked: choice lasts this visit only */ }
}

/** Switch the page language and refresh every [data-i18n] text. */
export function setLang(l) {
  lang = l in IDX ? l : "en";
  document.documentElement.lang = lang;
  document.body.dataset.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
  const sel = document.getElementById("lang");
  if (sel && sel.value !== lang) sel.value = lang;
  document.dispatchEvent(new CustomEvent("hub-lang", { detail: lang }));
}

// Day and month names; Intl has no reliable data for bs/hr/sr in every browser.
const DAYS = {
  bs: ["nedjelja", "ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota"],
  hr: ["nedjelja", "ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota"],
  sr: ["nedelja", "ponedeljak", "utorak", "sreda", "četvrtak", "petak", "subota"],
};
const MONTHS = {
  bs: ["januar", "februar", "mart", "april", "maj", "juni", "juli", "august", "septembar", "oktobar", "novembar", "decembar"],
  hr: ["siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja", "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca"],
  sr: ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"],
};
const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "petak, 13. novembar" / "petak, 13. studenoga" / "Friday 13 November", in time zone `tz`. */
export function formatDay(tz, d) {
  if (lang === "en") return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(d);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", day: "numeric", month: "numeric" }).formatToParts(d).map(x => [x.type, x.value]));
  return `${DAYS[lang][EN_DAYS.indexOf(p.weekday)] ?? ""}, ${p.day}. ${MONTHS[lang][+p.month - 1] ?? ""}`;
}
