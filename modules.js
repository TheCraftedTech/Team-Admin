/* ==========================================================================
   modules.js – die Module (jeweils eine eigene Oberfläche und Mechanik)
   --------------------------------------------------------------------------
   info      Seite zum Durchlesen (Inhalt aus einer Markdown-Datei)
   locate    Ortungs-Radar zu einem Ort, „WEITER“ erst am Ort
   password  Eingabefeld für ein Passwort (Text darüber aus Markdown)
   memory    Minispiel: Muster aus leuchtenden Tasten merken und nachtippen
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
  const button = h("button", "go", S.button || "WEITER");
  button.type = "button";
  button.addEventListener("click", () => ctx.next());

  ctx.root.append(h("div", "scroller", "", [h("div", "page", "", [content, button])]));
  fillMarkdown(content, S.md);

  return {
    info: () => ({ type: "info", md: S.md })
  };
});

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
   Man kommt nur weiter, wenn man am Ort ist: dann erscheint unten „WEITER“.
   ====================================================================== */
registerModule("locate", (ctx) => {
  const S = ctx.step;
  const radius = S.radius ?? SETTINGS.radius;
  const maxAcc = S.maxAccuracy ?? SETTINGS.maxAccuracy;
  const fixesNeeded = S.fixes ?? SETTINGS.fixes;

  /* ----- Oberfläche ----- */
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Radar");
  const distEl = h("div", "dist", "ENTFERNUNG: – – –");
  const noteEl = h("div", "note");
  const dotsEl = h("div", "dots");
  dotsEl.setAttribute("aria-hidden", "true");
  const nextBtn = h("button", "go", "WEITER ›");
  nextBtn.type = "button";
  nextBtn.hidden = true;

  ctx.root.append(
    h("main", "stage", "", [canvas]),
    h("footer", "bottom", "", [distEl, noteEl, dotsEl, nextBtn])
  );
  renderDots(dotsEl);

  /* ----- Logik: Entfernung, Ankunft ----- */
  let arrived = Boolean(ctx.data.arrived);   // eingerastet: bleibt, bis „WEITER“ gedrückt wird (auch nach Neuladen)
  let inside = 0;                            // aufeinanderfolgende Messungen im Radius
  let dist = null, brg = 0;
  let burst = 0;

  function render() {
    nextBtn.hidden = !arrived;
    if (arrived) setText(distEl, "DU BIST DA ✔");
    else setText(distEl, dist === null ? "ENTFERNUNG: – – –" : `ENTFERNUNG: ${formatMeters(dist)}`);
    const st = gpsStatus({ dist, radius, maxAcc });
    setText(noteEl, st.text);
    noteEl.classList.toggle("err", st.error);
  }

  function onPos() {
    if (pos) {
      dist = distanceMeters(pos.lat, pos.lng, S.lat, S.lng);
      brg = bearingDeg(pos.lat, pos.lng, S.lat, S.lng);
      if (!arrived) {
        // „Sehr genau“: nah genug, GPS genau genug und mehrere Messungen in Folge
        if (dist <= radius && pos.acc <= maxAcc) {
          inside += 1;
          if (inside >= fixesNeeded) {
            arrived = true;
            ctx.data.arrived = true;
            ctx.save();
            vibrateOnce();
            burst = 1;
          }
        } else {
          inside = 0;
        }
      }
    }
    render();
  }

  nextBtn.addEventListener("click", () => { if (arrived) ctx.next(); });
  const noteTimer = setInterval(render, 1000);   // Sekundenzähler und „Signal verloren“ aktuell halten
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
    info: () => ({ type: "locate", dist, arrived, radius, maxAcc, fixes: fixesNeeded, inside })
  };
});

/* ======================================================================
   Modul „memory“ – Minispiel „Störsender“: Muster merken und nachtippen
   Auf einem Raster (size × size) leuchten dots Tasten mehrmals auf. Danach tippt man genau diese
   Tasten an (Reihenfolge egal). Bei einem Fehler kommt dieselbe Runde mit neuem Muster.
   Nach rounds geschafften Runden geht es weiter.
   ====================================================================== */
