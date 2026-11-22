// Video vodič: the team video of the whole TADEX Hub, with chapters (signed-in hub members), plus a
// "Vodič za direktora" for Direktors and Admins. The director video shows real client data, so it is
// NOT a public file: it lives in the private Supabase Storage bucket "vodic-direktor" (read policy =
// public.is_hub_direktor()) and is played through a short-lived signed URL.
import { getSession, signOut, startHeartbeat, hubDb, previewMode } from "/auth.js";

const DIREKTOR_BUCKET = "vodic-direktor";
const DIREKTOR_FILE = "tadex-hub-vodic-direktor.mp4";
const DIREKTOR_PDF = "Prirucnik-za-direktora.pdf";
const DIREKTOR_CHAPTERS = [
  { at: 0, title: "Uvod – tvoj Hub", text: "Šta direktor vidi i prekidač TADEX / STRONG / RUYI." },
  { at: 22.7, title: "Kalkulator", text: "Kurs, formula, artikli i carina po stavci." },
  { at: 48.5, title: "Povijest kalkulacija", text: "Moj tim i Svi, pretraga, otvaranje u kalkulatoru." },
  { at: 68.7, title: "CRM i predračun", text: "Svi klijenti, dodjela kolegi, način plaćanja, odobravanje predračuna." },
  { at: 104.6, title: "Pošiljke i fascikla", text: "Status, kamion, slobodni dani i dokumenti." },
  { at: 118.8, title: "Ture i Flota", text: "Troškovi vožnje i vozni park." },
  { at: 128.8, title: "Plan: knjigovodstvo u Hubu", text: "Stvarni prihodi, troškovi i uplate po klijentu, pošiljci i mjesecu." },
  { at: 148.4, title: "STRONG – u izradi", text: "Katalog, zalihe, predračun s PDV-om, garantni list." },
  { at: 186.8, title: "RUYI maloprodaja – plan", text: "Kolegice dodaju proizvode, mi radimo marketing i shopove." },
  { at: 217.8, title: "Kraj", text: "Gdje ponovo naći vodič." },
];

/** Admin, or Direktor in any hub app. */
function isDirektor(profile) {
  if (!profile) return false;
  if (profile.is_admin) return true;
  const roles = profile.app_roles && typeof profile.app_roles === "object" ? Object.values(profile.app_roles) : [];
  return roles.includes("direktor");
}

const CHAPTERS = [
  { at: 0, title: "Prijava i jezik", text: "Prijava, zahtjev za račun, zaboravljena lozinka, promjena jezika." },
  { at: 46.5, title: "Početna stranica", text: "Tvoje aplikacije i povratak na TADEX Hub." },
  { at: 91.3, title: "Kalkulator", text: "Kurs, prijevoz, artikli, VPC i MPC, Spremi kalkulaciju." },
  { at: 171.9, title: "Povijest kalkulacija", text: "Pretraga, predmeti i Otvori u kalkulatoru." },
  { at: 211.7, title: "CRM i predračun", text: "Novi klijent, nacrt iz kalkulatora, predračun i odobrenje." },
  { at: 299.6, title: "Pošiljke i fascikla", text: "Status, kamion, slobodni dani i dokumenti pošiljke." },
  { at: 390.4, title: "Ture i Flota", text: "Troškovi vožnje i vozni park." },
];

const app = document.querySelector("#app");
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function goLogin() {
  location.replace("/?next=" + encodeURIComponent(location.pathname + location.search));
}

const VIDEOS = {
  tim: {
    eyebrow: "Za cijeli tim",
    title: "Video vodič kroz TADEX Hub",
    lead: "Jedan video, oko 7,5 minuta: od prijave do isporuke. Uključi zvuk. Klikni poglavlje da skočiš na taj dio.",
    poster: "/vodic/video/poster.jpg",
    chapters: CHAPTERS,
    src: async () => "/vodic/video/tadex-hub-vodic.mp4?v=2",
  },
  direktor: {
    eyebrow: "Samo za direktore",
    title: "Vodič za direktora",
    lead: "Oko 4 minute: šta direktor vidi i odobrava u Hubu, plan za knjigovodstvo, te STRONG i RUYI koji su u izradi. Video prikazuje prave podatke, zato ga vide samo direktori. Uključi zvuk.",
    poster: "/vodic/video/poster-direktor.jpg",
    chapters: DIREKTOR_CHAPTERS,
    src: async () => {
      const db = await hubDb();
      const { data, error } = await db.storage.from(DIREKTOR_BUCKET).createSignedUrl(DIREKTOR_FILE, 4 * 3600);
      if (error || !data) throw new Error("Video se nije učitao. Osvježi stranicu ili se ponovo prijavi.");
      return data.signedUrl;
    },
    pdf: async () => {
      const db = await hubDb();
      const { data, error } = await db.storage.from(DIREKTOR_BUCKET).createSignedUrl(DIREKTOR_PDF, 3600, { download: DIREKTOR_PDF });
      if (error || !data) throw new Error("Priručnik se nije otvorio. Osvježi stranicu ili se ponovo prijavi.");
      return data.signedUrl;
    },
  },
};

