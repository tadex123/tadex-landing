// Yiwu -> Bosnia and Herzegovina goods-route animation for the hub hero.
// Lightweight canvas: the dot map is pre-rendered once per resize; only arcs and particles animate.
// Pauses when off-screen or the tab is hidden; draws one static frame for prefers-reduced-motion.
const LANDS = [
  [[-9,37],[-9,43],[-1,46],[-4,48],[2,51],[8,54],[10,57],[5,60],[10,63],[15,68],[25,71],[40,68],[60,70],[80,73],[100,76],[130,72],[160,70],[170,65],[160,60],[155,57],[140,54],[135,44],[129,35],[126,38],[122,40],[118,38],[122,31],[121,28],[117,23],[110,20],[108,16],[109,11],[105,9],[100,13],[103,2],[98,8],[98,16],[92,21],[88,22],[80,15],[77,8],[73,17],[67,24],[57,25],[56,27],[52,24],[56,18],[52,15],[44,12],[40,20],[35,28],[33,31],[35,36],[27,37],[26,41],[23,37],[20,39],[19,42],[13,46],[12,44],[16,40],[18,40],[15,38],[10,44],[3,43],[0,39],[-5,36]],
  [[-17,15],[-17,21],[-10,30],[-5,36],[10,37],[11,33],[20,31],[32,31],[34,28],[43,12],[51,12],[42,-2],[9,-2],[9,4],[-8,4]],
  [[-5,50],[1,51],[2,53],[-2,56],[-3,58.6],[-6,58],[-5,55],[-3,54],[-5,52]],
  [[130,31],[135,34],[140,35],[141,41],[140,43],[145,44],[141,45],[139,38],[133,35]],
];
const ORIGIN = { name: "Yiwu 义乌", lon: 120.07, lat: 29.3 };
const CITIES = [
  { name: "Sarajevo", lon: 18.41, lat: 43.86, main: true },
  { name: "Mostar", lon: 17.81, lat: 43.34 },
  { name: "Banja Luka", lon: 17.19, lat: 44.77 },
  { name: "Tuzla", lon: 18.67, lat: 44.54 },
  { name: "Zenica", lon: 17.91, lat: 44.2 },
  { name: "Bihać", lon: 15.87, lat: 44.82 },
];

