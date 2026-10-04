// Goods route for the hub hero: Yiwu/Ningbo -> by sea -> Ploče or Rijeka (Adriatic) -> Bosnia and Herzegovina.
// One canvas, full-width band:
//   background  : stylized world map (Natural Earth 110m land, see world-lite.js), two sea lanes
//                 (Suez: Malacca - Indian Ocean - Red Sea - Suez - Mediterranean - Adriatic, and the
//                 alternative around the Cape of Good Hope and through Gibraltar), port labels
//   animated    : ship dots sailing both lanes, the glowing Yiwu -> BiH arcs on top, and a BiH inset with
//                 the land legs from Ploče and Rijeka to Sarajevo, Mostar, Banja Luka, Tuzla, Zenica, Bihać.
// Static layers are pre-rendered once per resize; only ships/arcs/pulses animate. Pauses off-screen and in
// hidden tabs; one static frame for prefers-reduced-motion.
import { LAND, BIH, ADRIATIC } from "./world-lite.js";

const parse = s => s.split(" ").map(p => p.split(",").map(Number));
// world-lite stores the Afro-Eurasian ring in 0..360° longitude (so Chukotka stays continuous past 180°);
// fold its western part (> 300°, i.e. West Africa / Iberia / Britain) back to negative longitudes.
// Antarctica (all below 55°S) is outside the view and dropped.
const LANDS = LAND.map(parse).filter(r => r.some(p => p[1] > -55)).map(r => r.map(([x, y]) => [x > 300 ? x - 360 : x, y]));
const BIH_RING = parse(BIH);
const ADRIA = ADRIATIC.map(parse);

const ORIGIN = { name: "Yiwu 义乌", lon: 120.07, lat: 29.3 };
const NINGBO = { lon: 121.55, lat: 29.87 };
const PLOCE = { lon: 17.43, lat: 43.05 };
const RIJEKA = { lon: 14.44, lat: 45.33 };
const CITIES = [
  { name: "Sarajevo", lon: 18.41, lat: 43.86, main: true },
  { name: "Mostar", lon: 17.81, lat: 43.34 },
  { name: "Banja Luka", lon: 17.19, lat: 44.77 },
  { name: "Tuzla", lon: 18.67, lat: 44.54 },
  { name: "Zenica", lon: 17.91, lat: 44.2 },
  { name: "Bihać", lon: 15.87, lat: 44.82 },
];
// Sea lanes as [lon, lat] waypoints (simplified, but following the real corridors).
const ASIA_LEG = [[121.9,29.8],[123,28],[121.5,25],[118.5,21.8],[114.5,18.5],[110.5,13],[107.5,7],[105,2.6],[103.9,1.2],[101.5,2.6],[99,5.4],[96,6.4]];
const SUEZ = [...ASIA_LEG,[91,6],[85,5.6],[80.5,5.4],[76,7.2],[68,10.5],[60,12.6],[52,13],[47,12.3],[43.5,12.6],[42,14.8],[40,17.8],[38,21],[36.4,23.8],[34.6,26.6],[33.4,28.4],[32.55,29.95],
  [32.35,31.4],[30,32.6],[26,33.6],[22,34.6],[20,36.6],[19.1,38.9],[18.95,40.2],[18,41.3],[17.1,42.1],[16.9,42.75],[17.43,43.05]];
const CAPE = [...ASIA_LEG,[92,2],[84,-4],[74,-12],[62,-22],[50,-30],[38,-34.8],[27,-36],[20,-35.6],[17,-34.6],[13.5,-30],[10.5,-22],[9,-13],[6.5,-4],[2,1.8],[-6,2.8],[-13,6.5],[-18.5,13.5],
  [-19,21],[-14.5,28],[-10,33.5],[-6.8,35.9],[-3,36.1],[1.5,37.3],[6,38],[8.6,37.9],[11.2,37.35],[12.6,36.6],[15.6,36.3],[18.4,37.8],[19.1,38.9],[18.95,40.2],[18,41.3],[17.1,42.1],[16.9,42.75],[17.43,43.05]];
