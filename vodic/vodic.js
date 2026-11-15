// Video vodič: one video of the whole TADEX Hub, with chapters. Signed-in hub members only.
import { getSession, signOut, startHeartbeat } from "/auth.js";

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

function render() {
  app.innerHTML = `
    <section class="intro">
      <p class="eyebrow">Za cijeli tim</p>
      <h1>Video vodič kroz TADEX Hub</h1>
      <p class="lead">Jedan video, oko 7,5 minuta: od prijave do isporuke. Uključi zvuk. Klikni poglavlje da skočiš na taj dio.</p>
    </section>
    <section class="player">
      <video id="video" controls preload="metadata" playsinline poster="/vodic/video/poster.jpg">
        <source src="/vodic/video/tadex-hub-vodic.mp4" type="video/mp4">
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
  const who = document.querySelector("#who");
  if (who) who.textContent = session.profile.full_name || session.user.email;
  document.querySelector("#signout")?.addEventListener("click", async () => { await signOut(); location.href = "/"; });
  render();
}

boot();
