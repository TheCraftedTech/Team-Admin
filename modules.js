/* ==========================================================================
   modules.js – die Module (jeweils eine eigene Oberfläche und Mechanik)
   --------------------------------------------------------------------------
   info      Seite zum Durchlesen (Inhalt aus einer Markdown-Datei); optional gestört (garble), mit Hinweiskasten
             darunter (hintMd) oder einer Meldung darüber (leadMd)
   dialog    Aufgabe: Sätze eines Dialogs per Ziehen in die richtige Reihenfolge bringen, umschaltbar Schwäbisch / Deutsch
   locate    Ortungs-Radar zu einem Ort, „WEITER“ erst am Ort
   password  Eingabefeld für ein Passwort (Text darüber aus Markdown)
   memory    Aufgabe: Muster aus leuchtenden Tasten merken und nachtippen
   end       Abschlussseite (Inhalt aus einer Markdown-Datei)
   Inhalte und Reihenfolge stehen in steps.js, die Steuerung in core.js.
   Jedes Modul hat genau einen Haupt-Button mit der Klasse „go“ (die Debug-Seite findet ihn damit).
   ========================================================================== */
"use strict";

/* ======================================================================
   Modul „info“ – Seite zum Durchlesen, am Ende ein Button
   ====================================================================== */
registerModule("info", (ctx) => {
  const S = ctx.step;
  const content = h("div", "md");
  const parts = [content];
  if (S.leadMd) {
    const lead = h("div", "md leadbox");
    parts.unshift(lead);
    fillMarkdown(lead, S.leadMd);
  }
  if (S.hintMd) {
    const hint = h("div", "md hintbox");
    parts.push(hint);
    fillMarkdown(hint, S.hintMd);
  }
  const button = h("button", "go", S.button || "WEITER");
  button.type = "button";
  button.addEventListener("click", () => ctx.next());
  parts.push(button);

  ctx.root.append(h("div", "scroller", "", [h("div", "page", "", parts)]));

  let glitchTimer = 0;
  fillMarkdown(content, S.md).then(() => {
    if (S.garble && !content.classList.contains("error")) glitchTimer = startGarble(content, S.garble);
  });

  return {
    destroy() { clearInterval(glitchTimer); },
    info: () => ({ type: "info", md: S.md, garble: S.garble || 0 })
  };
});

/** „Gestörter“ Text: ein Teil der Buchstaben und Ziffern wird ständig durch Zeichen ersetzt (strength = Anteil 0–1).
    Die Struktur (Überschriften, Absätze, Listen, Bilder) bleibt erhalten, nur lesen kann man es nicht richtig. */
const GLITCH_CHARS = "#%&@$?*/\\<>=+0123456789ABXZ";
function startGarble(el, strength) {
  el.classList.add("garbled");
  const nodes = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeValue.trim()) nodes.push({ node, text: node.nodeValue });
  }
  const tick = () => nodes.forEach(({ node, text }) => {
    let out = "";
    for (const ch of text) {
      out += /[\p{L}\p{N}]/u.test(ch) && Math.random() < strength ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)] : ch;
    }
    node.nodeValue = out;
  });
  tick();
  return setInterval(tick, 160);
}

/* ======================================================================
   Modul „end“ – Abschlussseite
   ====================================================================== */
registerModule("end", (ctx) => {
  const S = ctx.step;
  const content = h("div", "md");
  ctx.root.append(h("div", "scroller end", "", [h("div", "page", "", [content])]));
  fillMarkdown(content, S.md);
  vibrateOnce();

  return {
    info: () => ({ type: "end", md: S.md })
  };
});

/* ======================================================================
   Modul „password“ – Eingabefeld; das richtige Passwort führt zum nächsten Schritt
   ====================================================================== */