// Adriatic split: from the lane point off the Pelješac/Vis area, one branch to Ploče (end of SUEZ/CAPE),
// one up the Kvarner channel to Rijeka.
const SPLIT = [17.1, 42.1];
// open Adriatic -> west of Dugi otok and Lošinj -> Vela Vrata (Istria/Cres) -> Rijeka
const TO_RIJEKA = [[16.3,42.5],[15.3,43.1],[14.4,43.85],[13.95,44.45],[14.05,44.9],[14.25,45.13],[14.44,45.32]];
const toRijeka = lane => { const i = lane.findIndex(p => p[0] === SPLIT[0] && p[1] === SPLIT[1]); return { pts: [...lane.slice(0, i + 1), ...TO_RIJEKA], from: i }; };
const SUEZ_R = toRijeka(SUEZ), CAPE_R = toRijeka(CAPE);
const PORTS = [
  { name: "Ningbo", lon: 121.55, lat: 29.87, dx: 8, dy: 14, sdx: -16, sdy: 20 },
  { name: "Suez", lon: 32.55, lat: 29.95, dx: -34, dy: 4 },
  { name: "Rt dobre nade · Cape of Good Hope", short: "Cape of Good Hope", lon: 18.47, lat: -34.36, dx: -8, dy: 18, right: true },
  { name: "Ploče", lon: 17.43, lat: 43.05, dx: -34, dy: 12, hideSmall: true },
  { name: "Rijeka", short: "Rijeka · Ploče", lon: 14.44, lat: 45.33, dx: -44, dy: -5, sdx: -78, sdy: 4 },
];

