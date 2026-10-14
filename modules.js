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
   Felder: heading, speakers (Namen der beiden Personen), showSpeakers (false = Namen ausblenden),
           lines (in der RICHTIGEN Reihenfolge), solutions (weitere erlaubte Reihenfolgen als Listen von
           Zeilen-Nummern ab 0), maxFails, button, backTo,
           texts (eigene Meldungen, siehe DIALOG_TEXTS), confirmDe (eigenes Bestätigungsfenster beim Wechsel zu Deutsch)
   Das Wechseln von Schwäbisch auf Deutsch fragt erst in einem eigenen Fenster nach; zurück geht es sofort.
   ====================================================================== */
const DIALOG_TEXTS = {
  failLabel: "FEHLVERSUCHE",
  wrong: "NOCH NICHT RICHTIG – {n} VON {total} SÄTZEN STEHEN AN DER RICHTIGEN STELLE",
  tooMany: "{max}× HINTEREINANDER FALSCH – ALLE SÄTZE WERDEN NEU GEMISCHT …",
  reshuffled: "NEU GEMISCHT – SORTIERT DEN DIALOG NOCH EINMAL",
  done: "DIALOG VOLLSTÄNDIG ✔"
};
const DIALOG_CONFIRM_DE = {
  title: "AUF DEUTSCH WECHSELN?",
  text: "Im Original ist der Dialog auf Schwäbisch. Auf Deutsch ist er leichter zu verstehen. Wirklich umschalten?",
  yes: "JA, AUF DEUTSCH",
  no: "ORIGINAL BEHALTEN"
};
registerModule("dialog", (ctx) => {
  const S = ctx.step;
  const lines = S.lines || [];
  const n = lines.length;
  const speakers = S.speakers || ["PERSON 1", "PERSON 2"];
  const maxFails = S.maxFails ?? 3;
  const T = { ...DIALOG_TEXTS, ...(S.texts || {}) };
  const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
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
    chip.hidden = S.showSpeakers === false;
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
    failLeds.replaceChildren(h("span", "", T.failLabel), ...Array.from({ length: maxFails }, (_, i) => {
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
  langDe.addEventListener("click", async () => {
    if (lang === "de") return;
    // Von Schwäbisch auf Deutsch: erst im eigenen Fenster nachfragen (zurück geht es ohne Nachfrage)
    const yes = await confirmBox({ ...DIALOG_CONFIRM_DE, ...(S.confirmDe || {}) });
    if (yes) setLang("de");
  });

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
    setStatus(T.reshuffled);
  }

  function checkOrder() {
    if (locked) return;
    syncOrder();

    if (isSolution(order)) {
      locked = true;
      nodes.forEach((li) => li.classList.add("ok"));
      check.disabled = true;
      setStatus(T.done, "ok");
      vibrateOnce();
      save();
      later(() => ctx.next(), 1400);
      return;
    }

    fails += 1;
    renderFails();
    if (fails >= maxFails) {
      locked = true;
      setStatus(fill(T.tooMany, { max: maxFails, n: bestMatch(order), total: n }), "err");
      later(() => { locked = false; reshuffle(); }, 1900);
    } else {
      setStatus(fill(T.wrong, { max: maxFails, n: bestMatch(order), total: n }), "err");
    }
    save();
  }
  check.addEventListener("click", checkOrder);

  renderTexts();
  renderOrder();
  renderFails();

  return {
    destroy() { timers.forEach(clearTimeout); timers.clear(); clearInterval(scrollTimer); },
    /* nur für die Debug-Seite */
    debugSolve() { order = mainOrder.slice(); renderOrder(); checkOrder(); },
    debugFail() { order = mainOrder.slice().reverse(); renderOrder(); checkOrder(); },
    info: () => ({ type: "dialog", lang, order: order.slice(), fails, maxFails, locked, lines: n })
  };
});

/* ======================================================================
   Modul „sky“ – Sternenhimmel: eine sichere Route von links nach rechts planen
   Ein Sternenhimmel aus mehreren Schichten (vorne bewegen sich die Sterne schneller, hinten langsamer – das
   ergibt beim seitlichen Wischen den Eindruck von Tiefe). Die Strecke hat links einen START und rechts ein ZIEL
   und ist an beiden Enden begrenzt. Dazwischen liegen Asteroiden und Kometen.
   Aufgabe: eine Route vom Start zum Ziel malen.
     - Das Raumschiff fliegt nur nach rechts, nie zurück (die Linie folgt dem Finger nur vorwärts).
     - Berührt die Linie ein Hindernis, bricht sie ab; „RÜCKGÄNGIG“ nimmt die letzten Meter zurück.
     - Die Route muss am START beginnen und kann nur an ihrer leuchtenden Spitze weitergemalt werden.
     - Am Ziel startet „SIMULATION STARTEN“ einen Probeflug (die Aliens fliegen noch nicht wirklich los).
   „NOCH EINMAL“ erzeugt eine neue Strecke für die Nächsten.
   Betriebsarten: FLIEGEN (Himmel bewegen: wischen, Pfeiltasten, Mausrad) und MALEN (Route zeichnen;
   am Bildschirmrand weiterziehen, um weiterzufliegen).
   Welt-Einheiten: die Bildschirmhöhe entspricht 1000 Einheiten, dadurch ist die Strecke auf jedem Gerät gleich.
   Felder: backTo, trackLength (Länge in Einheiten), gap (freie Durchflugbreite), shipRadius, undoLength
   ====================================================================== */
registerModule("sky", (ctx) => {
  const S = ctx.step;
  const TRACK = S.trackLength ?? 3400;
  const GAP = S.gap ?? 240;
  const SHIP_R = S.shipRadius ?? 14;
  const UNDO_LEN = S.undoLength ?? 160;
  const START_X = 90, START_ZONE = 190;      // Start: Linie bei 90, die Route muss links von 190 beginnen
  const GOAL_X = TRACK - 90;
  const WORLD_H = 1000;

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
  let cam = 0, camVel = 0, camSpeed = 0, lastCamPx = 0;    // Kamera in Welt-Einheiten
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
  const clampCam = () => { cam = clamp(cam, -40, Math.max(-40, TRACK + 40 - unitsWide())); };

  /* ----- Strecke mit Hindernissen ----- */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /** Erzeugt Asteroiden und Kometen: Jede „Wand“ aus Hindernissen lässt eine Lücke frei, deren Mitte
      zufällig wandert. Die Lückenmitten (gapPath) sind der garantierte Lösungsweg. */
  function makeField(seed) {
    const r = rng(seed);
    const obstacles = [];
    const gapPath = [{ x: START_X, y: 500 }];
    let gy = 500;
    const add = (x, y, rad) => {
      const comet = r() < 0.22;
      obstacles.push({
        x, y, r: rad, comet,
        rot: r() * 6.28, spin: (r() - 0.5) * 0.5,
        shape: Array.from({ length: 12 }, () => 0.82 + r() * 0.3),
        crater: [r() * 6.28, r() * 6.28],
        tail: 0.7 + r() * 0.5, dir: Math.PI + (r() - 0.5) * 1.2
      });
    };
    for (let x = 520; x < GOAL_X - 320; x += 330 + r() * 70) {
      gy = clamp(gy + (r() - 0.5) * 360, 270, 730);
      gapPath.push({ x, y: gy });
      for (const dir of [-1, 1]) {                       // oben (-1) und unten (+1) bis über den Rand hinaus auffüllen
        let edge = gy + dir * GAP / 2;
        for (let i = 0; i < 12; i++) {
          const rad = 55 + r() * 40;
          const cy = edge + dir * rad * 0.8;
          add(x + (r() - 0.5) * 50, cy, rad);
          edge = cy + dir * rad * 0.8;
          if ((dir < 0 && edge < -60) || (dir > 0 && edge > WORLD_H + 60)) break;
        }
      }
    }
    gapPath.push({ x: GOAL_X, y: gapPath[gapPath.length - 1].y });

    // Garantierter Lösungsweg: durch die Lückenmitte, dann im freien Streifen zwischen zwei Wänden senkrecht zur nächsten Lücke
    const solution = [{ x: 60, y: 500 }];
    for (let k = 1; k < gapPath.length - 1; k++) {
      const prev = gapPath[k - 1], cur = gapPath[k];
      const mid = (prev.x + cur.x) / 2;
      solution.push({ x: mid, y: prev.y }, { x: mid, y: cur.y }, { x: cur.x, y: cur.y });
    }
    const lastGap = gapPath[gapPath.length - 2];
    solution.push({ x: (lastGap.x + GOAL_X) / 2, y: lastGap.y }, { x: GOAL_X + 10, y: lastGap.y });
    return { seed, obstacles, gapPath, solution };
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
      if (w.x > START_ZONE) { flash("DIE ROUTE MUSS AM START (LINKS) BEGINNEN"); return; }
      route = [{ x: clamp(w.x, 10, START_ZONE), y: clamp(w.y, 14, WORLD_H - 14) }];
      length = 0; drag.active = true;
      if (hits(route[0].x, route[0].y)) { crashed = { ...route[0] }; }
      refreshUI();
    } else if (complete) {
      flash("ZIEL ERREICHT – SIMULATION STARTEN");
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
    phase = "draw"; mode = "draw"; cam = 0; camVel = 0;
    refreshUI();
  });

  sendBtn.addEventListener("click", () => {
    if (phase !== "draw" || !complete || crashed) return;
    const pts = route.slice();
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = cum[cum.length - 1];
    flight = { pts, cum, total, t: 0, dur: clamp(total / 380, 4, 10) };
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
    else if (ready) text = "ZIEL ERREICHT – SIMULATION STARTEN";
    else if (mode === "fly") text = "WISCHT SEITLICH ÜBER DIE STRECKE – LINKS IST DER START, RECHTS DAS ZIEL";
    else if (!route.length) text = "MALT VOM START (LINKS) ZUM ZIEL (RECHTS) – NUR NACH RECHTS, KEIN HINDERNIS BERÜHREN";
    else text = "MALT BEI DER LEUCHTENDEN SPITZE WEITER – ZUM ZIEL RECHTS";
    hint.textContent = flashText && performance.now() < flashUntil ? flashText : text;
  }

  /* ----- Bewegung ----- */
  function update(dt) {
    const keyDir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (keyDir && phase !== "flying") cam += (keyDir * 650 * dt) / s;
    if (!drag && Math.abs(camVel) > 2) { cam += camVel * dt; camVel *= Math.pow(0.05, dt); } else if (!drag) camVel = 0;

    // Malen: am Rand weiterfliegen, die Spitze folgt dem Finger
    if (drag && drag.active && mode === "draw") {
      if (drag.x < 70) cam -= ((70 - drag.x) * 9 * dt) / s;
      else if (drag.x > W - 70) cam += ((drag.x - (W - 70)) * 9 * dt) / s;
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

  /** Alles in Welt-Einheiten: Strecke, Hindernisse, Route */
  function drawWorld(t) {
    g.setTransform(dpr * s, 0, 0, dpr * s, -cam * s * dpr, oy * dpr);

    // Bereiche außerhalb der Strecke abdunkeln (Begrenzung links und rechts)
    g.fillStyle = "rgba(2, 3, 10, 0.78)";
    const vTop = -oy / s, vH = H / s;
    if (cam < 0) g.fillRect(cam, vTop, -cam, vH);
    if (cam + unitsWide() > TRACK) g.fillRect(TRACK, vTop, cam + unitsWide() - TRACK, vH);

    // Start- und Ziellinie
    g.lineWidth = 3; g.setLineDash([14, 12]);
    g.strokeStyle = "rgba(0, 255, 102, 0.8)";
    g.beginPath(); g.moveTo(START_X, 0); g.lineTo(START_X, WORLD_H); g.stroke();
    g.strokeStyle = complete ? "rgba(0, 255, 102, 1)" : "rgba(0, 240, 255, 0.8)";
    g.beginPath(); g.moveTo(GOAL_X, 0); g.lineTo(GOAL_X, WORLD_H); g.stroke();
    g.setLineDash([]);
    g.fillStyle = "rgba(0, 255, 102, 0.07)"; g.fillRect(START_X, 0, START_ZONE - START_X, WORLD_H);
    g.fillStyle = "rgba(0, 240, 255, 0.07)"; g.fillRect(GOAL_X, 0, TRACK - GOAL_X, WORLD_H);
    g.font = "bold 30px 'Courier New', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "rgba(0, 255, 102, 0.9)"; g.fillText("START", START_X + 50, 40);
    g.fillStyle = "rgba(0, 240, 255, 0.9)"; g.fillText("ZIEL", GOAL_X + 45, 40);
    g.font = "bold 44px 'Courier New', monospace";
    g.fillText("▶", START_X + 48, WORLD_H / 2 - 4);

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
    // Start der Route
    if (!route.length && phase === "draw" && mode === "draw") {
      g.strokeStyle = "rgba(0, 255, 102, 0.9)"; g.lineWidth = 3; g.setLineDash([10, 8]);
      g.beginPath(); g.arc(START_X + 50, WORLD_H / 2, 60, 0, 6.283); g.stroke(); g.setLineDash([]);
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
    g.save();
    g.translate(o.x, o.y);
    g.rotate(o.rot + t * 0.0001 * o.spin);
    g.beginPath();
    o.shape.forEach((k, i) => {
      const a = (i / o.shape.length) * 6.283;
      i ? g.lineTo(Math.cos(a) * o.r * k, Math.sin(a) * o.r * k) : g.moveTo(Math.cos(a) * o.r * k, Math.sin(a) * o.r * k);
    });
    g.closePath();
    const grad = g.createRadialGradient(-o.r * 0.3, -o.r * 0.3, o.r * 0.1, 0, 0, o.r);
    grad.addColorStop(0, "#2a3b36"); grad.addColorStop(1, "#0d1714");
    g.fillStyle = grad; g.fill();
    g.strokeStyle = "rgba(0, 255, 102, 0.55)"; g.lineWidth = 3; g.stroke();
    g.fillStyle = "rgba(0, 0, 0, 0.35)";
    o.crater.forEach((a, i) => { g.beginPath(); g.arc(Math.cos(a) * o.r * 0.35, Math.sin(a) * o.r * 0.35, o.r * (0.14 + i * 0.05), 0, 6.283); g.fill(); });
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
    /** malt eine gültige Route (den garantierten Lösungsweg) vom Start bis zum Ziel */
    debugDraw() {
      if (phase !== "draw") return;
      route = [{ x: 60, y: 500 }]; length = 0; crashed = null; complete = false; flashText = "";
      mode = "draw";
      field.solution.forEach((p) => advanceTo(p));
      refreshUI();
    },
    /** fährt geradeaus in das erste Hindernis (zum Testen der Kollision) */
    debugCrash() {
      if (phase !== "draw") return;
      route = [{ x: 60, y: 500 }]; length = 0; crashed = null; complete = false;
      mode = "draw";
      const target = field.obstacles.filter((o) => Math.abs(o.y - 500) < 140).sort((a, b) => a.x - b.x)[0] || field.obstacles[0];
      advanceTo({ x: target.x + target.r + 40, y: target.y });
      refreshUI();
    },
    /** prüft für viele Startwerte, dass der Lösungsweg lückenlos frei von Hindernissen ist (Anzahl der Fehler) */
    debugCheckFields(count = 100) {
      let bad = 0;
      const keep = field;
      for (let i = 0; i < count && !bad; i++) {
        field = makeField(1000 + i * 31);
        for (let k = 1; k < field.solution.length && !bad; k++) {
          const a = field.solution[k - 1], b = field.solution[k];
          const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
          for (let j = 0; j <= n; j++) if (hits(a.x + ((b.x - a.x) * j) / n, a.y + ((b.y - a.y) * j) / n)) { bad++; break; }
        }
      }
      field = keep;
      return bad;
    },
    info: () => ({
      type: "sky", phase, mode, length: Math.round(length), complete, crashed: !!crashed,
      head: route.length ? route[route.length - 1] : null, routePoints: route.length,
      cam: Math.round(cam), width: W, scale: s, track: TRACK, startX: START_X, startZone: START_ZONE, goalX: GOAL_X,
      obstacles: field.obstacles.length, seed: field.seed, gapPath: field.gapPath,
      starX: LAYERS.map((L, li) => mod(stars[li][0].u * W - cam * s * L.f, W))
    })
  };
});
