"use strict";

/* ======================================================================
   Modul „sky“ – Sternenhimmel: eine sichere Route von der Erde zum Heimatplaneten planen
   Ein Sternenhimmel aus mehreren Schichten (vorne bewegen sich die Sterne schneller, hinten langsamer – das
   ergibt beim seitlichen Wischen den Eindruck von Tiefe). Links liegt die ERDE (Start), rechts der HEIMATPLANET
   der Aliens (Ziel); an beiden Enden ist die Strecke begrenzt. Dazwischen sind Asteroiden und Kometen zufällig
   verstreut – es gibt immer mindestens einen freien Weg.
   Aufgabe: eine Route von der Erde zum Heimatplaneten malen.
     - Das Raumschiff fliegt nur nach rechts, nie zurück (die Linie folgt dem Finger nur vorwärts).
     - Berührt die Linie ein Hindernis, bricht sie ab; „RÜCKGÄNGIG“ nimmt die letzten Meter zurück.
     - Die Route beginnt bei der Erde und lässt sich nur an ihrer leuchtenden Spitze weitermalen.
     - Am Ziel startet „SIMULATION STARTEN“ einen Probeflug (die Aliens fliegen noch nicht wirklich los).
   „NOCH EINMAL“ erzeugt eine neue Strecke für die Nächsten.
   Betriebsarten: FLIEGEN (Himmel bewegen: wischen, Pfeiltasten, Mausrad) und MALEN (Route zeichnen).
   Beim Malen scrollt der Himmel von selbst mit, sobald der Finger in das linke oder rechte Drittel kommt.
   Welt-Einheiten: die Bildschirmhöhe entspricht 1000 Einheiten, dadurch ist die Strecke auf jedem Gerät gleich.
   Felder: backTo, trackLength (Länge in Einheiten), gap (freie Breite des garantierten Wegs), density (Dichte
   der Hindernisse 0–1), shipRadius, undoLength, seed
   ====================================================================== */