function inside([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const bez = (a, c, e, t) => { const u = 1 - t; return [u*u*a[0] + 2*u*t*c[0] + t*t*e[0], u*u*a[1] + 2*u*t*c[1] + t*t*e[1]]; };

export function mountRoute(canvas) {
  if (!canvas || !canvas.getContext) return;
  const cx = canvas.getContext("2d");
  const reduce = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  let W = 0, H = 0, dpr = 1, dots = null, A, arcs = [], raf = 0, visible = true, t0 = performance.now();

  function layout() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    // Fit lon 8..128 / lat 18..54; keep a roughly sane aspect by widening the shorter axis.
    let v = { l0: 6, l1: 128, t: 56, b: 16 };
    const want = (v.l1 - v.l0) / (v.t - v.b) * 0.8, have = W / H;
    if (have > want) { const ext = ((v.t - v.b) * 0.8 * have - (v.l1 - v.l0)) / 2; v.l0 -= ext; v.l1 += ext; }
    else { const ext = ((v.l1 - v.l0) / (0.8 * have) - (v.t - v.b)) / 2; v.t += ext; v.b -= ext; }
    const P = (lon, lat) => [(lon - v.l0) / (v.l1 - v.l0) * W, (v.t - lat) / (v.t - v.b) * H];
    // Pre-render the dot map.
    dots = document.createElement("canvas"); dots.width = W * dpr; dots.height = H * dpr;
    const d = dots.getContext("2d"); d.scale(dpr, dpr); d.fillStyle = "rgba(255,255,255,.28)";
    const step = Math.max(1.1, (v.l1 - v.l0) / (W / 7));
    for (let lat = v.t; lat > v.b; lat -= step) for (let lon = v.l0; lon < v.l1; lon += step) {
      if (LANDS.some(p => inside([lon, lat], p))) { const [x, y] = P(lon, lat); d.beginPath(); d.arc(x, y, W < 500 ? 1 : 1.25, 0, 7); d.fill(); }
    }
    A = P(ORIGIN.lon, ORIGIN.lat);
    arcs = CITIES.map((c, i) => {
      const E = P(c.lon, c.lat);
      const lift = Math.hypot(E[0] - A[0], E[1] - A[1]) * (0.26 + i * 0.03);
      // Keep the curve's peak (≈ (A+E)/4 + C/2) inside the canvas, with a little headroom per arc.
      const minC = 2 * (14 + i * 7) - (A[1] + E[1]) / 2;
      return { c, E, C: [(A[0] + E[0]) / 2, Math.max(minC, Math.min(A[1], E[1]) - lift)], delay: i * 260, phase: i / CITIES.length };
    });
  }

  function frame(now) {
    const T = reduce.matches ? 1e9 : now - t0;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    cx.drawImage(dots, 0, 0, W, H);
    for (const a of arcs) {
      const grow = Math.min(1, Math.max(0, (T - a.delay) / 1400));
      if (grow <= 0) continue;
      cx.save();
      cx.lineWidth = a.c.main ? 2 : 1.1;
      cx.strokeStyle = a.c.main ? "rgba(255,255,255,.95)" : "rgba(232,246,253,.55)";
      cx.shadowColor = "rgba(143,211,245,.9)"; cx.shadowBlur = a.c.main ? 10 : 4;
      cx.beginPath();
      const n = Math.ceil(48 * grow);
      for (let i = 0; i <= n; i++) { const p = bez(A, a.C, a.E, Math.min(grow, i / 48)); i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }
      cx.stroke();
      if (grow === 1) {
        const k = a.c.main ? 3 : 1, period = a.c.main ? 3200 : 4600;
        cx.fillStyle = "#fff"; cx.shadowColor = "#fff"; cx.shadowBlur = 12;
        for (let j = 0; j < k; j++) {
          const s = reduce.matches ? (0.35 + j * 0.25) % 1 : ((T / period) + a.phase + j / k) % 1;
          const p = bez(A, a.C, a.E, s);
          cx.beginPath(); cx.arc(p[0], p[1], a.c.main ? 2.6 : 1.8, 0, 7); cx.fill();
        }
      }
      cx.restore();
      if (grow === 1) {
        if (!reduce.matches) {
          const pu = ((T / 1600) + a.phase) % 1;
          cx.strokeStyle = `rgba(255,255,255,${(1 - pu) * .8})`; cx.lineWidth = 1;
          cx.beginPath(); cx.arc(a.E[0], a.E[1], 2 + pu * (a.c.main ? 12 : 7), 0, 7); cx.stroke();
        }
        cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(a.E[0], a.E[1], a.c.main ? 3.2 : 2, 0, 7); cx.fill();
      }
    }
    // Labels: Sarajevo + Yiwu always; other BiH cities only when there is room.
    cx.font = "700 12px Inter, system-ui, sans-serif"; cx.fillStyle = "#fff";
    cx.shadowColor = "rgba(14,76,128,.6)"; cx.shadowBlur = 4;
    const sa = arcs[0]; if (sa) cx.fillText("Sarajevo", sa.E[0] + 8, sa.E[1] + 16);
    if (W > 820) {
      cx.font = "600 10px Inter, system-ui, sans-serif"; cx.fillStyle = "rgba(255,255,255,.8)";
      const off = { "Banja Luka": [-58, -6], "Tuzla": [8, -5], "Mostar": [-42, 12] };
      for (const a of arcs) { const o = off[a.c.name]; if (o) cx.fillText(a.c.name, a.E[0] + o[0], a.E[1] + o[1]); }
    }
    cx.shadowBlur = 0;
    const pu = reduce.matches ? 0.5 : (T / 1300) % 1;
    cx.strokeStyle = `rgba(255,255,255,${1 - pu})`; cx.lineWidth = 1.4;
    cx.beginPath(); cx.arc(A[0], A[1], 5 + pu * 20, 0, 7); cx.stroke();
    cx.fillStyle = "#fff"; cx.shadowColor = "#fff"; cx.shadowBlur = 14;
    cx.beginPath(); cx.arc(A[0], A[1], 4.5, 0, 7); cx.fill();
    cx.shadowColor = "rgba(14,76,128,.6)"; cx.shadowBlur = 4;
    cx.font = "700 12px Inter, system-ui, sans-serif";
    const right = A[0] > W - 80;
    cx.textAlign = right ? "right" : "left";
    cx.fillText(ORIGIN.name, A[0] + (right ? -10 : 10), A[1] + (right ? 20 : 4));
    cx.textAlign = "left"; cx.shadowBlur = 0;
  }

  function loop(now) { raf = 0; if (!visible || document.hidden || reduce.matches) return; frame(now); raf = requestAnimationFrame(loop); }
  function start() { if (reduce.matches) { frame(performance.now()); return; } if (!raf) raf = requestAnimationFrame(loop); }
  function redraw() { layout(); if (reduce.matches || !raf) frame(performance.now()); start(); }

  redraw();
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(redraw, 150); });
  if ("ResizeObserver" in window) new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(redraw, 150); }).observe(canvas);
  // Start the draw-in the first time the strip is actually on screen (it can sit below the fold).
  let seen = false;
  if ("IntersectionObserver" in window) new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (visible && !seen && es[0].boundingClientRect.width > 2) { seen = true; t0 = performance.now(); }
    if (visible) start();
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) start(); });
  if (reduce.addEventListener) reduce.addEventListener("change", redraw);
}