registerModule("password", (ctx) => {
  const S = ctx.step;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "field";
  input.placeholder = S.placeholder || "PASSWORT";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.setAttribute("autocorrect", "off");
  input.setAttribute("enterkeyhint", "go");
  input.setAttribute("aria-label", S.placeholder || "Passwort");

  const button = h("button", "go", S.button || "PRÜFEN");
  button.type = "submit";
  const feedback = h("div", "feedback");
  feedback.setAttribute("role", "status");

  const form = h("form", "", "", [input, button]);
  form.noValidate = true;

  const parts = [];
  if (S.md) {
    const content = h("div", "md");
    parts.push(content);
    fillMarkdown(content, S.md);
  }
  parts.push(form, feedback);

  const page = h("div", "page", "", parts);
  ctx.root.append(h("div", "scroller", "", [page]));

  let timer = 0;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.disabled) return;
    if (!input.value.trim()) {
      feedback.className = "feedback err";
      feedback.textContent = "BITTE EIN PASSWORT EINGEBEN";
      return;
    }
    if (matchesAnswer(input.value, S.answers)) {
      feedback.className = "feedback ok";
      feedback.textContent = "PASSWORT RICHTIG ✔";
      input.disabled = true;
      button.disabled = true;
      vibrateOnce();
      timer = setTimeout(() => ctx.next(), 700);
    } else {
      feedback.className = "feedback err";
      feedback.textContent = "FALSCHES PASSWORT – VERSUCHT ES NOCH EINMAL";
      page.classList.remove("shake");
      void page.offsetWidth;            // Animation neu starten
      page.classList.add("shake");
      input.select();
    }
  });

  return {
    destroy() { clearTimeout(timer); },
    info: () => ({ type: "password", answers: [].concat(S.answers || []) })
  };
});

/* ======================================================================
   Modul „locate“ – Ortungs-Radar zu einem Ort (lat/lng)
   Man kommt nur weiter, wenn man wirklich am Ort ist: Innerhalb von radius Metern, bei genauem GPS
   (maxAccuracy) und holdSeconds Sekunden lang ununterbrochen – dann erscheint unten „WEITER“.
   Schon ab approachRadius Metern zeigt die Statuszeile „FAST DA – NOCH ETWAS NÄHER“.
   ====================================================================== */