registerModule("sky", (ctx) => {
  const S = ctx.step;
  const TRACK = S.trackLength ?? 6000;
  const GAP = S.gap ?? 200;
  const DENSITY = S.density ?? 0.3;
  const SHIP_R = S.shipRadius ?? 14;
  const UNDO_LEN = S.undoLength ?? 160;
  const START_X = 120, START_ZONE = 260;     // Start bei der Erde: die Route muss links von 260 beginnen
  const GOAL_X = TRACK - 60;                 // Ziel: der Rand des Heimatplaneten
  const WORLD_H = 1000;
  const EARTH = { x: -170, y: 520, r: 360 };
  const HOME = { x: TRACK + 170, y: 480, r: 360 };
  const CAM_MIN = -150;

  /* ----- Oberfläche ----- */
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Sternenhimmel");
  const hint = h("div", "sky-hint");
  hint.setAttribute("role", "status");
  const topParts = [];
  if (S.backTo) {
    const back = h("button", "back", "‹ ZURÜCK");
    back.type = "button";
    back.addEventListener("click", () => ctx.goToId(S.backTo));
    topParts.push(back);
  }
  topParts.push(hint);
  const topEl = h("div", "sky-top", "", topParts);

  const mk = (cls, label) => { const b = h("button", cls, label); b.type = "button"; return b; };
  const flyBtn = mk("", "FLIEGEN"), drawBtn = mk("", "MALEN");
  const modeBar = h("div", "sky-mode", "", [flyBtn, drawBtn]);
  const undoBtn = mk("ghost", "↶ RÜCKGÄNGIG");
  const clearBtn = mk("ghost", "LÖSCHEN");
  const sendBtn = mk("go", "SIMULATION STARTEN");
  const againBtn = mk("ghost", "NOCH EINMAL");
  const nextBtn = mk("go", "WEITER ›");
  nextBtn.hidden = true;
  const actions = h("div", "sky-actions", "", [undoBtn, clearBtn, againBtn, sendBtn, nextBtn]);
  const barEl = h("div", "sky-bar", "", [modeBar, actions]);

  ctx.root.append(h("div", "sky-screen", "", [canvas, topEl, barEl]));

  /* ----- Zustand ----- */
  let W = 0, H = 0, dpr = 1, s = 1, oy = 0;                // Bildschirm, Maßstab (Pixel je Einheit), oberer Rand des Spielfelds
  let cam = -120, camVel = 0, camSpeed = 0, lastCamPx = 0; // Kamera in Welt-Einheiten
  let mode = "fly";                                        // fly | draw
  let phase = "draw";                                      // draw | flying | done
  let route = [];                                          // Punkte der Route (Welt-Einheiten)
  let length = 0;
  let crashed = null;                                      // { x, y } wenn die Spitze an einem Hindernis steht
  let complete = false;
  let particles = [], bursts = [], shooting = null;
  let drag = null;
  let flight = null, ufo = null;
  let flashText = "", flashUntil = 0;
  let field = null;
  let raf = 0, last = 0, uiSig = "";
  const keys = { left: false, right: false };
  const g = canvas.getContext("2d");

  const mod = (a, n) => ((a % n) + n) % n;
  const unitsWide = () => W / s;
  const clampCam = () => { cam = clamp(cam, CAM_MIN, Math.max(CAM_MIN, TRACK + 150 - unitsWide())); };

  /* ----- Strecke mit verstreuten Hindernissen ----- */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const TONES = [   // Gesteinsfarben: braun, graubraun, rötlich – [hell, dunkel, Randlicht]
    ["#7a5a40", "#2c1d13", "rgba(255, 196, 130, 0.5)"],
    ["#645d55", "#211e1b", "rgba(225, 215, 205, 0.42)"],
    ["#85513a", "#2d1a11", "rgba(255, 165, 115, 0.5)"]
  ];

  /** Erzeugt einen zufälligen Verlauf als garantierten Weg (corridor, nach rechts laufend) und streut Asteroiden
      und Kometen zufällig über die Strecke – aber nie in den Weg. Der Weg ist unsichtbar; wer ihn nicht findet,
      sucht sich einen eigenen. */
  function makeField(seed) {
    const r = rng(seed);
    // 1) Weg: zufällige Stützpunkte etwa alle 420 Einheiten, dazwischen linear
    const ctrl = [{ x: 0, y: 500 }];
    let cy = 500;
    for (let x = 300; x < GOAL_X + 400; x += 380 + r() * 120) {
      cy = clamp(cy + (r() - 0.5) * 620, 190, 810);
      ctrl.push({ x, y: cy });
    }
    const corridorY = (x) => {
      let i = 1;
      while (i < ctrl.length - 1 && ctrl[i].x < x) i++;
      const a = ctrl[i - 1], b = ctrl[i];
      const k = clamp((x - a.x) / (b.x - a.x), 0, 1);
      const e = k * k * (3 - 2 * k);            // weicher Übergang
      return a.y + (b.y - a.y) * e;
    };
    const solution = [];
    for (let x = 60; x <= GOAL_X + 12; x += 6) solution.push({ x, y: corridorY(x) });

    // 2) Hindernisse zufällig verstreuen, aber nicht in den Weg und nicht auf die Planeten
    const obstacles = [];
    const nearCorridor = (x, y, rad) => {
      for (let cx = x - rad - GAP; cx <= x + rad + GAP; cx += 12) {
        if (Math.hypot(x - cx, y - corridorY(cx)) < rad * 0.92 + SHIP_R + GAP / 2 - 14) return true;
      }
      return false;
    };
    const xMin = START_ZONE + 180, xMax = GOAL_X - 260;
    const targetArea = (xMax - xMin) * WORLD_H * DENSITY;
    let area = 0;
    for (let tries = 0; tries < 6000 && area < targetArea; tries++) {
      const rad = 38 + r() * 62;
      const x = xMin + r() * (xMax - xMin), y = -20 + r() * (WORLD_H + 40);
      if (nearCorridor(x, y, rad)) continue;
      if (obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < (o.r + rad) * 0.62)) continue;     // nicht komplett aufeinander
      area += Math.PI * rad * rad;
      obstacles.push({
        x, y, r: rad, comet: r() < 0.2,
        rot: r() * 6.28, spin: (r() - 0.5) * 0.5, tone: Math.floor(r() * TONES.length),
        shape: Array.from({ length: 13 }, () => 0.8 + r() * 0.34),
        crater: [r() * 6.28, r() * 6.28, r() * 6.28],
        tail: 0.7 + r() * 0.5, dir: Math.PI + (r() - 0.5) * 1.4
      });
    }
    return { seed, obstacles, solution };
  }
  const hits = (x, y) => field.obstacles.some((o) => Math.hypot(x - o.x, y - o.y) < o.r * 0.92 + SHIP_R);
  let seedCounter = (S.seed ?? (Date.now() & 0xffff)) >>> 0;
  field = makeField(seedCounter);

  /* ----- Sterne (Bildschirm-Schichten) ----- */
  const LAYERS = [
    { f: 0.12, n: 90, r: 0.7, a: 0.45 }, { f: 0.35, n: 70, r: 1.1, a: 0.65 },
    { f: 0.8, n: 45, r: 1.7, a: 0.85 }, { f: 1.5, n: 22, r: 2.6, a: 1 }
  ];
  const COLORS = ["#ffffff", "#ffffff", "#9dffc4", "#00f0ff"];
  const stars = LAYERS.map((L) => Array.from({ length: L.n }, () => ({
    u: Math.random(), v: Math.random(), p: Math.random() * 6.28, c: COLORS[Math.floor(Math.random() * COLORS.length)]
  })));
  const NEBULAE = [
    { u: 0.2, v: 0.3, r: 0.55, c: "0,255,102", a: 0.09, f: 0.05 },
    { u: 0.7, v: 0.6, r: 0.6, c: "0,240,255", a: 0.1, f: 0.08 },
    { u: 0.45, v: 0.85, r: 0.5, c: "150,60,255", a: 0.08, f: 0.06 }
  ];
  // Kontinente der Erde (zufällige Flecken, einmal erzeugt)
  const rand = rng(77);
  const LAND = Array.from({ length: 9 }, () => ({ a: rand() * 6.28, d: 0.15 + rand() * 0.7, w: 0.12 + rand() * 0.2, h: 0.08 + rand() * 0.14, rot: rand() * 3 }));
  const CLOUDS = Array.from({ length: 7 }, () => ({ a: rand() * 6.28, d: 0.2 + rand() * 0.7, w: 0.2 + rand() * 0.3, h: 0.04 + rand() * 0.05, rot: rand() * 3 }));

  /* ----- Layout: Spielfeld zwischen Hinweiszeile oben und Werkzeugleiste unten ----- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const top = topEl.getBoundingClientRect().bottom + 8;
    const bottom = H - barEl.getBoundingClientRect().top + 8;
    const avail = Math.max(120, H - top - bottom);
    s = avail / WORLD_H;
    oy = top;
    clampCam();
  }
  window.addEventListener("resize", resize);

  /* ----- Hilfen ----- */
  const toWorld = (x, y) => ({ x: x / s + cam, y: (y - oy) / s });
  const toScreen = (wx, wy) => ({ x: (wx - cam) * s, y: oy + wy * s });
  function flash(text) { flashText = text; flashUntil = performance.now() + 1800; hint.textContent = text; uiSig = ""; }
  function burst(x, y, color, n = 28) {
    bursts.push({ x, y, t: 0, color });
    for (let i = 0; i < n; i++) spark(x, y, 2.6, color);
  }
  function spark(x, y, power = 1, color) {
    if (particles.length > 300) return;
    const a = Math.random() * 6.28, v = (20 + Math.random() * 70) * power;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.8, c: color || (Math.random() < 0.5 ? "0,240,255" : "0,255,102") });
  }

  /* ----- Route zeichnen: nur vorwärts, mit Hinderniserkennung ----- */
  function advanceTo(p) {
    if (!route.length || crashed || complete) return;
    const head = route[route.length - 1];
    if (p.x < head.x - 45) flash("NUR NACH RECHTS – ZURÜCK GEHT NICHT");
    const tx = clamp(Math.max(p.x, head.x), 0, TRACK - 20);
    const ty = clamp(p.y, 14, WORLD_H - 14);
    const dist = Math.hypot(tx - head.x, ty - head.y);
    const steps = Math.ceil(dist / 5);
    for (let i = 1; i <= steps; i++) {
      const q = { x: head.x + ((tx - head.x) * i) / steps, y: head.y + ((ty - head.y) * i) / steps };
      if (hits(q.x, q.y)) {
        crashed = { x: q.x, y: q.y };
        burst(q.x, q.y, "255,59,92");
        flash("KOLLISION! – MIT „RÜCKGÄNGIG“ ZURÜCK UND ANDERS WEITER");
        break;
      }
      const prev = route[route.length - 1];
      length += Math.hypot(q.x - prev.x, q.y - prev.y);
      route.push(q);
      if (route.length % 4 === 0) spark(q.x, q.y);
      if (q.x >= GOAL_X) { complete = true; flashText = ""; burst(q.x, q.y, "0,255,102", 40); vibrateOnce(); break; }
    }
    refreshUI();
  }

  function undo() {
    if (phase !== "draw" || !route.length) return;
    let removed = 0;
    while (route.length > 1 && removed < UNDO_LEN) {
      const a = route.pop(), b = route[route.length - 1];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      removed += d; length -= d;
    }
    if (route.length <= 1) { route = []; length = 0; }
    crashed = null; complete = false; flashText = "";
    refreshUI();
  }
  function clearRoute() {
    if (phase !== "draw") return;
    route = []; length = 0; crashed = null; complete = false; drag = null; flashText = "";
    refreshUI();
  }

  /* ----- Eingabe ----- */
  const pt = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  canvas.addEventListener("pointerdown", (e) => {
    if (phase !== "draw" || drag) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* nicht überall möglich */ }
    const p = pt(e);
    camVel = 0;
    drag = { id: e.pointerId, x: p.x, y: p.y, t: performance.now(), active: false };
    if (mode !== "draw") return;

    const w = toWorld(p.x, p.y);
    if (!route.length) {
      if (w.x > START_ZONE) { flash("DIE ROUTE MUSS BEI DER ERDE (LINKS) BEGINNEN"); return; }
      route = [{ x: clamp(w.x, 10, START_ZONE), y: clamp(w.y, 14, WORLD_H - 14) }];
      length = 0; drag.active = true;
      if (hits(route[0].x, route[0].y)) { crashed = { ...route[0] }; }
      refreshUI();
    } else if (complete) {
      flash("HEIMATPLANET ERREICHT – SIMULATION STARTEN");
    } else if (crashed) {
      flash("KOLLISION! – ERST MIT „RÜCKGÄNGIG“ ZURÜCK");
    } else if (Math.hypot(w.x - route[route.length - 1].x, w.y - route[route.length - 1].y) <= 90) {
      drag.active = true;
    } else {
      flash("MALT BEI DER LEUCHTENDEN SPITZE WEITER");
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const p = pt(e), now = performance.now();
    if (mode === "fly") {
      const dx = (p.x - drag.x) / s;
      cam -= dx;
      clampCam();
      camVel = camVel * 0.6 + ((-dx / Math.max(1, now - drag.t)) * 1000) * 0.4;
    }
    drag.x = p.x; drag.y = p.y; drag.t = now;
    if (mode === "draw" && drag.active) { const w = toWorld(p.x, p.y); advanceTo(w); }
  });
  const endDrag = (e) => { if (drag && drag.id === e.pointerId) { drag = null; refreshUI(); } };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    cam += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / s;
    clampCam();
  }, { passive: false });

  function onKey(e, down) {
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = down;
    else if (k === "ArrowRight" || k === "d" || k === "D") keys.right = down;
  }
  const onKeyDown = (e) => onKey(e, true);
  const onKeyUp = (e) => onKey(e, false);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  /* ----- Knöpfe ----- */
  function setMode(next) { if (phase === "draw") { mode = next; refreshUI(); } }
  flyBtn.addEventListener("click", () => setMode("fly"));
  drawBtn.addEventListener("click", () => setMode("draw"));
  undoBtn.addEventListener("click", undo);
  clearBtn.addEventListener("click", clearRoute);
  nextBtn.addEventListener("click", () => ctx.next());

  /** „NOCH EINMAL“: neue Strecke für die Nächsten */
  againBtn.addEventListener("click", () => {
    seedCounter += 7919;
    field = makeField(seedCounter);
    route = []; length = 0; crashed = null; complete = false; particles = []; bursts = []; flight = null; ufo = null; drag = null;
    phase = "draw"; mode = "draw"; cam = -120; camVel = 0;
    refreshUI();
  });

  sendBtn.addEventListener("click", () => {
    if (phase !== "draw" || !complete || crashed) return;
    const pts = route.slice();
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = cum[cum.length - 1];
    flight = { pts, cum, total, t: 0, dur: clamp(total / 480, 5, 14) };
    phase = "flying"; drag = null;
    refreshUI();
  });

  function sampleFlight(f, d) {
    let i = 1;
    while (i < f.cum.length - 1 && f.cum[i] < d) i++;
    const a = f.pts[i - 1], b = f.pts[i], span = f.cum[i] - f.cum[i - 1] || 1;
    const k = clamp((d - f.cum[i - 1]) / span, 0, 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  /** Texte und Knöpfe passend zum Zustand (nur wenn sich etwas geändert hat) */
  function refreshUI() {
    const ready = complete && !crashed;
    const sig = [mode, phase, ready, !!crashed, route.length > 0].join("|");
    if (sig === uiSig) return;
    uiSig = sig;
    if (phase !== "draw") flashText = "";          // veraltete Kurzmeldungen stören den Probeflug nicht

    flyBtn.classList.toggle("on", mode === "fly");
    drawBtn.classList.toggle("on", mode === "draw");
    flyBtn.disabled = drawBtn.disabled = phase !== "draw";
    const drawing = phase === "draw";
    undoBtn.hidden = clearBtn.hidden = !drawing;
    undoBtn.disabled = clearBtn.disabled = !route.length;
    sendBtn.hidden = !drawing;
    sendBtn.disabled = !ready;
    againBtn.hidden = drawing;
    againBtn.disabled = phase === "flying";
    nextBtn.hidden = phase !== "done";

    let text;
    if (phase === "flying") text = "SIMULATION LÄUFT …";
    else if (phase === "done") text = "SIMULATION ERFOLGREICH – DIE ROUTE IST SICHER ✔";
    else if (crashed) text = "KOLLISION! – MIT „RÜCKGÄNGIG“ ZURÜCK UND ANDERS WEITER";
    else if (ready) text = "HEIMATPLANET ERREICHT – SIMULATION STARTEN";
    else if (mode === "fly") text = "WISCHT SEITLICH ÜBER DIE STRECKE – LINKS IST DIE ERDE, RECHTS DER HEIMATPLANET";
    else if (!route.length) text = "MALT VON DER ERDE (LINKS) ZUM HEIMATPLANETEN (RECHTS) – NUR NACH RECHTS, KEINEN BROCKEN BERÜHREN";
    else text = "MALT BEI DER LEUCHTENDEN SPITZE WEITER – ZUM HEIMATPLANETEN RECHTS";
    hint.textContent = flashText && performance.now() < flashUntil ? flashText : text;
  }

  /* ----- Bewegung ----- */
  function update(dt) {
    const keyDir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (keyDir && phase !== "flying") cam += (keyDir * 650 * dt) / s;
    if (!drag && Math.abs(camVel) > 2) { cam += camVel * dt; camVel *= Math.pow(0.05, dt); } else if (!drag) camVel = 0;

    // Malen: der Himmel scrollt schon ab dem linken/rechten Drittel mit – je näher am Rand, desto schneller
    if (drag && drag.active && mode === "draw") {
      const zone = W * 0.36;
      if (drag.x > W - zone) cam += ((drag.x - (W - zone)) * 5.5 * dt) / s;
      else if (drag.x < zone) cam -= ((zone - drag.x) * 5.5 * dt) / s;
      clampCam();
      advanceTo(toWorld(drag.x, drag.y));
    }

    // Probeflug: das Raumschiff folgt der Route, die Kamera folgt dem Raumschiff
    if (phase === "flying" && flight) {
      flight.t += dt;
      const k = clamp(flight.t / flight.dur, 0, 1);
      const eased = k * k * (3 - 2 * k);
      ufo = sampleFlight(flight, eased * flight.total);
      cam += (ufo.x - unitsWide() * 0.4 - cam) * (1 - Math.exp(-dt * 4));
      spark(ufo.x, ufo.y, 1.4); spark(ufo.x, ufo.y, 1.4);
      if (k >= 1) {
        phase = "done";
        vibrateOnce();
        burst(ufo.x, ufo.y, "0,255,102", 40);
        refreshUI();
      }
    }
    clampCam();

    camSpeed = camSpeed * 0.8 + (((cam * s) - lastCamPx) / Math.max(dt, 0.001)) * 0.2;
    lastCamPx = cam * s;

    particles.forEach((p) => { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    particles = particles.filter((p) => p.life < p.max);
    bursts.forEach((b) => { b.t += dt; });
    bursts = bursts.filter((b) => b.t < 0.9);

    if (!shooting && Math.random() < dt * 0.15) {
      shooting = { x: Math.random() * W, y: Math.random() * H * 0.4, vx: 380 + Math.random() * 220, vy: 120 + Math.random() * 120, life: 0 };
    }
    if (shooting) { shooting.life += dt; shooting.x += shooting.vx * dt; shooting.y += shooting.vy * dt; if (shooting.life > 0.9) shooting = null; }

    if (flashText && performance.now() > flashUntil) { flashText = ""; uiSig = ""; }
    refreshUI();
  }

  /* ----- Zeichnen ----- */
  function drawSky(t) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#02030c"); bg.addColorStop(1, "#050914");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    NEBULAE.forEach((n) => {
      const x = mod(n.u * W * 1.6 - cam * s * n.f, W * 1.6) - W * 0.3;
      const y = n.v * H, r = n.r * Math.max(W, H);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${n.c},${n.a})`); grad.addColorStop(1, `rgba(${n.c},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    });

    LAYERS.forEach((L, li) => {
      const streak = clamp(Math.abs(camSpeed) * L.f * 0.012, 0, 26);
      stars[li].forEach((st) => {
        const x = mod(st.u * W - cam * s * L.f, W);
        const y = st.v * H;
        g.globalAlpha = L.a * (0.75 + 0.25 * Math.sin(t * 0.002 * (1 + li) + st.p));
        g.fillStyle = st.c;
        if (streak > 2) {
          g.strokeStyle = st.c; g.lineWidth = L.r;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sign(camSpeed) * streak, y); g.stroke();
        }
        g.beginPath(); g.arc(x, y, L.r, 0, 6.283); g.fill();
      });
    });
    g.globalAlpha = 1;

    if (shooting) {
      g.strokeStyle = `rgba(255,255,255,${1 - shooting.life / 0.9})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(shooting.x, shooting.y); g.lineTo(shooting.x - shooting.vx * 0.12, shooting.y - shooting.vy * 0.12); g.stroke();
    }
  }

  /** Die Erde (links): blaue Kugel mit Kontinenten, Wolken und leuchtender Atmosphäre */
  function drawEarth(t) {
    const { x, y, r } = EARTH;
    const halo = g.createRadialGradient(x, y, r * 0.95, x, y, r * 1.22);
    halo.addColorStop(0, "rgba(80, 170, 255, 0.55)"); halo.addColorStop(1, "rgba(80, 170, 255, 0)");
    g.fillStyle = halo;
    g.beginPath(); g.arc(x, y, r * 1.22, 0, 6.283); g.fill();
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.clip();
    const sea = g.createRadialGradient(x + r * 0.45, y - r * 0.35, r * 0.1, x, y, r);
    sea.addColorStop(0, "#4aa8ff"); sea.addColorStop(0.55, "#1b5fb0"); sea.addColorStop(1, "#071a3a");
    g.fillStyle = sea; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    const drift = t * 0.00002;
    g.fillStyle = "rgba(62, 160, 90, 0.9)";
    LAND.forEach((l) => {
      const a = l.a + drift;
      g.save();
      g.translate(x + Math.cos(a) * l.d * r, y + Math.sin(a) * l.d * r);
      g.rotate(l.rot);
      g.beginPath(); g.ellipse(0, 0, l.w * r, l.h * r, 0, 0, 6.283); g.fill();
      g.restore();
    });
    g.fillStyle = "rgba(255, 255, 255, 0.55)";
    CLOUDS.forEach((c) => {
      const a = c.a + drift * 1.6;
      g.save();
      g.translate(x + Math.cos(a) * c.d * r, y + Math.sin(a) * c.d * r);
      g.rotate(c.rot);
      g.beginPath(); g.ellipse(0, 0, c.w * r, c.h * r, 0, 0, 6.283); g.fill();
      g.restore();
    });
    const shade = g.createRadialGradient(x + r * 0.35, y - r * 0.3, r * 0.5, x, y, r * 1.05);
    shade.addColorStop(0, "rgba(0, 0, 0, 0)"); shade.addColorStop(1, "rgba(0, 0, 12, 0.7)");
    g.fillStyle = shade; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    g.restore();
    g.strokeStyle = "rgba(140, 200, 255, 0.55)"; g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.stroke();
  }

  /** Der Heimatplanet der Aliens (rechts): leuchtend violett-grün mit Ring */
  function drawHome(t) {
    const { x, y, r } = HOME;
    const ring = (front) => {
      g.save();
      g.translate(x, y); g.rotate(-0.28);
      g.strokeStyle = "rgba(0, 255, 160, 0.55)"; g.lineWidth = 18;
      g.beginPath(); g.ellipse(0, 0, r * 1.55, r * 0.42, 0, front ? 0 : Math.PI, front ? Math.PI : 6.283); g.stroke();
      g.strokeStyle = "rgba(0, 240, 255, 0.5)"; g.lineWidth = 5;
      g.beginPath(); g.ellipse(0, 0, r * 1.7, r * 0.47, 0, front ? 0 : Math.PI, front ? Math.PI : 6.283); g.stroke();
      g.restore();
    };
    const halo = g.createRadialGradient(x, y, r * 0.95, x, y, r * 1.3);
    halo.addColorStop(0, "rgba(0, 255, 140, 0.5)"); halo.addColorStop(1, "rgba(0, 255, 140, 0)");
    g.fillStyle = halo;
    g.beginPath(); g.arc(x, y, r * 1.3, 0, 6.283); g.fill();
    ring(false);
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.clip();
    const body = g.createRadialGradient(x - r * 0.4, y - r * 0.3, r * 0.1, x, y, r);
    body.addColorStop(0, "#a45cff"); body.addColorStop(0.5, "#4a1d9a"); body.addColorStop(1, "#150a3a");
    g.fillStyle = body; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    g.fillStyle = "rgba(0, 255, 170, 0.22)";
    for (let i = 0; i < 6; i++) {
      g.beginPath(); g.ellipse(x - r * 0.1 + Math.sin(t * 0.0002 + i) * 14, y + (i - 2.5) * r * 0.26, r * 1.1, r * 0.06, -0.28, 0, 6.283); g.fill();
    }
    for (let i = 0; i < 12; i++) {                     // Lichter der Städte
      g.fillStyle = `rgba(150, 255, 220, ${0.35 + 0.35 * Math.sin(t * 0.003 + i * 2)})`;
      g.beginPath(); g.arc(x - r * (0.2 + (i * 37 % 60) / 100), y + ((i * 53) % 90 - 45) / 100 * r, 4, 0, 6.283); g.fill();
    }
    const shade = g.createRadialGradient(x - r * 0.35, y - r * 0.3, r * 0.5, x, y, r * 1.05);
    shade.addColorStop(0, "rgba(0, 0, 0, 0)"); shade.addColorStop(1, "rgba(0, 0, 14, 0.65)");
    g.fillStyle = shade; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    g.restore();
    g.strokeStyle = "rgba(0, 255, 160, 0.7)"; g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.stroke();
    ring(true);
  }

  /** Alles in Welt-Einheiten: Planeten, Hindernisse, Route */
  function drawWorld(t) {
    g.setTransform(dpr * s, 0, 0, dpr * s, -cam * s * dpr, oy * dpr);

    if (cam < EARTH.x + EARTH.r + 200) drawEarth(t);
    if (cam + unitsWide() > HOME.x - HOME.r * 1.8) drawHome(t);

    // Startfeld bei der Erde und Zielrand beim Heimatplaneten
    g.lineWidth = 3; g.setLineDash([14, 12]);
    g.strokeStyle = "rgba(0, 255, 102, 0.55)";
    g.beginPath(); g.moveTo(START_X, 0); g.lineTo(START_X, WORLD_H); g.stroke();
    g.strokeStyle = complete ? "rgba(0, 255, 102, 0.95)" : "rgba(0, 240, 255, 0.55)";
    g.beginPath(); g.moveTo(GOAL_X, 0); g.lineTo(GOAL_X, WORLD_H); g.stroke();
    g.setLineDash([]);
    g.fillStyle = "rgba(0, 255, 102, 0.06)"; g.fillRect(START_X, 0, START_ZONE - START_X, WORLD_H);
    g.font = "bold 30px 'Courier New', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "rgba(0, 255, 102, 0.95)"; g.fillText("ERDE", START_X + 70, 40);
    g.fillStyle = "rgba(0, 240, 255, 0.95)"; g.fillText("HEIMATPLANET", GOAL_X - 190, 40);
    g.font = "bold 44px 'Courier New', monospace";
    g.fillStyle = "rgba(0, 255, 102, 0.9)"; g.fillText("▶", START_X + 70, WORLD_H / 2 - 4);

    // Hindernisse
    const x0 = cam - 200, x1 = cam + unitsWide() + 200;
    field.obstacles.forEach((o) => {
      if (o.x < x0 || o.x > x1) return;
      if (o.comet) drawComet(o, t); else drawRock(o, t);
    });

    // Route
    g.lineCap = "round"; g.lineJoin = "round";
    if (route.length) {
      g.globalCompositeOperation = "lighter";
      const passes = [[16, "rgba(0, 240, 255, 0.10)"], [7, "rgba(0, 255, 140, 0.30)"], [2.6, "rgba(235, 255, 245, 0.95)"]];
      passes.forEach(([width, color]) => {
        g.lineWidth = width; g.strokeStyle = color;
        g.beginPath();
        route.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        if (route.length === 1) g.lineTo(route[0].x + 0.1, route[0].y);
        g.stroke();
      });
      g.globalCompositeOperation = "source-over";
    }

    // Spitze der Route (dort wird weitergemalt)
    if (route.length && phase === "draw" && !complete) {
      const head = route[route.length - 1];
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.006);
      g.fillStyle = crashed ? `rgba(255, 59, 92, ${pulse})` : `rgba(0, 240, 255, ${pulse})`;
      g.shadowColor = crashed ? "#ff3b5c" : "#00f0ff"; g.shadowBlur = 22;
      g.beginPath(); g.arc(head.x, head.y, 11, 0, 6.283); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = crashed ? "rgba(255, 59, 92, 0.9)" : "rgba(0, 240, 255, 0.8)"; g.lineWidth = 3;
      g.beginPath(); g.arc(head.x, head.y, 22 + 5 * pulse, 0, 6.283); g.stroke();
    }
    // Startmarke, solange noch keine Route da ist
    if (!route.length && phase === "draw" && mode === "draw") {
      g.strokeStyle = "rgba(0, 255, 102, 0.9)"; g.lineWidth = 3; g.setLineDash([10, 8]);
      g.beginPath(); g.arc(START_X + 70, WORLD_H / 2, 62, 0, 6.283); g.stroke(); g.setLineDash([]);
    }

    // Funken und Aufschläge
    g.globalCompositeOperation = "lighter";
    particles.forEach((p) => {
      const a = 1 - p.life / p.max;
      g.fillStyle = `rgba(${p.c},${a * 0.9})`;
      g.beginPath(); g.arc(p.x, p.y, 2.5 + a * 3.5, 0, 6.283); g.fill();
    });
    bursts.forEach((b) => {
      const a = 1 - b.t / 0.9;
      g.strokeStyle = `rgba(${b.color},${a})`; g.lineWidth = 5;
      g.beginPath(); g.arc(b.x, b.y, 15 + b.t * 150, 0, 6.283); g.stroke();
    });
    g.globalCompositeOperation = "source-over";

    drawUfo(t);
  }

  function drawRock(o, t) {
    const [light, dark, rim] = TONES[o.tone];
    g.save();
    g.translate(o.x, o.y);
    g.rotate(o.rot + t * 0.0001 * o.spin);
    g.beginPath();
    o.shape.forEach((k, i) => {
      const a = (i / o.shape.length) * 6.283;
      i ? g.lineTo(Math.cos(a) * o.r * k, Math.sin(a) * o.r * k) : g.moveTo(Math.cos(a) * o.r * k, Math.sin(a) * o.r * k);
    });
    g.closePath();
    const grad = g.createRadialGradient(-o.r * 0.35, -o.r * 0.35, o.r * 0.1, 0, 0, o.r * 1.05);
    grad.addColorStop(0, light); grad.addColorStop(1, dark);
    g.fillStyle = grad; g.fill();
    g.strokeStyle = rim; g.lineWidth = 2.4; g.stroke();
    o.crater.forEach((a, i) => {
      const cx = Math.cos(a) * o.r * 0.38, cy = Math.sin(a) * o.r * 0.38, cr = o.r * (0.12 + i * 0.04);
      g.fillStyle = "rgba(0, 0, 0, 0.32)"; g.beginPath(); g.arc(cx, cy, cr, 0, 6.283); g.fill();
      g.strokeStyle = "rgba(255, 220, 180, 0.16)"; g.lineWidth = 1.6; g.beginPath(); g.arc(cx - cr * 0.12, cy - cr * 0.12, cr, 0.2, 2.6); g.stroke();
    });
    g.restore();
  }

  function drawComet(o, t) {
    const tail = o.r * 4.4 * o.tail;
    const tx = o.x + Math.cos(o.dir) * tail, ty = o.y + Math.sin(o.dir) * tail;
    const grad = g.createLinearGradient(o.x, o.y, tx, ty);
    grad.addColorStop(0, "rgba(120, 255, 255, 0.55)"); grad.addColorStop(1, "rgba(0, 240, 255, 0)");
    g.fillStyle = grad;
    const nx = -Math.sin(o.dir) * o.r * 0.9, ny = Math.cos(o.dir) * o.r * 0.9;
    g.beginPath(); g.moveTo(o.x + nx, o.y + ny); g.lineTo(tx, ty); g.lineTo(o.x - nx, o.y - ny); g.closePath(); g.fill();
    const glow = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 1.5);
    glow.addColorStop(0, "rgba(220, 255, 255, 0.9)"); glow.addColorStop(0.45, "rgba(0, 240, 255, 0.45)"); glow.addColorStop(1, "rgba(0, 240, 255, 0)");
    g.fillStyle = glow;
    g.beginPath(); g.arc(o.x, o.y, o.r * 1.5, 0, 6.283); g.fill();
    g.fillStyle = "#e9ffff";
    g.beginPath(); g.arc(o.x, o.y, o.r * 0.62 * (0.95 + 0.05 * Math.sin(t * 0.004 + o.rot)), 0, 6.283); g.fill();
  }

  function drawUfo(t) {
    if (!ufo) return;
    const glow = g.createRadialGradient(ufo.x, ufo.y, 0, ufo.x, ufo.y, 70);
    glow.addColorStop(0, "rgba(0, 255, 140, 0.45)"); glow.addColorStop(1, "rgba(0, 255, 140, 0)");
    g.fillStyle = glow;
    g.fillRect(ufo.x - 70, ufo.y - 70, 140, 140);
    g.save();
    g.translate(ufo.x, ufo.y);
    g.rotate(clamp(Math.sin(ufo.angle) * 0.35, -0.35, 0.35));
    g.fillStyle = "rgba(0, 240, 255, 0.65)";
    g.beginPath(); g.ellipse(0, -9, 15, 12, 0, Math.PI, 0); g.fill();
    g.fillStyle = "#b9cfc7";
    g.beginPath(); g.ellipse(0, 0, 36, 11, 0, 0, 6.283); g.fill();
    g.strokeStyle = "#00ff66"; g.lineWidth = 2.2;
    g.beginPath(); g.ellipse(0, 0, 36, 11, 0, 0, 6.283); g.stroke();
    for (let i = -1; i <= 1; i++) {
      g.fillStyle = (Math.floor(t / 180) + i) % 2 ? "#00f0ff" : "#00ff66";
      g.beginPath(); g.arc(i * 18, 1.5, 3, 0, 6.283); g.fill();
    }
    g.restore();
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const t = performance.now();
    const dt = last ? Math.min((t - last) / 1000, 0.1) : 0;
    last = t;
    if (!W || !H) { resize(); return; }
    update(dt);
    drawSky(t);
    drawWorld(t);
  }

  resize();
  refreshUI();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
    /* nur für die Debug-Seite und Tests */
    debugTick(seconds = 1) { for (let t = 0; t < seconds; t += 1 / 60) update(1 / 60); },
    debugScreen: (wx, wy) => toScreen(wx, wy),
    debugObstacles: () => field.obstacles.map((o) => ({ x: o.x, y: o.y, r: o.r, comet: o.comet })),
    /** malt eine gültige Route (den garantierten Weg) von der Erde bis zum Heimatplaneten */
    debugDraw() {
      if (phase !== "draw") return;
      route = [{ x: 60, y: 500 }]; length = 0; crashed = null; complete = false; flashText = "";
      mode = "draw";
      field.solution.forEach((p) => advanceTo(p));
      refreshUI();
    },
    /** steuert geradewegs in ein Hindernis (zum Testen der Kollision) */
    debugCrash() {
      if (phase !== "draw") return;
      route = [{ x: 60, y: 500 }]; length = 0; crashed = null; complete = false; flashText = "";
      mode = "draw";
      const target = field.obstacles.filter((o) => Math.abs(o.y - 500) < 260).sort((a, b) => a.x - b.x)[0] || field.obstacles[0];
      advanceTo({ x: target.x, y: target.y });
      refreshUI();
    },
    /** prüft für viele Startwerte, dass der garantierte Weg frei von Hindernissen ist (Anzahl der Fehler) und die Strecke gefüllt ist */
    debugCheckFields(count = 100) {
      let bad = 0;
      const keep = field;
      for (let i = 0; i < count && !bad; i++) {
        field = makeField(1000 + i * 31);
        if (field.obstacles.length < 25) bad++;
        for (const p of field.solution) if (hits(p.x, p.y)) { bad++; break; }
      }
      field = keep;
      return bad;
    },
    info: () => ({
      type: "sky", phase, mode, length: Math.round(length), complete, crashed: !!crashed,
      head: route.length ? route[route.length - 1] : null, routePoints: route.length,
      cam: Math.round(cam), width: W, scale: s, track: TRACK, startX: START_X, startZone: START_ZONE, goalX: GOAL_X,
      obstacles: field.obstacles.length, seed: field.seed,
      starX: LAYERS.map((L, li) => mod(stars[li][0].u * W - cam * s * L.f, W))
    })
  };
});
