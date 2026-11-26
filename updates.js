// "Šta je novo": short notes about Hub updates, shown once after sign-in until the person clicks "Pročitao sam".
// HOW TO ADD AN UPDATE: put a new entry at the TOP of HUB_UPDATES with a new, later `id` (date + letter).
// `companies` limits who sees it ("tadex" / "strong" / "ruyi"); leave it out for everyone.
// Seen state is kept per person and per device (localStorage), like the video-guide card.

export const HUB_UPDATES = [
  {
    id: "2026-11-26d", date: "26. 11. 2026.", companies: ["tadex"],
    title: "CRM: manje duplih upita i pogrešnih predračuna",
    items: [
      "„Spremi kalkulaciju” više ne kači kalkulaciju na tuđi predračun. Nova verzija ide samo na predračun te kalkulacije ili na onaj s istim Brojem.",
      "Kad u „Napravi nacrt” izabereš „+ Novi upit” za klijenta koji već ima otvoren upit, Hub te upozori. Ako je ista narudžba, klikni „Nova verzija na …” i novi Broj (npr. T-086/26) prelazi na postojeći upit. Za drugu narudžbu označi „Ovo je druga, nova narudžba”.",
      "Fajl čije ime kaže šta je (npr. „Packing list.pdf”, „Quotation…”, „…Proforma Invoice”) sam ide pod tu vrstu, i kad je u izboru ostalo nešto drugo.",
    ],
  },
  {
    id: "2026-11-26a", date: "26. 11. 2026.", companies: ["tadex", "strong"],
    title: "CRM: nova faza „Odustao” s razlogom",
    items: [
      "Kad klijent odustane, izaberi status „Odustao”. Spremiti se može tek kad izabereš razlog (npr. cijena previsoka, kupio kod drugog), a detalje možeš dopisati.",
      "Razlog se vidi na predmetu i na kartici u Pipelineu. Odustali upiti se ne broje kao aktivni i ne traže follow-up.",
    ],
  },
  {
    id: "2026-11-26b", date: "26. 11. 2026.", companies: ["tadex"],
    title: "Kalkulator: zbirni transport ili puni kontejner",
    items: [
      "U kalkulatoru je novi dio „Način prijevoza”: Zbirni transport ili Puni kontejner (20', 40' ili 40' HC).",
      "Kod punog kontejnera upiši CBM i težinu, pa kalkulator pokaže koliko je kontejner pun i upozori ako roba ne stane.",
      "Izbor se sprema uz kalkulaciju u Povijesti.",
    ],
  },
  {
    id: "2026-11-26c", date: "26. 11. 2026.",
    title: "Email kontakti: tekst poslanog maila i odvojene baze",
    items: [
      "Uz zadnji poslani email sada možeš zalijepiti i tekst maila, pa kolege vide šta je kupcu napisano.",
      "Tadex baza je na TADEX strani, a Strong baza ima svoju pločicu na STRONG strani. Svako vidi samo bazu svoje firme.",
    ],
  },
  {
    id: "2026-11-25a", date: "25. 11. 2026.", companies: ["strong"],
    title: "STRONG: Katalog i cijene je sada posebna aplikacija",
    items: [
      "Na STRONG strani Huba prva pločica je „Katalog i cijene”: modeli, konfiguracije, cijene i stanje po modelu.",
      "„Skladište” se sada otvara i vodi na Zalihe.",
      "Predračun se i dalje pravi u STRONG CRM-u, na poslu kupca. Stavke uzima iz kataloga.",
    ],
  },
  {
    id: "2026-11-25b", date: "25. 11. 2026.", companies: ["tadex"],
    title: "Logistika: Ture povezane s pošiljkom i voznim parkom",
    items: [
      "Kad na turi izabereš pošiljku, sama se popune luka polaska, odredište, kamion i vozač.",
      "Ako kamion ima problem u voznom parku, npr. isteklu registraciju, tura to odmah pokaže kao upozorenje.",
    ],
  },
  {
    id: "2026-11-24a", date: "24. 11. 2026.", companies: ["tadex"],
    title: "Kalkulator i CRM: verzije predračuna i odobrenja",
    items: [
      "Napomene na predračunu imaju novi tekst o načinu plaćanja.",
      "„Nova verzija nacrta” otvara kalkulaciju za izmjenu. Kad klikneš „Spremi kalkulaciju”, nova verzija se napravi sama.",
      "Operater može otvoriti kalkulaciju koju je Direktor spremio na njegovom klijentu, a vidi je i u Povijesti.",
      "Direktor može vratiti i već odobreni predračun na doradu, uz komentar.",
      "Nacrt bez Broja kalkulacije je zaključan i piše šta fali.",
      "Ekran pregleda upozori kad je prijevoz 0 i pokaže provjeru dokumenata.",
    ],
  },
];

const key = (userId) => "hub-updates-seen:" + (userId || "");

/** Updates this person should see: their companies, or everyone when `companies` is missing. */
export function updatesFor(companies) {
  const mine = new Set(companies || []);
  return HUB_UPDATES.filter((u) => !u.companies || u.companies.some((c) => mine.has(c)));
}

function seenIds(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(key(userId)) || "[]")); } catch { return new Set(); }
}
function markSeen(userId, ids) {
  const s = seenIds(userId);
  for (const id of ids) s.add(id);
  try { localStorage.setItem(key(userId), JSON.stringify([...s])); } catch { /* private mode */ }
}

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function renderList(list) {
  return list.map((u) => `
    <article class="upd-item">
      <p class="upd-date">${escHtml(u.date)}</p>
      <h3>${escHtml(u.title)}</h3>
      <ul>${u.items.map((i) => `<li>${escHtml(i)}</li>`).join("")}</ul>
    </article>`).join("");
}

/**
 * Call after sign-in. Opens the dialog with the unread updates (if any) and wires the "Šta je novo" link,
 * which always shows the latest notes again.
 */
export function setupUpdates({ userId, companies }) {
  const dlg = document.getElementById("upd-modal");
  const body = document.getElementById("upd-body");
  const link = document.getElementById("upd-open");
  if (!dlg || !body) return;
  const all = updatesFor(companies);
  const open = (list, unread) => {
    body.innerHTML = list.length ? renderList(list) : '<p class="muted">Nema novih obavijesti.</p>';
    dlg.dataset.ids = JSON.stringify(list.map((u) => u.id));
    document.getElementById("upd-title").textContent = unread ? "Novo u TADEX Hubu" : "Šta je novo";
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
  };
  if (!dlg.dataset.wired) {
    dlg.dataset.wired = "1";
    const close = () => {
      try { markSeen(dlg.dataset.user, JSON.parse(dlg.dataset.ids || "[]")); } catch { /* ignore */ }
      dlg.close ? dlg.close() : dlg.removeAttribute("open");
      if (link) link.classList.remove("has-new");
    };
    document.getElementById("upd-ok").addEventListener("click", close);
    document.getElementById("upd-close").addEventListener("click", close);
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    if (link) link.addEventListener("click", (e) => {
      e.preventDefault();
      open(updatesFor(JSON.parse(dlg.dataset.companies || "[]")).slice(0, 6), false);
    });
  }
  dlg.dataset.user = userId || "";
  dlg.dataset.companies = JSON.stringify(companies || []);
  const seen = seenIds(userId);
  const unread = all.filter((u) => !seen.has(u.id));
  if (link) { link.hidden = all.length === 0; link.classList.toggle("has-new", unread.length > 0); }
  if (unread.length && !dlg.open) open(unread, true);
}
