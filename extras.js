// Home-page extras: "Misao dana / Thought of the day" and the Yiwu -> BiH route animation.
// Independent of app.js (auth/apps/admin); failures here never affect sign-in.
import { thoughtOfTheDay } from "./thoughts.js";
import { mountRoute } from "./route.js";

function renderThought() {
  const t = thoughtOfTheDay();
  const bs = document.getElementById("thought-bs"), en = document.getElementById("thought-en");
  if (!bs || !en) return;
  bs.textContent = t.bs; en.textContent = t.en;
  document.getElementById("thought").dataset.day = String(t.day);
}

try { renderThought(); } catch (e) { console.warn("thought", e); }
// Refresh after local midnight if the tab stays open.
setInterval(() => { try { renderThought(); } catch {} }, 10 * 60 * 1000);
try { mountRoute(document.getElementById("route-canvas")); } catch (e) { console.warn("route", e); }
