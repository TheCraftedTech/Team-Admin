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
   Modul „sky“ – Sternenhimmel: eine Route für das Raumschiff malen
   Ein Sternenhimmel aus mehreren Schichten: vorne bewegen sich die Sterne schneller, hinten langsamer –
   so entsteht beim seitlichen Wischen der Eindruck von Tiefe (Parallaxe). Zwei Betriebsarten unten:
   FLIEGEN (wischen, ziehen, Pfeiltasten oder Mausrad bewegen den Himmel) und MALEN (eine leuchtende Route
   zeichnen; am Bildschirmrand weiterziehen, um weiterzufliegen). „ROUTE SENDEN“ lässt das Raumschiff die
   Route abfliegen, danach geht es mit „WEITER“ oder, für die Nächsten, mit „NOCH EINMAL“ weiter.
   Felder: backTo (Schritt-ID für „‹ ZURÜCK“), minLength (Mindestlänge der Route in Pixeln)
   ====================================================================== */
registerModule("sky", (ctx) => {
  const S = ctx.step;
  const minLength = S.minLength ?? 500;

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

  const flyBtn = h("button", "", "FLIEGEN"); flyBtn.type = "button";
  const drawBtn = h("button", "", "MALEN"); drawBtn.type = "button";
  const modeBar = h("div", "sky-mode", "", [flyBtn, drawBtn]);
  const againBtn = h("button", "ghost", "NOCH EINMAL"); againBtn.type = "button";
  const sendBtn = h("button", "go", "ROUTE SENDEN"); sendBtn.type = "button";
  const nextBtn = h("button", "go", "WEITER ›"); nextBtn.type = "button"; nextBtn.hidden = true;
  const actions = h("div", "sky-actions", "", [againBtn, sendBtn, nextBtn]);

  ctx.root.append(h("div", "sky-screen", "", [canvas, h("div", "sky-top", "", topParts), h("div", "sky-bar", "", [modeBar, actions])]));

  /* ----- Zustand ----- */
  let W = 0, H = 0, dpr = 1;
  let cam = 0, camVel = 0, camSpeed = 0, lastCam = 0;      // Kamera (seitliche Verschiebung) und ihre Geschwindigkeit
  let mode = "fly";                                        // fly | draw
  let phase = "draw";                                      // draw | flying | done
  let strokes = [];                                        // gemalte Linien, Punkte in Welt-Koordinaten { x, y }
  let length = 0;                                          // Gesamtlänge der Route in Pixeln
  let particles = [];
  let shooting = null;
  let drag = null;
  let idle = true;                                         // solange noch nichts angefasst wurde, driftet der Himmel sanft
  let flight = null;
  let ufo = null;
  let raf = 0, last = 0, uiSig = "";
  const keys = { left: false, right: false };
  const g = canvas.getContext("2d");

  const mod = (a, n) => ((a % n) + n) % n;

  /* Sternenschichten: f = Parallaxe (vorne schnell, hinten langsam), n = Anzahl, r = Größe, a = Helligkeit */
  const LAYERS = [
    { f: 0.12, n: 90, r: 0.7, a: 0.45 },
    { f: 0.35, n: 70, r: 1.1, a: 0.65 },
    { f: 0.8, n: 45, r: 1.7, a: 0.85 },
    { f: 1.5, n: 22, r: 2.6, a: 1 }
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

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  window.addEventListener("resize", resize);

  /* ----- Route ----- */
  function newStroke(p) {
    const s = [p];
    s.minX = p.x; s.maxX = p.x;
    return s;
  }
  function addPoint(stroke, p) {
    const q = stroke[stroke.length - 1];
    length += Math.hypot(p.x - q.x, p.y - q.y);
    stroke.push(p);
    if (p.x < stroke.minX) stroke.minX = p.x;
    if (p.x > stroke.maxX) stroke.maxX = p.x;
  }
  const pointCount = () => strokes.reduce((n, s) => n + s.length, 0);

  function spark(x, y, power = 1) {
    if (particles.length > 260) return;
    const a = Math.random() * 6.28, v = (10 + Math.random() * 40) * power;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.8, c: Math.random() < 0.5 ? "0,240,255" : "0,255,102" });
  }

  /* ----- Eingabe ----- */
  const pt = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  canvas.addEventListener("pointerdown", (e) => {
    if (phase !== "draw" || drag) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* nicht überall möglich */ }
    const p = pt(e);
    idle = false;
    camVel = 0;
    drag = { id: e.pointerId, x: p.x, y: p.y, t: performance.now(), stroke: null };
    if (mode === "draw" && pointCount() < 4000) {
      drag.stroke = newStroke({ x: p.x + cam, y: p.y });
      strokes.push(drag.stroke);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const p = pt(e), now = performance.now();
    if (mode === "fly") {
      const dx = p.x - drag.x;
      cam -= dx;
      camVel = camVel * 0.6 + ((-dx / Math.max(1, now - drag.t)) * 1000) * 0.4;
    }
    drag.x = p.x; drag.y = p.y; drag.t = now;
    if (mode === "draw") extendStroke();
  });
  const endDrag = (e) => { if (drag && drag.id === e.pointerId) { drag = null; refreshUI(); } };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    idle = false;
    cam += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  }, { passive: false });

  function onKey(e, down) {
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = down;
    else if (k === "ArrowRight" || k === "d" || k === "D") keys.right = down;
    else return;
    idle = false;
  }
  const onKeyDown = (e) => onKey(e, true);
  const onKeyUp = (e) => onKey(e, false);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  /** Hängt dem aktuellen Strich einen Punkt an der Fingerposition an (läuft bei Bewegung und jedes Bild) */
  function extendStroke() {
    if (!drag || !drag.stroke) return;
    const p = { x: drag.x + cam, y: drag.y };
    const q = drag.stroke[drag.stroke.length - 1];
    if (Math.hypot(p.x - q.x, p.y - q.y) > 4 && pointCount() < 4000) {
      addPoint(drag.stroke, p);
      spark(p.x, p.y);
      refreshUI();
    }
  }

  /* ----- Betriebsart und Knöpfe ----- */
  function setMode(next) {
    if (phase !== "draw") return;
    mode = next;
    idle = false;
    refreshUI();
  }
  flyBtn.addEventListener("click", () => setMode("fly"));
  drawBtn.addEventListener("click", () => setMode("draw"));

  function reset() {
    strokes = []; length = 0; particles = []; flight = null; ufo = null; drag = null;
    phase = "draw"; mode = "draw";
    refreshUI();
  }
  againBtn.addEventListener("click", reset);
  nextBtn.addEventListener("click", () => ctx.next());

  function sendRoute() {
    if (phase !== "draw" || length < minLength) return;
    const pts = strokes.flat();
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = cum[cum.length - 1];
    flight = { pts, cum, total, t: 0, dur: clamp(total / 260, 3, 8) };
    phase = "flying";
    drag = null;
    refreshUI();
  }
  sendBtn.addEventListener("click", sendRoute);

  function sampleFlight(f, d) {
    let i = 1;
    while (i < f.cum.length - 1 && f.cum[i] < d) i++;
    const a = f.pts[i - 1], b = f.pts[i], span = f.cum[i] - f.cum[i - 1] || 1;
    const k = clamp((d - f.cum[i - 1]) / span, 0, 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  /** Texte und Knöpfe passend zum Zustand (nur wenn sich etwas geändert hat) */
  function refreshUI() {
    const ready = length >= minLength;
    const sig = [mode, phase, ready, strokes.length].join("|");
    if (sig === uiSig) return;
    uiSig = sig;

    flyBtn.classList.toggle("on", mode === "fly");
    drawBtn.classList.toggle("on", mode === "draw");
    flyBtn.disabled = drawBtn.disabled = phase !== "draw";
    sendBtn.hidden = phase !== "draw";
    sendBtn.disabled = !ready;
    nextBtn.hidden = phase !== "done";
    againBtn.disabled = phase === "flying" || (phase === "draw" && strokes.length === 0);

    let text;
    if (phase === "flying") text = "ROUTE WIRD ÜBERMITTELT …";
    else if (phase === "done") text = "ROUTE ÜBERMITTELT – DIE KARTE DER ALIENS IST AKTUALISIERT ✔";
    else if (mode === "fly") text = "WISCHT SEITLICH, UM DURCH DEN STERNENHIMMEL ZU FLIEGEN";
    else if (!strokes.length) text = "MALT EINE ROUTE FÜR DAS RAUMSCHIFF – AM RAND WEITERZIEHEN, UM WEITERZUFLIEGEN";
    else if (!ready) text = "ROUTE NOCH ZU KURZ – MALT WEITER";
    else text = "ROUTE BEREIT – SENDEN ODER WEITERMALEN";
    hint.textContent = text;
  }

  /* ----- Bewegung ----- */
  function update(dt, now) {
    // Kamera: Tasten, Auslaufen nach dem Wischen, sanftes Treiben am Anfang
    const keyDir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (keyDir && phase !== "flying") cam += keyDir * 650 * dt;
    if (!drag && Math.abs(camVel) > 2) { cam += camVel * dt; camVel *= Math.pow(0.05, dt); } else if (!drag) camVel = 0;
    if (idle && phase === "draw") cam += 16 * dt;

    // Malen: Punkte anhängen, am Rand weiterfliegen
    if (drag && drag.stroke && mode === "draw") {
      if (drag.x < 70) cam -= (70 - drag.x) * 9 * dt;
      else if (drag.x > W - 70) cam += (drag.x - (W - 70)) * 9 * dt;
      extendStroke();
    }

    // Flug des Raumschiffs entlang der Route; die Kamera folgt (so ziehen die Sterne vorbei)
    if (phase === "flying" && flight) {
      flight.t += dt;
      const k = clamp(flight.t / flight.dur, 0, 1);
      const eased = k * k * (3 - 2 * k);
      ufo = sampleFlight(flight, eased * flight.total);
      cam += (ufo.x - W * 0.4 - cam) * (1 - Math.exp(-dt * 4));
      spark(ufo.x, ufo.y, 1.4); spark(ufo.x, ufo.y, 1.4);
      if (k >= 1) {
        phase = "done";
        vibrateOnce();
        for (let i = 0; i < 40; i++) spark(ufo.x, ufo.y, 3);
        refreshUI();
      }
    }

    camSpeed = camSpeed * 0.8 + ((cam - lastCam) / Math.max(dt, 0.001)) * 0.2;
    lastCam = cam;

    particles.forEach((p) => { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    particles = particles.filter((p) => p.life < p.max);

    // gelegentlich eine Sternschnuppe
    if (!shooting && Math.random() < dt * 0.15) {
      shooting = { x: Math.random() * W, y: Math.random() * H * 0.4, vx: 380 + Math.random() * 220, vy: 120 + Math.random() * 120, life: 0 };
    }
    if (shooting) { shooting.life += dt; shooting.x += shooting.vx * dt; shooting.y += shooting.vy * dt; if (shooting.life > 0.9) shooting = null; }

    refreshUI();
  }

  /* ----- Zeichnen ----- */
  function drawSky(t) {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#02030c"); bg.addColorStop(1, "#050914");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    NEBULAE.forEach((n) => {
      const x = mod(n.u * W * 1.6 - cam * n.f, W * 1.6) - W * 0.3;
      const y = n.v * H, r = n.r * Math.max(W, H);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${n.c},${n.a})`); grad.addColorStop(1, `rgba(${n.c},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    });

    LAYERS.forEach((L, li) => {
      const streak = clamp(Math.abs(camSpeed) * L.f * 0.012, 0, 26);
      stars[li].forEach((s) => {
        const x = mod(s.u * W - cam * L.f, W);
        const y = s.v * H;
        const tw = 0.75 + 0.25 * Math.sin(t * 0.002 * (1 + li) + s.p);
        g.globalAlpha = L.a * tw;
        g.fillStyle = s.c;
        if (streak > 2) {
          g.strokeStyle = s.c; g.lineWidth = L.r;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sign(camSpeed) * streak, y); g.stroke();
        }
        g.beginPath(); g.arc(x, y, L.r, 0, 6.283); g.fill();
      });
    });
    g.globalAlpha = 1;

    if (shooting) {
      const a = 1 - shooting.life / 0.9;
      g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(shooting.x, shooting.y); g.lineTo(shooting.x - shooting.vx * 0.12, shooting.y - shooting.vy * 0.12); g.stroke();
    }
  }

  function drawRoute() {
    g.lineCap = "round"; g.lineJoin = "round";
    g.globalCompositeOperation = "lighter";
    const passes = [[16, "rgba(0, 240, 255, 0.10)"], [7, "rgba(0, 255, 140, 0.30)"], [2.6, "rgba(235, 255, 245, 0.95)"]];
    strokes.forEach((s) => {
      if (s.maxX - cam < -40 || s.minX - cam > W + 40) return;
      passes.forEach(([width, color]) => {
        g.lineWidth = width; g.strokeStyle = color;
        g.beginPath();
        s.forEach((p, i) => (i ? g.lineTo(p.x - cam, p.y) : g.moveTo(p.x - cam, p.y)));
        if (s.length === 1) g.lineTo(s[0].x - cam + 0.1, s[0].y);
        g.stroke();
      });
    });
    g.globalCompositeOperation = "source-over";

    // Startpunkt der Route
    const first = strokes[0] && strokes[0][0];
    if (first) {
      g.strokeStyle = "rgba(0, 240, 255, 0.9)"; g.lineWidth = 2;
      g.beginPath(); g.arc(first.x - cam, first.y, 9, 0, 6.283); g.stroke();
    }
  }

  function drawParticles() {
    g.globalCompositeOperation = "lighter";
    particles.forEach((p) => {
      const a = 1 - p.life / p.max;
      g.fillStyle = `rgba(${p.c},${a * 0.9})`;
      g.beginPath(); g.arc(p.x - cam, p.y, 1.2 + a * 2, 0, 6.283); g.fill();
    });
    g.globalCompositeOperation = "source-over";
  }

  function drawUfo(t) {
    if (!ufo) return;
    const x = ufo.x - cam, y = ufo.y;
    const glow = g.createRadialGradient(x, y, 0, x, y, 46);
    glow.addColorStop(0, "rgba(0, 255, 140, 0.45)"); glow.addColorStop(1, "rgba(0, 255, 140, 0)");
    g.fillStyle = glow;
    g.fillRect(x - 46, y - 46, 92, 92);
    g.save();
    g.translate(x, y);
    g.rotate(clamp(Math.sin(ufo.angle) * 0.35, -0.35, 0.35));
    g.fillStyle = "rgba(0, 240, 255, 0.65)";
    g.beginPath(); g.ellipse(0, -6, 10, 8, 0, Math.PI, 0); g.fill();
    g.fillStyle = "#b9cfc7";
    g.beginPath(); g.ellipse(0, 0, 24, 7.5, 0, 0, 6.283); g.fill();
    g.strokeStyle = "#00ff66"; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(0, 0, 24, 7.5, 0, 0, 6.283); g.stroke();
    for (let i = -1; i <= 1; i++) {
      g.fillStyle = (Math.floor(t / 180) + i) % 2 ? "#00f0ff" : "#00ff66";
      g.beginPath(); g.arc(i * 12, 1, 2, 0, 6.283); g.fill();
    }
    g.restore();
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const t = performance.now();
    const dt = last ? Math.min((t - last) / 1000, 0.1) : 0;
    last = t;
    if (!W || !H) { resize(); return; }
    update(dt, t);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSky(t);
    drawRoute();
    drawParticles();
    drawUfo(t);
  }

  refreshUI();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
    /* nur für die Debug-Seite und Tests: Zeit vorspulen (die Bewegung läuft sonst über die Bildwiederholung) */
    debugTick(seconds = 1) {
      for (let s = 0; s < seconds; s += 1 / 60) update(1 / 60, performance.now());
    },
    /* nur für die Debug-Seite: eine Beispiel-Route malen */
    debugDraw() {
      if (phase !== "draw") return;
      const pts = [{ x: 60 + cam, y: H * 0.5 }];
      strokes = [newStroke(pts[0])]; length = 0;
      for (let x = 66; x < W * 1.9; x += 6) addPoint(strokes[0], { x: x + cam, y: H * 0.5 + Math.sin(x / 90) * H * 0.18 });
      mode = "draw"; idle = false;
      refreshUI();
    },
    info: () => ({
      type: "sky", phase, mode, length: Math.round(length), minLength, strokes: strokes.length, cam: Math.round(cam),
      width: W, starX: LAYERS.map((L, li) => mod(stars[li][0].u * W - cam * L.f, W))   // erste Stern je Schicht (zeigt die Parallaxe)
    })
  };
});