registerModule("memory", (ctx) => {
  const S = ctx.step;
  const size = S.size ?? 5;
  const dots = S.dots ?? 5;
  const rounds = S.rounds ?? 3;
  const blinks = S.blinks ?? 2;
  const onMs = S.onMs ?? 500;
  const offMs = S.offMs ?? 280;
  const total = size * size;

  let solved = clamp(Number(ctx.data.solved) || 0, 0, rounds - 1);   // geschaffte Runden (bleibt nach Neuladen)
  let phase = "idle";                                                // idle | show | input | fail | done
  let pattern = new Set();
  let found = new Set();

  /* ----- Zeitgeber, die beim Verlassen des Schritts aufgeräumt werden ----- */
  const timers = new Set();
  function later(fn, ms) {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  }

  /* ----- Oberfläche ----- */
  const parts = [];
  if (S.md) {
    const content = h("div", "md");
    parts.push(content);
    fillMarkdown(content, S.md);
  }

  const title = h("div", "mem-title");
  const leds = h("div", "dots");
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
  const startBtn = h("button", "go", S.button || "STARTEN");
  startBtn.type = "button";
  startBtn.addEventListener("click", () => startRound());

  parts.push(h("div", "mem-box", "", [title, leds, grid, status]), startBtn);
  ctx.root.append(h("div", "scroller", "", [h("div", "page", "", parts)]));

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = "feedback" + (kind ? " " + kind : "");
  }
  function renderRounds() {
    setText(title, `RUNDE ${Math.min(solved + 1, rounds)} / ${rounds}`);
    if (leds.children.length !== rounds) leds.replaceChildren(...Array.from({ length: rounds }, () => document.createElement("i")));
    [...leds.children].forEach((d, i) => { d.className = i < solved ? "done" : i === solved ? "now" : ""; });
  }
  function resetCells() {
    cells.forEach((c) => { c.className = "mem-cell"; c.disabled = true; });
  }
  function shuffled(n) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ----- Ablauf einer Runde ----- */
  function startRound() {
    timers.forEach(clearTimeout);
    timers.clear();
    phase = "show";
    startBtn.hidden = true;
    found = new Set();
    pattern = new Set(shuffled(total).slice(0, dots));
    resetCells();
    renderRounds();
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
      setStatus(`MUSTER EINGEBEN (0 / ${dots})`);
    }, t);
  }

  function tap(i) {
    if (phase !== "input" || found.has(i)) return;

    if (pattern.has(i)) {
      found.add(i);
      cells[i].classList.add("ok");
      cells[i].disabled = true;
      if (found.size < dots) { setStatus(`MUSTER EINGEBEN (${found.size} / ${dots})`); return; }

      solved += 1;
      ctx.data.solved = solved;
      ctx.save();
      cells.forEach((c) => { c.disabled = true; });
      if (solved >= rounds) {
        phase = "done";
        renderRounds();
        setStatus("STÖRSENDER DEAKTIVIERT ✔", "ok");
        vibrateOnce();
        later(() => ctx.next(), 1100);
      } else {
        phase = "show";
        setStatus(`RUNDE ${solved} GESCHAFFT ✔`, "ok");
        later(startRound, 1300);
      }
      return;
    }

    // Falsche Taste: die übersehenen Tasten kurz zeigen, dann dieselbe Runde mit neuem Muster
    phase = "fail";
    cells[i].classList.add("bad");
    pattern.forEach((p) => { if (!found.has(p)) cells[p].classList.add("miss"); });
    cells.forEach((c) => { c.disabled = true; });
    setStatus("FALSCH – NEUES MUSTER KOMMT …", "err");
    later(startRound, 1700);
  }

  renderRounds();
  setStatus("BEREIT");

  return {
    destroy() { timers.forEach(clearTimeout); timers.clear(); },
    info: () => ({ type: "memory", phase, solved, rounds, pattern: [...pattern], found: [...found] })
  };
});