const bez = (a, c, e, t) => { const u = 1 - t; return [u*u*a[0] + 2*u*t*c[0] + t*t*e[0], u*u*a[1] + 2*u*t*c[1] + t*t*e[1]]; };
function polyline(points) {
  const len = [0];
  for (let i = 1; i < points.length; i++) len.push(len[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return { points, len, total: len[len.length - 1] };
}
function along(pl, f) {
  const d = f * pl.total; let i = 1;
  while (i < pl.len.length - 1 && pl.len[i] < d) i++;
  const a = pl.points[i - 1], b = pl.points[i], seg = pl.len[i] - pl.len[i - 1] || 1, t = (d - pl.len[i - 1]) / seg;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
}
function path(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); }

export function mountRoute(canvas) {
  if (!canvas || !canvas.getContext) return;
  const cx = canvas.getContext("2d");
  const reduce = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  let W = 0, H = 0, dpr = 1, bg = null, inset = null, P, A, arcs = [], lanes = [], legs = [], raf = 0, visible = true, t0 = performance.now(), small = false, IB = null;

  function layout() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    small = W < 640;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    // Equirectangular with a slight vertical stretch; fit lon -22..128 and lat -40..52, centered on the lanes.
    const K = 1.15, s = Math.min(H / (92 * K), W / 150), c0 = 53, c1 = 6;
    P = (lon, lat) => [W / 2 + (lon - c0) * s, H / 2 + (c1 - lat) * s * K];

    // ----- static background -----
    bg = document.createElement("canvas"); bg.width = W * dpr; bg.height = H * dpr;
    const g = bg.getContext("2d"); g.scale(dpr, dpr);
    // graticule
    g.strokeStyle = "rgba(255,255,255,.06)"; g.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 20) { const a = P(lon, 80), b = P(lon, -60); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    for (let lat = -60; lat <= 80; lat += 20) { const a = P(-180, lat), b = P(180, lat); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    // land silhouette
    g.fillStyle = "rgba(232,246,253,.16)"; g.strokeStyle = "rgba(255,255,255,.34)"; g.lineWidth = 0.8; g.lineJoin = "round";
    for (const ring of LANDS) { path(g, ring.map(([x, y]) => P(x, y))); g.closePath(); g.fill(); g.stroke(); }
    // sea lanes
    lanes = [
      { pl: polyline(SUEZ.map(([x, y]) => P(x, y))), main: true, ships: 3, period: 52000, from: 0 },
      { pl: polyline(SUEZ_R.pts.map(([x, y]) => P(x, y))), main: true, ships: 2, period: 54000, from: SUEZ_R.from, off: 0.17 },
      { pl: polyline(CAPE.map(([x, y]) => P(x, y))), main: false, ships: 2, period: 90000, from: 0 },
      { pl: polyline(CAPE_R.pts.map(([x, y]) => P(x, y))), main: false, ships: 1, period: 94000, from: CAPE_R.from, off: 0.25 },
    ];
    g.lineCap = "round";
    for (const l of lanes) {
      g.setLineDash(l.main ? [] : [5, 6]);
      g.strokeStyle = l.main ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.32)";
      g.lineWidth = l.main ? 1.6 : 1.2;
      path(g, l.pl.points.slice(l.from)); g.stroke();
    }
    g.setLineDash([]);
    // ports
    for (const p of PORTS) {
      const [x, y] = P(p.lon, p.lat);
      if (small && p.hideSmall) { g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); continue; }
      g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill();
      g.strokeStyle = "rgba(255,255,255,.45)"; g.beginPath(); g.arc(x, y, 5, 0, 7); g.stroke();
      g.font = `600 ${small ? 9 : 11}px Inter, system-ui, sans-serif`; g.fillStyle = "rgba(255,255,255,.72)";
      g.textAlign = p.right ? "left" : "left";
      const label = small && p.short ? p.short : p.name;
      g.fillText(label, x + (small && p.sdx != null ? p.sdx : p.dx), y + (small && p.sdy != null ? p.sdy : p.dy));
    }
    g.textAlign = "left";

    // ----- glowing arcs Yiwu -> BiH (existing look, on top) -----
    A = P(ORIGIN.lon, ORIGIN.lat);
    arcs = CITIES.map((c, i) => {
      const E = P(c.lon, c.lat);
      const lift = Math.hypot(E[0] - A[0], E[1] - A[1]) * (0.22 + i * 0.025);
      const minC = 2 * (16 + i * 6) - (A[1] + E[1]) / 2;
      return { c, E, C: [(A[0] + E[0]) / 2, Math.max(minC, Math.min(A[1], E[1]) - lift)], delay: i * 260, phase: i / CITIES.length };
    });

    // ----- BiH inset (bottom-right): Ploče + Rijeka -> cities land legs; wide enough to show the Croatian coast -----
    const iw = small ? Math.min(176, W * 0.46) : 340, ih = small ? 136 : 246, m = small ? 10 : 18;
    IB = { x: W - iw - m, y: H - ih - m, w: iw, h: ih };
    const L0 = 13.2, L1 = 20.0, T = 46.0, B = 42.35;
    const ks = Math.min((iw - 20) / (L1 - L0), (ih - 34) / ((T - B) * 1.35));
    const ox = IB.x + (iw - (L1 - L0) * ks) / 2, oy = IB.y + 26 + ((ih - 34) - (T - B) * 1.35 * ks) / 2;
    const Q = (lon, lat) => [ox + (lon - L0) * ks, oy + (T - lat) * 1.35 * ks];
    inset = document.createElement("canvas"); inset.width = W * dpr; inset.height = H * dpr;
    const n = inset.getContext("2d"); n.scale(dpr, dpr);
    n.fillStyle = "rgba(14,76,128,.6)"; n.strokeStyle = "rgba(255,255,255,.35)"; n.lineWidth = 1;
    n.beginPath(); n.roundRect ? n.roundRect(IB.x, IB.y, iw, ih, 14) : n.rect(IB.x, IB.y, iw, ih); n.fill(); n.stroke();
    n.save(); n.beginPath(); n.rect(IB.x + 1, IB.y + 22, iw - 2, ih - 23); n.clip();
    n.fillStyle = "rgba(232,246,253,.15)"; n.strokeStyle = "rgba(255,255,255,.34)"; n.lineWidth = .9;
    for (const ring of ADRIA) { path(n, ring.map(([x, y]) => Q(x, y))); n.closePath(); n.fill(); n.stroke(); }
    n.fillStyle = "rgba(255,255,255,.17)"; n.strokeStyle = "rgba(255,255,255,.8)"; n.lineWidth = 1.2;
    path(n, BIH_RING.map(([x, y]) => Q(x, y))); n.closePath(); n.fill(); n.stroke();
    // the two Adriatic sea approaches, so the ports read as ports
    n.strokeStyle = "rgba(255,255,255,.4)"; n.lineWidth = 1.2; n.setLineDash([3, 4]);
    path(n, [[18.6, 41.2], [17.6, 41.9], ...[[17.1,42.1],[16.9,42.75],[17.43,43.05]]].map(([x, y]) => Q(x, y))); n.stroke();
    path(n, [[17.1, 42.1], ...TO_RIJEKA].map(([x, y]) => Q(x, y))); n.stroke(); n.setLineDash([]);
    n.font = `italic 600 ${small ? 8 : 10}px Inter, system-ui, sans-serif`; n.fillStyle = "rgba(255,255,255,.45)";
    { const [x, y] = Q(15.0, 42.75); n.fillText(small ? "Jadran" : "Jadransko more", x, y); }
    n.restore();
    n.font = `700 ${small ? 9 : 10.5}px Inter, system-ui, sans-serif`; n.fillStyle = "rgba(255,255,255,.88)";
    n.fillText(small ? "Ploče · Rijeka → BiH" : "Ploče · Rijeka → Bosna i Hercegovina", IB.x + 10, IB.y + 16);
    const Pp = Q(PLOCE.lon, PLOCE.lat), Rp = Q(RIJEKA.lon, RIJEKA.lat);
    const leg = (S, c, i, port) => {
      const E = Q(c.lon, c.lat);
      const C = [(S[0] + E[0]) / 2 + (E[1] - S[1]) * 0.15, (S[1] + E[1]) / 2 - Math.abs(E[0] - S[0]) * 0.18 - 5];
      return { c, S, E, C, port, phase: i / CITIES.length + (port === "R" ? 0.5 : 0) };
    };
    // Rijeka lines are drawn a touch fainter, except to the north-west side (Bihać, Banja Luka) they naturally serve.
    legs = [...CITIES.map((c, i) => leg(Pp, c, i, "P")), ...CITIES.map((c, i) => leg(Rp, c, i, "R"))];
    IB.P = Pp; IB.R = Rp;
    // small marker of Ploče on the main map (the land legs are too short to read at world scale)
  }

  function frame(now) {
    const T = reduce.matches ? 1e9 : now - t0;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    cx.drawImage(bg, 0, 0, W, H);

    // ships
    for (const l of lanes) {
      for (let j = 0; j < l.ships; j++) {
        const o = l.off || 0, f = reduce.matches ? (0.15 + o + j / l.ships) % 1 : ((T / l.period) + o + j / l.ships) % 1;
        const [x, y] = along(l.pl, f);
        if (!reduce.matches) {
          cx.strokeStyle = l.main ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.22)"; cx.lineWidth = 2; cx.lineCap = "round";
          const [tx, ty] = along(l.pl, Math.max(0, f - 0.012)); cx.beginPath(); cx.moveTo(tx, ty); cx.lineTo(x, y); cx.stroke();
        }
        cx.save(); cx.fillStyle = "#fff"; cx.shadowColor = "rgba(255,255,255,.9)"; cx.shadowBlur = l.main ? 8 : 5;
        cx.beginPath(); cx.arc(x, y, l.main ? 2.6 : 2, 0, 7); cx.fill(); cx.restore();
      }
    }

    // glowing arcs Yiwu -> BiH
    for (const a of arcs) {
      const grow = Math.min(1, Math.max(0, (T - a.delay) / 1400));
      if (grow <= 0) continue;
      cx.save();
      cx.lineWidth = a.c.main ? 2 : 1.1;
      cx.strokeStyle = a.c.main ? "rgba(255,255,255,.95)" : "rgba(232,246,253,.5)";
      cx.shadowColor = "rgba(143,211,245,.9)"; cx.shadowBlur = a.c.main ? 10 : 4;
      cx.beginPath();
      const n = Math.ceil(48 * grow);
      for (let i = 0; i <= n; i++) { const p = bez(A, a.C, a.E, Math.min(grow, i / 48)); i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }
      cx.stroke();
      if (grow === 1) {
        const k = a.c.main ? 2 : 1, period = a.c.main ? 3600 : 5200;
        cx.fillStyle = "#fff"; cx.shadowColor = "#fff"; cx.shadowBlur = 12;
        for (let j = 0; j < k; j++) {
          const s = reduce.matches ? (0.35 + j * 0.3) % 1 : ((T / period) + a.phase + j / k) % 1;
          const p = bez(A, a.C, a.E, s);
          cx.beginPath(); cx.arc(p[0], p[1], a.c.main ? 2.4 : 1.6, 0, 7); cx.fill();
        }
      }
      cx.restore();
    }
    // BiH end point on the main map
    const sa = arcs[0];
    if (sa) {
      const pu = reduce.matches ? 0.5 : (T / 1600) % 1;
      cx.strokeStyle = `rgba(255,255,255,${(1 - pu) * .8})`; cx.lineWidth = 1;
      cx.beginPath(); cx.arc(sa.E[0], sa.E[1], 2 + pu * 12, 0, 7); cx.stroke();
      cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(sa.E[0], sa.E[1], 3, 0, 7); cx.fill();
      cx.font = "700 12px Inter, system-ui, sans-serif"; cx.shadowColor = "rgba(14,76,128,.6)"; cx.shadowBlur = 4;
      cx.fillText("BiH", sa.E[0] + 7, sa.E[1] - 6); cx.shadowBlur = 0;
    }
    // Yiwu origin + short land leg to Ningbo
    const N = P(NINGBO.lon, NINGBO.lat);
    cx.strokeStyle = "rgba(255,255,255,.8)"; cx.lineWidth = 1.4; cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(N[0], N[1]); cx.stroke();
    const pu = reduce.matches ? 0.5 : (T / 1300) % 1;
    cx.strokeStyle = `rgba(255,255,255,${1 - pu})`; cx.lineWidth = 1.4;
    cx.beginPath(); cx.arc(A[0], A[1], 5 + pu * 20, 0, 7); cx.stroke();
    cx.save(); cx.fillStyle = "#fff"; cx.shadowColor = "#fff"; cx.shadowBlur = 14;
    cx.beginPath(); cx.arc(A[0], A[1], 4.5, 0, 7); cx.fill(); cx.restore();
    cx.font = "700 12px Inter, system-ui, sans-serif"; cx.fillStyle = "#fff"; cx.shadowColor = "rgba(14,76,128,.6)"; cx.shadowBlur = 4;
    cx.textAlign = "right"; cx.fillText(ORIGIN.name, A[0] - 10, A[1] - 8); cx.textAlign = "left"; cx.shadowBlur = 0;

    // BiH inset with land legs from Ploče and Rijeka
    cx.drawImage(inset, 0, 0, W, H);
    const Pp = IB.P, Rp = IB.R;
    for (const l of legs) {
      const near = l.port === "P" || l.c.name === "Bihać" || l.c.name === "Banja Luka";
      const strong = l.c.main && l.port === "P";
      cx.save();
      cx.strokeStyle = strong ? "rgba(255,255,255,.95)" : near ? "rgba(232,246,253,.62)" : "rgba(232,246,253,.38)";
      cx.lineWidth = strong ? 1.8 : near ? 1.1 : 0.9;
      cx.shadowColor = "rgba(143,211,245,.9)"; cx.shadowBlur = strong ? 8 : 4;
      cx.beginPath();
      for (let i = 0; i <= 24; i++) { const p = bez(l.S, l.C, l.E, i / 24); i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }
      cx.stroke();
      const s = reduce.matches ? 0.6 : ((T / (l.port === "R" ? 3400 : 2600)) + l.phase) % 1;
      const p = bez(l.S, l.C, l.E, s);
      cx.fillStyle = "#fff"; cx.shadowColor = "#fff"; cx.shadowBlur = 8; cx.beginPath(); cx.arc(p[0], p[1], near ? 1.6 : 1.3, 0, 7); cx.fill();
      cx.restore();
    }
    for (const l of legs) if (l.port === "P") { cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(l.E[0], l.E[1], l.c.main ? 2.8 : 1.9, 0, 7); cx.fill(); }
    for (const q of [Pp, Rp]) {
      cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(q[0], q[1], 3, 0, 7); cx.fill();
      cx.strokeStyle = "rgba(255,255,255,.6)"; cx.lineWidth = 1; cx.beginPath(); cx.arc(q[0], q[1], 5.5, 0, 7); cx.stroke();
    }
    cx.font = `600 ${small ? 8.5 : 10.5}px Inter, system-ui, sans-serif`; cx.fillStyle = "rgba(255,255,255,.92)";
    cx.shadowColor = "rgba(14,76,128,.8)"; cx.shadowBlur = 3;
    const off = small
      ? { "Sarajevo": [5, 9], "Banja Luka": [-2, -6], "Tuzla": [5, -3] }
      : { "Sarajevo": [6, 11], "Mostar": [7, 9], "Banja Luka": [-22, -8], "Tuzla": [6, -4], "Zenica": [7, 4], "Bihać": [-10, -8] };
    for (const l of legs) { if (l.port !== "P") continue; const o = off[l.c.name]; if (o) cx.fillText(l.c.name, l.E[0] + o[0], l.E[1] + o[1]); }
    cx.font = `700 ${small ? 9 : 11}px Inter, system-ui, sans-serif`; cx.fillStyle = "#fff";
    cx.fillText("Ploče", Pp[0] - (small ? 30 : 36), Pp[1] + (small ? 4 : 5));
    cx.fillText("Rijeka", Rp[0] - (small ? 16 : 18), Rp[1] - 9);
    cx.shadowBlur = 0;
  }

  function loop(now) { raf = 0; if (!visible || document.hidden || reduce.matches) return; frame(now); raf = requestAnimationFrame(loop); }
  function start() { if (reduce.matches) { frame(performance.now()); return; } if (!raf) raf = requestAnimationFrame(loop); }
  function redraw() { layout(); if (reduce.matches || !raf) frame(performance.now()); start(); }

  redraw();
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(redraw, 150); });
  if ("ResizeObserver" in window) new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(redraw, 150); }).observe(canvas);
  // Start the draw-in the first time the band is actually on screen (it can sit below the fold).
  let seen = false;
  if ("IntersectionObserver" in window) new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (visible && !seen && es[0].boundingClientRect.width > 2) { seen = true; t0 = performance.now(); }
    if (visible) start();
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) start(); });
  if (reduce.addEventListener) reduce.addEventListener("change", redraw);
}