registerModule("locate", (ctx) => {
  const S = ctx.step;
  const radius = S.radius ?? SETTINGS.radius;
  const approach = S.approachRadius ?? SETTINGS.approachRadius;
  const maxAcc = S.maxAccuracy ?? SETTINGS.maxAccuracy;
  const holdMs = (S.holdSeconds ?? SETTINGS.holdSeconds) * 1000;

  /* ----- Oberfläche ----- */
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Radar");
  const distEl = h("div", "dist", "ENTFERNUNG: – – –");
  const noteEl = h("div", "note");
  const nextBtn = h("button", "go", "WEITER ›");
  nextBtn.type = "button";
  nextBtn.hidden = true;

  ctx.root.append(
    h("main", "stage", "", [canvas]),
    h("footer", "bottom", "", [distEl, noteEl, nextBtn])
  );

  /* ----- Logik: Entfernung, Ankunft ----- */
  let arrived = Boolean(ctx.data.arrived);   // eingerastet: bleibt, bis „WEITER“ gedrückt wird (auch nach Neuladen)
  let holdSince = 0;                         // seit wann die Ankunfts-Bedingung ununterbrochen erfüllt ist (0 = nicht erfüllt)
  let dist = null, brg = 0;
  let burst = 0;

  /** Im Radius, GPS genau genug und die Messung ist frisch */
  function inZone() {
    return pos !== null && dist !== null && dist <= radius && pos.acc <= maxAcc && Date.now() - pos.t < 4000;
  }

  /** Ankunft prüfen: die Bedingung muss holdMs lang ohne Unterbrechung gelten (läuft bei jeder Messung und jede halbe Sekunde) */
  function check() {
    if (arrived) return;
    if (!inZone()) { holdSince = 0; return; }
    if (!holdSince) holdSince = Date.now();
    if (Date.now() - holdSince >= holdMs) {
      arrived = true;
      ctx.data.arrived = true;
      ctx.save();
      vibrateOnce();
      burst = 1;
    }
  }

  function render() {
    nextBtn.hidden = !arrived;
    if (arrived) setText(distEl, "DU BIST DA ✔");
    else setText(distEl, dist === null ? "ENTFERNUNG: – – –" : `ENTFERNUNG: ${formatMeters(dist)}`);

    const st = gpsStatus({ dist, radius, maxAcc });
    let text = st.text;
    if (!st.error && !arrived && dist !== null) {
      if (holdSince) text = `POSITION WIRD BESTÄTIGT … ${Math.max(1, Math.ceil((holdMs - (Date.now() - holdSince)) / 1000))} s`;
      else if (dist <= radius && pos && pos.acc > maxAcc) text = `GPS NOCH UNGENAU (±${Math.round(pos.acc)} m) – BITTE KURZ STEHEN BLEIBEN`;
      else if (dist <= approach) text = `FAST DA – NOCH ${Math.max(1, Math.round(dist - radius))} m NÄHER HERANGEHEN`;
    }
    setText(noteEl, text);
    noteEl.classList.toggle("err", st.error);
  }

  function onPos() {
    if (pos) {
      dist = distanceMeters(pos.lat, pos.lng, S.lat, S.lng);
      brg = bearingDeg(pos.lat, pos.lng, S.lat, S.lng);
    }
    check();
    render();
  }

  nextBtn.addEventListener("click", () => { if (arrived) ctx.next(); });
  const noteTimer = setInterval(() => { check(); render(); }, 500);   // Zähler, „Signal verloren“ und die Haltezeit aktuell halten
  onPos();

  /* ----- Radar-Zeichnung ----- */
  const g = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  window.addEventListener("resize", resize);

  const RANGES = [20, 40, 80, 150, 300, 600, 1200, 2500, 5000, 10000, 25000, 100000, 1000000];
  const pickRange = (d) => RANGES.find((r) => r >= d) || RANGES[RANGES.length - 1];

  let rangeDisp = 40;           // aktuell angezeigte Reichweite (gleitet sanft)
  let dot = { x: 0, y: 0, init: false };
  let phase = 0, sweep = 0, last = 0, raf = 0;

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((t - last) / 1000, 0.1) : 0;
    last = t;
    if (!W || !H) { resize(); return; }

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.max(40, Math.min(W, H) / 2 - 14);

    // Reichweite gleitend anpassen
    const hasTarget = dist !== null;
    const targetRange = hasTarget ? pickRange(dist * 1.15) : 40;
    rangeDisp *= Math.exp(Math.log(targetRange / rangeDisp) * (1 - Math.exp(-dt * 3)));

    // Scheibe & Ringe
    g.fillStyle = "rgba(0, 28, 14, 0.55)";
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.lineWidth = 1.5; g.strokeStyle = "rgba(0, 255, 102, 0.35)";
    for (let i = 1; i <= 4; i++) { g.beginPath(); g.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2); g.stroke(); }
    g.beginPath();
    g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R);
    g.stroke();

    // Nordmarke (dreht sich mit dem Kompass)
    const north = heading === null ? 0 : -heading;
    g.fillStyle = "#00f0ff"; g.font = "bold 18px 'Courier New', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("N", cx + R * 0.93 * Math.sin(rad(north)), cy - R * 0.93 * Math.cos(rad(north)));

    // Radar-Sweep
    sweep = (sweep + dt * 1.3) % (Math.PI * 2);
    g.lineWidth = 5;
    for (let i = 0; i < 24; i++) {
      const a = sweep - i * 0.045;
      g.strokeStyle = `rgba(0, 255, 102, ${0.3 * (1 - i / 24)})`;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + R * Math.sin(a), cy - R * Math.cos(a)); g.stroke();
    }

    if (hasTarget) {
      const frac = dist / rangeDisp;
      const rel = rad((brg - (heading ?? 0) + 360) % 360);
      const r = Math.min(frac, 1) * R * 0.97;
      const tx = cx + r * Math.sin(rel), ty = cy - r * Math.cos(rel);

      // Punkt gleitet sanft (statt zu springen)
      if (!dot.init) { dot.x = tx; dot.y = ty; dot.init = true; }
      const k = 1 - Math.exp(-dt * 8);
      dot.x += (tx - dot.x) * k; dot.y += (ty - dot.y) * k;

      // Verbindungslinie (gestrichelt, "wandert" zum Ziel)
      g.setLineDash([5, 10]); g.lineDashOffset = -t / 40;
      g.strokeStyle = "rgba(0, 240, 255, 0.75)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(dot.x, dot.y); g.stroke();

      // Fangradius um das Ziel
      const capture = Math.max(7, (radius / rangeDisp) * R);
      g.strokeStyle = "rgba(0, 255, 102, 0.8)"; g.lineWidth = 1.5;
      g.setLineDash([3, 4]);
      g.beginPath(); g.arc(dot.x, dot.y, capture, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);

      // Puls: je näher, desto schneller
      const period = 0.35 + 2.2 * clamp(dist / 120, 0, 1);
      phase = (phase + dt / period) % 1;
      g.strokeStyle = `rgba(0, 240, 255, ${1 - phase})`; g.lineWidth = 3;
      g.beginPath(); g.arc(dot.x, dot.y, 8 + phase * 36, 0, Math.PI * 2); g.stroke();

      g.fillStyle = "#00f0ff"; g.shadowColor = "#00f0ff"; g.shadowBlur = 16;
      g.beginPath(); g.arc(dot.x, dot.y, 7 + (1 - phase) * 3, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
    }

    // Blitz bei Ankunft
    if (burst > 0) {
      g.strokeStyle = `rgba(0, 255, 102, ${burst})`; g.lineWidth = 4;
      g.beginPath(); g.arc(cx, cy, (1 - burst) * R, 0, Math.PI * 2); g.stroke();
      burst = Math.max(0, burst - dt * 1.2);
    }

    // Eigener Standort = dein Cursor (zeigt nach oben = Blickrichtung)
    g.fillStyle = "#00ff66"; g.shadowColor = "#00ff66"; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(cx, cy - 14); g.lineTo(cx + 9, cy + 10); g.lineTo(cx - 9, cy + 10); g.closePath(); g.fill();
    g.shadowBlur = 0;
  }
  raf = requestAnimationFrame(frame);

  return {
    onPosition: onPos,
    destroy() {
      cancelAnimationFrame(raf);
      clearInterval(noteTimer);
      window.removeEventListener("resize", resize);
    },
    info: () => ({ type: "locate", dist, arrived, radius, approach, maxAcc, holdSeconds: holdMs / 1000, held: holdSince ? (Date.now() - holdSince) / 1000 : 0 })
  };
});