function render(kind, canDirektor) {
  const v = VIDEOS[kind];
  const CHAPTERS = v.chapters;
  app.innerHTML = `
    ${canDirektor ? `<nav class="vtabs" aria-label="Izbor videa">
      <a href="?v=tim" class="vtab${kind === "tim" ? " on" : ""}">Za cijeli tim</a>
      <a href="?v=direktor" class="vtab${kind === "direktor" ? " on" : ""}">Vodič za direktora</a>
    </nav>` : ""}
    <section class="intro">
      <p class="eyebrow">${v.eyebrow}</p>
      <h1>${v.title}</h1>
      <p class="lead">${v.lead}</p>
    </section>
    ${v.pdf ? `<section class="manual">
      <div><p class="t">Priručnik za direktora (PDF)</p><p class="d">Sve funkcije korak po korak, sa slikama ekrana. 23 stranice. Samo za internu upotrebu.</p></div>
      <button type="button" id="manual-dl" class="manual-btn">Preuzmi PDF</button>
    </section>` : ""}
    <section class="player">
      <video id="video" controls preload="metadata" playsinline poster="${v.poster}">
        Tvoj preglednik ne može prikazati video.
      </video>
      <p class="now" id="now">${CHAPTERS[0].title}</p>
    </section>
    <section class="chapters">
      <h2>Poglavlja</h2>
      <ol id="list">
        ${CHAPTERS.map((c, i) => `
          <li><button type="button" data-i="${i}" class="chapter">
            <span class="n">${i + 1}</span>
            <span class="body"><span class="t">${c.title}</span><span class="d">${c.text}</span></span>
            <span class="time">${fmt(c.at)}</span>
          </button></li>`).join("")}
      </ol>
    </section>`;
  const video = document.querySelector("#video");
  document.querySelector("#manual-dl")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try { location.href = await v.pdf(); }
    catch (err) { btn.textContent = err.message; }
    finally { setTimeout(() => { btn.disabled = false; }, 1500); }
  });
  v.src().then((url) => {
    const source = document.createElement("source");
    source.src = url;
    source.type = "video/mp4";
    video.appendChild(source);
    video.load();
  }).catch((err) => { document.querySelector("#now").textContent = err.message; });
  const now = document.querySelector("#now");
  const buttons = [...document.querySelectorAll(".chapter")];
  const current = () => {
    let k = 0;
    CHAPTERS.forEach((c, i) => { if (video.currentTime + 0.25 >= c.at) k = i; });
    return k;
  };
  const mark = () => {
    const k = current();
    buttons.forEach((b, i) => b.classList.toggle("on", i === k));
    now.textContent = `${k + 1}. ${CHAPTERS[k].title}`;
  };
  buttons.forEach((b) => b.addEventListener("click", () => {
    video.currentTime = CHAPTERS[Number(b.dataset.i)].at + 0.05;
    video.play().catch(() => {});
    mark();
    document.querySelector(".player").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  video.addEventListener("timeupdate", mark);
  mark();
}

async function boot() {
  let session = null;
  try { session = await getSession(); }
  catch (error) {
    if (error && error.code !== "pending" && error.code !== "not_connected") {
      app.textContent = error.message || "Prijava nije uspjela.";
      return;
    }
  }
  if (!session) { goLogin(); return; }
  startHeartbeat("hub");
  try { localStorage.setItem("hub-vodic-seen:" + session.user.id, "1"); } catch { /* private mode */ }
  const who = document.querySelector("#who");
  if (who) who.textContent = session.profile.full_name || session.user.email;
  document.querySelector("#signout")?.addEventListener("click", async () => { await signOut(); location.href = "/"; });
  const canDirektor = isDirektor(session.profile) && !previewMode;
  const wanted = new URLSearchParams(location.search).get("v");
  render(wanted === "direktor" && canDirektor ? "direktor" : "tim", canDirektor);
}

boot();