/* ======================================================================
   Modul „memory“ – Aufgabe „Störsender“: EIN Code = EIN Schritt
   Die Anleitung ist ein eigener „info“-Schritt davor, jede weitere Runde ein weiterer „memory“-Schritt.
   Die Seite füllt den Bildschirm ohne Scrollen. Auf dem Raster (size × size) leuchten dots Tasten
   mehrmals auf; danach tippt man genau diese Tasten an (Reihenfolge egal).
   Richtig → nächster Schritt. Falsch → neues Muster im selben Schritt, oder – mit failTo – zurück
   zu einem anderen Schritt (z. B. zum ersten Code: „die Sperre beginnt von vorne“).
   Felder: startLabel, round/rounds (nur Anzeige „CODE 2 / 3“), size, dots, blinks, onMs, offMs,
   autoStart (Runde beginnt sofort), backTo (Schritt-ID für den „‹ ZURÜCK“-Knopf), failTo (Schritt-ID bei Fehler)
   ====================================================================== */
registerModule("memory", (ctx) => {
  const S = ctx.step;
  const size = S.size ?? 5;
  const dots = S.dots ?? 5;
  const round = S.round ?? 1;
  const rounds = S.rounds ?? 1;
  const blinks = S.blinks ?? 2;
  const onMs = S.onMs ?? 500;
  const offMs = S.offMs ?? 280;
  const total = size * size;

  let phase = "idle";                 // idle | show | input | fail | done
  let pattern = new Set();
  let found = new Set();

  /* ----- Zeitgeber, die beim Verlassen aufgeräumt werden ----- */
  const timers = new Set();
  function later(fn, ms) {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  }
  function clearTimers() { timers.forEach(clearTimeout); timers.clear(); }

  /* ----- Oberfläche ----- */
  const topParts = [];
  if (S.backTo) {
    const back = h("button", "back", "‹ ZURÜCK");
    back.type = "button";
    back.addEventListener("click", () => ctx.goToId(S.backTo));
    topParts.push(back);
  }
  topParts.push(h("div", "mem-title", S.label || (rounds > 1 ? `CODE ${round} / ${rounds}` : "STÖRSENDER")));

  const leds = h("div", "dots");
  if (rounds > 1) {
    leds.replaceChildren(...Array.from({ length: rounds }, (_, i) => {
      const d = document.createElement("i");
      d.className = i < round - 1 ? "done" : i === round - 1 ? "now" : "";
      return d;
    }));
  }

  const status = h("div", "feedback");
  status.setAttribute("role", "status");
  const cells = Array.from({ length: total }, (_, i) => {
    const b = h("button", "mem-cell");
    b.type = "button";
    b.disabled = true;
    b.setAttribute("aria-label", `Taste ${i + 1}`);
    b.addEventListener("click", () => tap(i));
    return b;
  });
  const grid = h("div", "mem-grid", "", cells);
  grid.style.setProperty("--n", size);
  const stage = h("div", "mem-stage", "", [grid]);
  const startBtn = h("button", "go", S.startLabel || "ANGREIFEN");
  startBtn.type = "button";
  startBtn.hidden = Boolean(S.autoStart);
  startBtn.addEventListener("click", () => startRound());

  ctx.root.append(h("div", "mem-screen", "", [h("div", "mem-top", "", topParts), leds, stage, status, startBtn]));

  /** Das Raster so groß machen, wie in den freien Platz passt (quadratisch, nie scrollen) */
  function fitGrid() {
    const s = Math.floor(Math.min(stage.clientWidth, stage.clientHeight));
    if (s > 0) { grid.style.width = `${s}px`; grid.style.height = `${s}px`; }
  }
  window.addEventListener("resize", fitGrid);
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(fitGrid) : null;
  if (observer) observer.observe(stage);
  requestAnimationFrame(fitGrid);

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = "feedback" + (kind ? " " + kind : "");
  }
  function resetCells() {
    cells.forEach((c) => { c.className = "mem-cell"; c.disabled = true; });
  }
  function shuffled(n) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ----- Ablauf der Runde ----- */
  function startRound() {
    clearTimers();
    phase = "show";
    startBtn.hidden = true;
    found = new Set();
    pattern = new Set(shuffled(total).slice(0, dots));
    resetCells();
    setStatus("MUSTER EINPRÄGEN …");

    let t = 400;
    for (let b = 0; b < blinks; b++) {
      later(() => pattern.forEach((i) => cells[i].classList.add("lit")), t);
      t += onMs;
      later(() => pattern.forEach((i) => cells[i].classList.remove("lit")), t);
      t += offMs;
    }
    later(() => {
      phase = "input";
      cells.forEach((c) => { c.disabled = false; });
      setStatus(`MUSTER EINGEBEN (0 / ${pattern.size})`);
    }, t);
  }

  function tap(i) {
    if (phase !== "input" || found.has(i)) return;

    if (pattern.has(i)) {
      found.add(i);
      cells[i].classList.add("ok");
      cells[i].disabled = true;
      if (found.size < pattern.size) { setStatus(`MUSTER EINGEBEN (${found.size} / ${pattern.size})`); return; }

      phase = "done";
      cells.forEach((c) => { c.disabled = true; });
      setStatus("CODE AKZEPTIERT ✔", "ok");
      vibrateOnce();
      later(() => ctx.next(), 1000);
      return;
    }

    // Falsche Taste: übersehene Tasten kurz zeigen, dann neues Muster oder zurück zum Anfang der Kombo
    phase = "fail";
    cells[i].classList.add("bad");
    pattern.forEach((p) => { if (!found.has(p)) cells[p].classList.add("miss"); });
    cells.forEach((c) => { c.disabled = true; });
    setStatus(S.failTo ? "ALARM – FALSCHER CODE! DIE SPERRE SETZT SICH ZURÜCK …" : "ALARM – FALSCHER CODE! NEUES MUSTER KOMMT …", "err");
    later(() => { if (!S.failTo || !ctx.goToId(S.failTo)) startRound(); }, 1900);
  }

  setStatus("BEREIT");
  if (S.autoStart) later(startRound, 700);

  return {
    destroy() {
      clearTimers();
      window.removeEventListener("resize", fitGrid);
      if (observer) observer.disconnect();
    },
    info: () => ({ type: "memory", phase, round, rounds, pattern: [...pattern], found: [...found], failTo: S.failTo || null })
  };
});

/* ======================================================================
   Modul „dialog“ – Aufgabe: Dialog in die richtige Reihenfolge bringen
   Jede Zeile gehört einer Person (who: 1 oder 2) und hat zwei Fassungen: sw (Schwäbisch) und de (Deutsch).
   Unten schaltet ein Umschalter zwischen beiden Fassungen um. Die Sätze lassen sich am Griff ziehen
   (Zeigereingabe, auch per Finger) oder mit den Pfeilen verschieben. „PRÜFEN“ vergleicht die Reihenfolge.
   Nach maxFails falschen Versuchen hintereinander werden alle Sätze neu gemischt.
   Felder: heading, speakers (Namen der beiden Personen), lines (in der RICHTIGEN Reihenfolge),
           solutions (weitere erlaubte Reihenfolgen als Listen von Zeilen-Nummern ab 0), maxFails, button, backTo
   ====================================================================== */
registerModule("dialog", (ctx) => {
  const S = ctx.step;
  const lines = S.lines || [];
  const n = lines.length;
  const speakers = S.speakers || ["PERSON 1", "PERSON 2"];
  const maxFails = S.maxFails ?? 3;
  const mainOrder = lines.map((_, i) => i);
  const solutions = [mainOrder, ...(S.solutions || [])];

  let lang = ctx.data.lang === "de" ? "de" : "sw";
  let fails = clamp(Number(ctx.data.fails) || 0, 0, maxFails - 1);
  let locked = false;
  let drag = null;
  let scrollTimer = 0;

  const timers = new Set();
  function later(fn, ms) {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  }

  const isSolution = (order) => solutions.some((s) => s.length === order.length && s.every((v, k) => v === order[k]));
  const bestMatch = (order) => Math.max(...solutions.map((s) => order.filter((v, k) => v === s[k]).length));
  function shuffledOrder() {
    let order;
    do {
      order = mainOrder.slice();
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    } while (n > 1 && isSolution(order));
    return order;
  }

  let order = Array.isArray(ctx.data.order) && ctx.data.order.length === n && !isSolution(ctx.data.order) ? ctx.data.order.slice() : shuffledOrder();

  /* ----- Oberfläche ----- */
  const topParts = [];
  if (S.backTo) {
    const back = h("button", "back", "‹ ZURÜCK");
    back.type = "button";
    back.addEventListener("click", () => ctx.goToId(S.backTo));
    topParts.push(back);
  }
  topParts.push(h("div", "dlg-title", S.heading || "DIALOG"));

  const failLeds = h("div", "dlg-fails");
  const list = h("ul", "dlg-list");
  const status = h("div", "feedback");
  status.setAttribute("role", "status");

  const nodes = lines.map((line, i) => {
    const li = h("li", "dlg-item");
    li.dataset.i = String(i);
    li.dataset.who = String(line.who);
    const handle = h("div", "dlg-handle", "⠿");
    handle.setAttribute("aria-label", "Zum Verschieben ziehen");
    const chip = h("span", "dlg-chip", speakers[line.who - 1] || `PERSON ${line.who}`);
    const text = h("span", "dlg-text");
    const up = h("button", "", "▲"); up.type = "button"; up.setAttribute("aria-label", "Nach oben");
    const down = h("button", "", "▼"); down.type = "button"; down.setAttribute("aria-label", "Nach unten");
    up.addEventListener("click", () => moveBy(li, -1));
    down.addEventListener("click", () => moveBy(li, 1));
    li.append(handle, h("div", "dlg-body", "", [chip, text]), h("div", "dlg-move", "", [up, down]));
    setupDrag(handle, li);
    return li;
  });

  const langSw = h("button", "", "SCHWÄBISCH"); langSw.type = "button";
  const langDe = h("button", "", "DEUTSCH"); langDe.type = "button";
  const langBar = h("div", "dlg-lang", "", [langSw, langDe]);
  langBar.setAttribute("role", "group");
  langBar.setAttribute("aria-label", "Sprache");
  const check = h("button", "go", S.button || "PRÜFEN");
  check.type = "button";

  ctx.root.append(h("div", "dlg-screen", "", [h("div", "dlg-top", "", topParts), failLeds, list, status, langBar, check]));

  /* ----- Anzeige ----- */
  function renderTexts() {
    nodes.forEach((li, i) => { li.querySelector(".dlg-text").textContent = lines[i][lang]; });
    langSw.classList.toggle("on", lang === "sw");
    langDe.classList.toggle("on", lang === "de");
  }
  function renderOrder() { list.append(...order.map((i) => nodes[i])); }
  function renderFails() {
    failLeds.replaceChildren(h("span", "", "FEHLVERSUCHE"), ...Array.from({ length: maxFails }, (_, i) => {
      const d = document.createElement("i");
      d.className = i < fails ? "on" : "";
      return d;
    }));
  }
  function setStatus(text, kind) {
    status.textContent = text;
    status.className = "feedback" + (kind ? " " + kind : "");
  }
  function save() {
    ctx.data.order = order.slice();
    ctx.data.fails = fails;
    ctx.data.lang = lang;
    ctx.save();
  }
  function syncOrder() { order = [...list.children].map((li) => Number(li.dataset.i)); }

  function setLang(next) { lang = next; renderTexts(); save(); }
  langSw.addEventListener("click", () => setLang("sw"));
  langDe.addEventListener("click", () => setLang("de"));

  /* ----- Verschieben: Pfeile ----- */
  function moveBy(li, dir) {
    if (locked) return;
    const other = dir < 0 ? li.previousElementSibling : li.nextElementSibling;
    if (!other) return;
    if (dir < 0) list.insertBefore(li, other); else list.insertBefore(other, li);
    syncOrder();
    save();
    li.scrollIntoView({ block: "nearest" });
  }

  /* ----- Verschieben: Ziehen am Griff ----- */
  function updateDrag() {
    if (!drag) return;
    const { li, grab, y } = drag;
    const desiredTop = y - grab - list.getBoundingClientRect().top + list.scrollTop;
    for (let guard = 0; guard < 24; guard++) {
      const prev = li.previousElementSibling, next = li.nextElementSibling;
      const center = desiredTop + li.offsetHeight / 2;
      if (prev && center < prev.offsetTop + prev.offsetHeight / 2) list.insertBefore(li, prev);
      else if (next && center > next.offsetTop + next.offsetHeight / 2) list.insertBefore(next, li);
      else break;
    }
    li.style.transform = `translateY(${desiredTop - li.offsetTop}px)`;
  }
  function autoScroll() {
    if (!drag) return;
    const r = list.getBoundingClientRect();
    if (drag.y < r.top + 44) list.scrollTop -= 12;
    else if (drag.y > r.bottom - 44) list.scrollTop += 12;
    updateDrag();
  }
  function endDrag(e) {
    if (!drag || (e && drag.id !== e.pointerId)) return;
    clearInterval(scrollTimer);
    drag.li.style.transform = "";
    drag.li.classList.remove("drag");
    drag = null;
    syncOrder();
    save();
  }
  function setupDrag(handle, li) {
    handle.addEventListener("pointerdown", (e) => {
      if (locked || drag || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* nicht überall möglich */ }
      drag = { li, id: e.pointerId, grab: e.clientY - li.getBoundingClientRect().top, y: e.clientY };
      li.classList.add("drag");
      scrollTimer = setInterval(autoScroll, 30);
      updateDrag();
    });
    handle.addEventListener("pointermove", (e) => {
      if (drag && drag.id === e.pointerId) { drag.y = e.clientY; updateDrag(); }
    });
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }

  /* ----- Prüfen ----- */
  function reshuffle() {
    order = shuffledOrder();
    fails = 0;
    renderOrder();
    renderFails();
    save();
    nodes.forEach((li) => { li.classList.remove("ok"); });
    list.scrollTop = 0;
    setStatus("NEU GEMISCHT – SORTIERT DEN DIALOG NOCH EINMAL");
  }

  function checkOrder() {
    if (locked) return;
    syncOrder();

    if (isSolution(order)) {
      locked = true;
      nodes.forEach((li) => li.classList.add("ok"));
      check.disabled = true;
      setStatus("DIALOG VOLLSTÄNDIG ✔", "ok");
      vibrateOnce();
      save();
      later(() => ctx.next(), 1400);
      return;
    }

    fails += 1;
    renderFails();
    if (fails >= maxFails) {
      locked = true;
      setStatus(`${maxFails}× HINTEREINANDER FALSCH – ALLE SÄTZE WERDEN NEU GEMISCHT …`, "err");
      later(() => { locked = false; reshuffle(); }, 1900);
    } else {
      setStatus(`NOCH NICHT RICHTIG – ${bestMatch(order)} VON ${n} SÄTZEN STEHEN AN DER RICHTIGEN STELLE`, "err");
    }
    save();
  }
  check.addEventListener("click", checkOrder);

  renderTexts();
  renderOrder();
  renderFails();
  setStatus("BRINGT DIE SÄTZE IN DIE RICHTIGE REIHENFOLGE");

  return {
    destroy() { timers.forEach(clearTimeout); timers.clear(); clearInterval(scrollTimer); },
    /* nur für die Debug-Seite */
    debugSolve() { order = mainOrder.slice(); renderOrder(); checkOrder(); },
    debugFail() { order = mainOrder.slice().reverse(); renderOrder(); checkOrder(); },
    info: () => ({ type: "dialog", lang, order: order.slice(), fails, maxFails, locked, lines: n })
  };
});
