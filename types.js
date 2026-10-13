/* ==========================================================================
   types.js – Die Station-Typen (jeder Typ = eigene Oberfläche & Mechanik)
   --------------------------------------------------------------------------
   Neuen Typ erstellen:
     registerStationType("meinTyp", (station, ctx) => { ... });

   Das `ctx`-Objekt (wird von script.js geliefert):
     ctx.body            Container, in den der Typ seine Oberfläche baut
     ctx.card            die Karte (für Animationen)
     ctx.solve()         Station erfolgreich gelöst → nächste Station
     ctx.fail()          Fehlversuch: Schüttel-Animation + Fehlerton
     ctx.progress()      gespeicherter Teil-Fortschritt dieser Station (Objekt)
     ctx.setProgress(p)  Teil-Fortschritt speichern (übersteht Neuladen)
     ctx.later(fn, ms)   setTimeout, der beim Verlassen der Station aufräumt
     ctx.every(fn, ms)   setInterval, ebenfalls mit Aufräumen
     ctx.onCleanup(fn)   eigene Aufräum-Funktion (Listener, GPS, Audio …)
     ctx.scan(text, ms)  Scanner-Overlay für kurze Zeit anzeigen
   ========================================================================== */

const stationTypes = {};
function registerStationType(name, fn) { stationTypes[name] = fn; }

/* ---------- Gemeinsame UI-Bausteine ---------- */

function makeFeedback() {
  const el = h("p", { class: "feedback", role: "status" });
  return {
    el,
    set(msg, kind = "info") { el.className = `feedback ${kind}`; el.textContent = msg; }
  };
}

/** Texteingabe + Button. onSubmit(value, feedback, input) wird bei nicht-leerer Eingabe aufgerufen. */
function answerForm({ placeholder, button = "Senden", inputmode, onSubmit }) {
  const fb = makeFeedback();
  const input = h("input", {
    class: "input", type: "text", autocomplete: "off", autocapitalize: "off",
    autocorrect: "off", spellcheck: "false", enterkeyhint: "go",
    "aria-label": placeholder, placeholder
  });
  if (inputmode) input.setAttribute("inputmode", inputmode);
  const btn = h("button", { class: "btn", type: "submit", text: button });
  const form = h("form", { novalidate: "" }, [input, btn]);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!input.value.trim()) { fb.set("Bitte zuerst eine Eingabe machen.", "err"); input.focus(); return; }
    onSubmit(input.value, fb, input, btn);
  });
  return { form, input, btn, fb };
}

/* ==========================================================================
   TYP 'riddle' – Briefing mit Dokumenten + Lösungswort (Station 1)
   ========================================================================== */
registerStationType("riddle", (st, ctx) => {
  if (Array.isArray(st.documents)) {
    ctx.body.append(
      h("ul", { class: "docs" }, st.documents.map((d) =>
        h("li", {}, [
          h("span", { class: "doc-icon", text: d.icon || "📄" }),
          h("div", {}, [h("b", { text: d.title }), h("span", { text: d.text })])
        ])
      ))
    );
  }

  const { form, input, fb } = answerForm({
    placeholder: "> Lösungswort eingeben…",
    button: "Antwort senden",
    async onSubmit(value, fb, input, btn) {
      btn.disabled = true;
      await ctx.scan("ANALYSE LÄUFT…", 800);
      btn.disabled = false;
      if (matchesAnswer(value, st.answer)) {
        ctx.solve();
      } else {
        ctx.fail();
        fb.set("ZUGRIFF VERWEIGERT – falsche Antwort. Versuch es nochmal, Agent.", "err");
        input.select();
      }
    }
  });
  ctx.body.append(form, fb.el);
});

/* ==========================================================================
   TYP 'radar' – GPS-Ortungsgerät (Station 2)
   Radar-Canvas, Richtungshinweise, Punkt-Linien-Anzeige, Puls je näher desto schneller.
   ========================================================================== */
registerStationType("radar", (st, ctx) => {
  const T = st.target;
  const radius = T.radius ?? 25;
  const range = T.range ?? 400;

  const canvas = h("canvas", { class: "radar-canvas", width: 600, height: 600, "aria-label": "Radar" });
  const g = canvas.getContext("2d");
  const elDist = h("div", { class: "ro-big", text: "– – –" });
  const elHeat = h("div", { class: "ro-heat", text: "KEIN SIGNAL" });
  const elDir = h("div", { class: "ro-dir", text: "Ortungsgerät noch nicht aktiv." });
  const elInfo = h("div", { class: "ro-info" });
  const fb = makeFeedback();
  const startBtn = h("button", { class: "btn cyan", type: "button", text: "Ortungsgerät aktivieren" });

  let pos = null;          // { dist, brg, acc }
  let heading = null;      // Blickrichtung des Geräts (Grad) – falls Kompass verfügbar
  let watchId = null;
  let raf = 0;
  let last = 0;
  let phase = 0;           // Puls-Phase 0..1
  let sweep = 0;
  let dashOff = 0;
  let started = false;

  /* ----- Sensoren ----- */
  function onOrientation(e) {
    let hd = null;
    if (typeof e.webkitCompassHeading === "number") hd = e.webkitCompassHeading;          // iOS
    else if (e.absolute && e.alpha !== null && e.alpha !== undefined) hd = (360 - e.alpha) % 360; // Android
    if (hd === null) return;
    heading = heading === null ? hd : (heading + angleDiff(hd, heading) * 0.25 + 360) % 360;
  }

  function listenOrientation() {
    window.addEventListener("deviceorientationabsolute", onOrientation, true);
    window.addEventListener("deviceorientation", onOrientation, true);
    ctx.onCleanup(() => {
      window.removeEventListener("deviceorientationabsolute", onOrientation, true);
      window.removeEventListener("deviceorientation", onOrientation, true);
    });
  }

  function onPosition(p) {
    const { latitude, longitude, accuracy } = p.coords;
    pos = {
      dist: distanceMeters(latitude, longitude, T.lat, T.lng),
      brg: bearingDeg(latitude, longitude, T.lat, T.lng),
      acc: accuracy
    };
    fb.set("", "info");
    updateReadout();
    if (pos.dist <= radius) { sfx.success(); ctx.solve(); }
  }

  function onPositionError(err) {
    if (err.code === 1) fb.set("ORTUNG BLOCKIERT – bitte Standortfreigabe im Browser erlauben.", "err");
    else if (err.code === 3) fb.set("Warte auf GPS-Signal … bitte unter freiem Himmel aufhalten.", "info");
    else fb.set("KEIN GPS-SIGNAL – geht ins Freie oder nutzt den Notfall-Code.", "err");
  }

  async function start() {
    if (started) return;
    started = true;
    startBtn.hidden = true;
    getAudioCtx(); // Audio per Nutzer-Geste entsperren (Puls-Töne)

    // iOS: Kompass-Zugriff muss in der Nutzer-Geste angefragt werden
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        if ((await DeviceOrientationEvent.requestPermission()) === "granted") listenOrientation();
      } catch (e) { /* ohne Kompass weiter */ }
    } else {
      listenOrientation();
    }

    if (!navigator.geolocation) {
      fb.set("Dieses Gerät unterstützt keine Ortung. Nutzt den Notfall-Code.", "err");
      return;
    }
    elDir.textContent = "Suche Signal …";
    watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
      enableHighAccuracy: true, maximumAge: 1000, timeout: 20000
    });
    ctx.onCleanup(() => navigator.geolocation.clearWatch(watchId));
  }
  startBtn.addEventListener("click", start);

  /* ----- Anzeige-Texte ----- */
  function relativeWord(rel) {
    if (rel < 22.5 || rel >= 337.5) return "geradeaus ⬆";
    if (rel < 67.5)  return "schräg rechts ↗";
    if (rel < 112.5) return "rechts ➡";
    if (rel < 157.5) return "schräg rechts hinten ↘";
    if (rel < 202.5) return "hinter euch – umdrehen ⬇";
    if (rel < 247.5) return "schräg links hinten ↙";
    if (rel < 292.5) return "links ⬅";
    return "schräg links ↖";
  }

  function updateReadout() {
    if (!pos) return;
    const d = pos.dist;
    elDist.textContent = d >= 1000 ? `${(d / 1000).toFixed(2)} km` : `${Math.round(d)} m`;

    const frac = d / range;
    const heat = frac > 1 ? "KALT" : frac > 0.5 ? "KÜHL" : frac > 0.2 ? "WARM" : frac > 0.08 ? "HEISS" : "GLÜHEND";
    elHeat.textContent = heat;
    elHeat.dataset.heat = heat;

    if (heading === null) {
      elDir.textContent = `Richtung: ${compassWord(pos.brg)} (Norden = oben)`;
    } else {
      const rel = (pos.brg - heading + 360) % 360;
      elDir.textContent = `Ziel ist ${relativeWord(rel)} · ${compassWord(pos.brg)}`;
    }
    elInfo.textContent = `GPS-Genauigkeit: ±${Math.round(pos.acc)} m` + (heading === null ? " · Kompass: aus" : " · Kompass: an");
  }

  // Kompass ändert sich öfter als das GPS → Text regelmäßig aktualisieren
  ctx.every(updateReadout, 500);

  /* ----- Zeichnen ----- */
  const C = 300, R = 280;

  function onPulse(frac) {
    sfx.blip(380 + (1 - frac) * 900);
    if (frac < 0.3) vibrate(25);
  }

  function draw(dt) {
    g.clearRect(0, 0, 600, 600);

    // Scheibe & Ringe
    g.fillStyle = "rgba(0, 24, 12, 0.6)";
    g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(0, 255, 102, 0.35)"; g.lineWidth = 2;
    for (let i = 1; i <= 4; i++) { g.beginPath(); g.arc(C, C, (R * i) / 4, 0, Math.PI * 2); g.stroke(); }
    g.beginPath();
    g.moveTo(C - R, C); g.lineTo(C + R, C); g.moveTo(C, C - R); g.lineTo(C, C + R);
    g.stroke();

    // Nordmarke (dreht sich mit dem Kompass)
    const north = heading === null ? 0 : -heading;
    g.fillStyle = "#00f0ff"; g.font = "bold 30px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("N", C + (R - 18) * Math.sin(toRad(north)), C - (R - 18) * Math.cos(toRad(north)));

    // Radar-Sweep
    sweep = (sweep + dt * 1.2) % (Math.PI * 2);
    g.lineWidth = 6;
    for (let i = 0; i < 32; i++) {
      const a = sweep - i * 0.03;
      g.strokeStyle = `rgba(0, 255, 102, ${0.32 * (1 - i / 32)})`;
      g.beginPath(); g.moveTo(C, C); g.lineTo(C + R * Math.sin(a), C - R * Math.cos(a)); g.stroke();
    }

    if (pos) {
      const frac = clamp(pos.dist / range, 0, 1);
      const rel = toRad((pos.brg - (heading ?? 0) + 360) % 360);
      const r = Math.max(16, R * 0.94 * Math.sqrt(frac));
      const tx = C + r * Math.sin(rel), ty = C - r * Math.cos(rel);
      const far = pos.dist > range;

      // Punkt-Linie zum Ziel (Punkte wandern schneller, je näher das Ziel ist)
      dashOff -= dt * (25 + 220 * (1 - frac));
      g.setLineDash([6, 12]); g.lineDashOffset = dashOff;
      g.strokeStyle = "rgba(0, 240, 255, 0.85)"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(C, C); g.lineTo(tx, ty); g.stroke();
      g.setLineDash([]);

      // Puls: je näher, desto schneller
      const period = 0.3 + 2.2 * frac;
      phase += dt / period;
      if (phase >= 1) { phase %= 1; onPulse(frac); }

      // Ziel-Ring + Punkt
      g.strokeStyle = `rgba(0, 255, 102, ${1 - phase})`; g.lineWidth = 4;
      g.beginPath(); g.arc(tx, ty, 12 + phase * 60, 0, Math.PI * 2); g.stroke();
      g.fillStyle = far ? "rgba(0, 240, 255, 0.55)" : "#00f0ff";
      g.shadowColor = "#00f0ff"; g.shadowBlur = 18;
      g.beginPath(); g.arc(tx, ty, 11 + (1 - phase) * 5, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
    } else if (started) {
      g.fillStyle = "rgba(0, 255, 102, 0.8)"; g.font = "bold 26px monospace";
      g.fillText("SUCHE SIGNAL …", C, C + 90);
    }

    // Eigener Standort (zeigt immer nach oben = Blickrichtung)
    g.fillStyle = "#00ff66"; g.shadowColor = "#00ff66"; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(C, C - 18); g.lineTo(C + 12, C + 13); g.lineTo(C - 12, C + 13); g.closePath(); g.fill();
    g.shadowBlur = 0;
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((t - last) / 1000, 0.1) : 0;
    last = t;
    draw(dt);
  }
  raf = requestAnimationFrame(frame);
  ctx.onCleanup(() => cancelAnimationFrame(raf));

  /* ----- Notfall-Code (falls GPS ausfällt) ----- */
  const parts = [canvas, h("div", { class: "radar-readout" }, [elDist, elHeat, elDir, elInfo]), startBtn, fb.el];

  if (st.answer) {
    const fallback = answerForm({
      placeholder: "Notfall-Code",
      button: "Code senden",
      onSubmit(value, fb2) {
        if (matchesAnswer(value, st.answer)) ctx.solve();
        else { ctx.fail(); fb2.set("CODE UNGÜLTIG.", "err"); }
      }
    });
    parts.push(h("details", { class: "fallback" }, [
      h("summary", { text: "GPS defekt? Notfall-Code verwenden" }),
      fallback.form, fallback.fb.el
    ]));
  }
  ctx.body.append(...parts);
});

/* ==========================================================================
   TYP 'memory' – Stromkasten-Minispiel (Station 3)
   Muster wird kurz gezeigt, danach aus dem Gedächtnis nachbauen.
   ========================================================================== */
registerStationType("memory", (st, ctx) => {
  const G = Object.assign({ cols: 4, rows: 5, dots: 6, showMs: 2500, maxAttempts: 3, lockoutSec: 20 }, st.game);
  const total = G.cols * G.rows;

  // Teil-Fortschritt (übersteht Neuladen): verbleibende Versuche & Sperre
  const prog = ctx.progress();
  if (typeof prog.attempts !== "number") ctx.setProgress({ attempts: G.maxAttempts, lockUntil: 0 });

  const leds = h("div", { class: "leds", "aria-label": "Verbleibende Versuche" });
  const status = h("p", { class: "mem-status", text: "SYSTEM BEREIT" });
  const bar = h("div", { class: "mem-timer" }, [h("div", { class: "mem-timer-fill" })]);
  const barFill = bar.firstChild;
  const cells = Array.from({ length: total }, (_, i) =>
    h("button", { class: "mem-cell", type: "button", "aria-label": `Punkt ${i + 1}`, disabled: true,
                  onclick: () => tap(i) })
  );
  const grid = h("div", { class: "mem-grid", style: `--cols:${G.cols}` }, cells);
  const startBtn = h("button", { class: "btn", type: "button", text: "Hack starten", onclick: () => startRound() });

  let phase = "idle";   // idle | show | input | fail | lock | done
  let pattern = new Set();
  let found = new Set();

  function renderLeds() {
    const left = ctx.progress().attempts;
    leds.replaceChildren(
      h("span", { class: "leds-label", text: "VERSUCHE" }),
      ...Array.from({ length: G.maxAttempts }, (_, i) => h("i", { class: i < left ? "led on" : "led" }))
    );
  }

  function clearCells() {
    cells.forEach((c) => { c.className = "mem-cell"; c.disabled = true; });
  }

  function setIdle(label = "Hack starten") {
    phase = "idle";
    clearCells();
    barFill.style.transition = "none"; barFill.style.width = "0%";
    status.textContent = "SYSTEM BEREIT";
    startBtn.textContent = label;
    startBtn.hidden = false;
  }

  function startRound() {
    getAudioCtx();
    phase = "show";
    startBtn.hidden = true;
    clearCells();
    pattern = new Set(shuffle([...Array(total).keys()]).slice(0, G.dots));
    found = new Set();
    pattern.forEach((i) => cells[i].classList.add("lit"));
    status.textContent = "MUSTER EINPRÄGEN …";
    sfx.scan();

    barFill.style.transition = "none"; barFill.style.width = "100%";
    void barFill.offsetWidth;
    barFill.style.transition = `width ${G.showMs}ms linear`; barFill.style.width = "0%";

    ctx.later(() => {
      cells.forEach((c) => { c.classList.remove("lit"); c.disabled = false; });
      phase = "input";
      status.textContent = `MUSTER NACHBAUEN (${found.size}/${pattern.size})`;
    }, G.showMs);
  }

  function tap(i) {
    if (phase !== "input" || found.has(i)) return;

    if (pattern.has(i)) {
      found.add(i);
      cells[i].classList.add("ok");
      cells[i].disabled = true;
      sfx.blip(520 + found.size * 110);
      status.textContent = `MUSTER NACHBAUEN (${found.size}/${pattern.size})`;
      if (found.size === pattern.size) {
        phase = "done";
        status.textContent = "ZUGRIFF GEWÄHRT";
        grid.classList.add("done");
        sfx.success();
        ctx.later(() => ctx.solve(), 900);
      }
      return;
    }

    // Falscher Punkt
    phase = "fail";
    cells[i].classList.add("bad");
    cells.forEach((c) => (c.disabled = true));
    pattern.forEach((p) => { if (!found.has(p)) cells[p].classList.add("miss"); });
    ctx.fail();
    const left = ctx.progress().attempts - 1;
    ctx.setProgress({ attempts: left });
    renderLeds();

    if (left <= 0) {
      status.textContent = "FEHLER – SYSTEM WIRD GESPERRT";
      ctx.later(() => {
        ctx.setProgress({ lockUntil: Date.now() + G.lockoutSec * 1000 });
        enterLock();
      }, 1400);
    } else {
      status.textContent = `FALSCH – NOCH ${left} VERSUCH${left === 1 ? "" : "E"}`;
      ctx.later(() => setIdle("Neuer Versuch"), 1500);
    }
  }

  function enterLock() {
    phase = "lock";
    clearCells();
    startBtn.hidden = true;
    const tick = () => {
      const remain = Math.ceil((ctx.progress().lockUntil - Date.now()) / 1000);
      if (remain <= 0) {
        clearInterval(timer);
        ctx.setProgress({ attempts: G.maxAttempts, lockUntil: 0 });
        renderLeds();
        setIdle("Neu starten");
        return;
      }
      status.textContent = `SYSTEM GESPERRT – NEUSTART IN ${remain} s`;
    };
    const timer = ctx.every(tick, 250);
    tick();
  }

  renderLeds();
  ctx.body.append(leds, status, bar, grid, startBtn);

  // Nach Neuladen: evtl. noch gesperrt?
  const lockUntil = ctx.progress().lockUntil || 0;
  if (lockUntil > Date.now()) enterLock();
  else if (lockUntil > 0 || ctx.progress().attempts <= 0) {
    ctx.setProgress({ attempts: G.maxAttempts, lockUntil: 0 });
    renderLeds();
  }
});

/* ==========================================================================
   TYP 'ordering' – Schwäbisches Text-/Audio-Puzzle (Station 4)
   Klick-Reihenfolge: Schnipsel antippen → landen in der Dialog-Liste.
   ========================================================================== */
registerStationType("ordering", (st, ctx) => {
  const items = st.items.map((it, i) => ({ id: i, text: typeof it === "string" ? it : it.text, audio: it.audio }));
  const n = items.length;

  // Gemischte Reihenfolge einmalig würfeln & speichern
  if (!Array.isArray(ctx.progress().mix)) {
    let mix;
    do { mix = shuffle(items.map((i) => i.id)); } while (n > 1 && mix.every((v, i) => v === i));
    ctx.setProgress({ mix, chosen: [] });
  }

  const poolEl = h("div", { class: "snippet-pool" });
  const listEl = h("ol", { class: "snippet-list" });
  const checkBtn = h("button", { class: "btn", type: "button", text: "Reihenfolge prüfen", onclick: check });
  const fb = makeFeedback();

  let player = null;
  function play(src) {
    try {
      if (player) player.pause();
      player = new Audio(src);
      player.play();
    } catch (e) { fb.set("Audio konnte nicht abgespielt werden.", "err"); }
  }
  ctx.onCleanup(() => { if (player) player.pause(); });

  function snippetButton(item, onTap, cls) {
    const wrap = h("div", { class: `snippet ${cls}` });
    wrap.append(h("button", { type: "button", class: "snippet-text", text: item.text, onclick: onTap }));
    if (item.audio) wrap.append(h("button", { type: "button", class: "snippet-play", "aria-label": "Anhören", text: "▶", onclick: () => play(item.audio) }));
    return wrap;
  }

  function update() {
    const { mix, chosen } = ctx.progress();
    const pool = mix.filter((id) => !chosen.includes(id));

    poolEl.replaceChildren(...pool.map((id) =>
      snippetButton(items[id], () => {
        sfx.blip(600 + chosen.length * 80);
        ctx.setProgress({ chosen: [...chosen, id] });
        fb.set("", "info");
        update();
      }, "pool")
    ));
    if (!pool.length) poolEl.append(h("p", { class: "muted", text: "Alle Schnipsel sind verteilt." }));

    listEl.replaceChildren(...Array.from({ length: n }, (_, k) => {
      const id = chosen[k];
      if (id === undefined) return h("li", { class: "slot empty", text: "…" });
      const li = h("li", { class: "slot" });
      li.append(snippetButton(items[id], () => {
        sfx.click();
        ctx.setProgress({ chosen: chosen.filter((c) => c !== id) });
        fb.set("", "info");
        update();
      }, "chosen"));
      return li;
    }));

    checkBtn.disabled = chosen.length < n;
  }

  function check() {
    const { chosen } = ctx.progress();
    const right = chosen.filter((id, k) => id === k).length;
    if (right === n) {
      listEl.classList.add("done");
      ctx.solve();
    } else {
      ctx.fail();
      fb.set(`${right} von ${n} Schnipseln stehen an der richtigen Stelle. Tippt einen gesetzten Schnipsel an, um ihn zurückzunehmen.`, "err");
    }
  }

  ctx.body.append(
    h("div", { class: "task-label", text: "DIALOG (von oben nach unten)" }), listEl,
    h("div", { class: "task-label", text: "SCHNIPSEL" }), poolEl,
    checkBtn, fb.el
  );
  update();
});

/* ==========================================================================
   TYP 'quiz' – Kunst-Quiz + Zahlencode (Station 5)
   ========================================================================== */
registerStationType("quiz", (st, ctx) => {
  const qs = st.questions || [];
  if (typeof ctx.progress().step !== "number") ctx.setProgress({ step: 0 });
  const wrap = h("div", { class: "quiz" });
  ctx.body.append(wrap);

  function show() {
    wrap.replaceChildren();
    const step = ctx.progress().step;
    if (step < qs.length) showQuestion(qs[step], step);
    else showCode();
  }

  function showQuestion(q, step) {
    let wrong = 0;
    const fb = makeFeedback();

    function accept() {
      sfx.success();
      fb.set("RICHTIG ✔", "ok");
      ctx.later(() => { ctx.setProgress({ step: step + 1 }); show(); }, 650);
    }
    function reject(msg) {
      wrong++;
      ctx.fail();
      let text = msg || "Nicht korrekt – schaut noch einmal genau hin.";
      if (wrong >= 2 && q.hint) text += `\nTIPP: ${q.hint}`;
      fb.set(text, "err");
    }

    wrap.append(
      h("div", { class: "quiz-head" }, [
        h("span", { class: "tag", text: `Frage ${step + 1} / ${qs.length}` }),
        h("div", { class: "mini-bar" }, [h("div", { class: "mini-fill", style: `width:${(step / (qs.length + 1)) * 100}%` })])
      ]),
      h("p", { class: "question", text: q.q })
    );

    if (q.type === "choice") {
      wrap.append(h("div", { class: "choices" }, q.options.map((opt) =>
        h("button", {
          class: "btn cyan", type: "button", text: opt,
          onclick: () => (matchesAnswer(opt, q.answer) ? accept() : reject())
        })
      )));
    } else {
      const numeric = q.type === "number" || q.type === "estimate";
      const { form } = answerForm({
        placeholder: q.type === "estimate" ? `Schätzung${q.unit ? " in " + q.unit : ""}` : numeric ? "Zahl eingeben" : "Antwort eingeben",
        button: "Bestätigen",
        inputmode: numeric ? "decimal" : undefined,
        onSubmit(value) {
          if (!numeric) return matchesAnswer(value, q.answer) ? accept() : reject();
          const num = parseFloat(value.replace(",", "."));
          if (Number.isNaN(num)) return reject("Bitte eine Zahl eingeben.");
          if (q.type === "number") return num === q.answer ? accept() : reject();
          const tol = q.tolerance ?? 0;
          if (Math.abs(num - q.answer) <= tol) return accept();
          reject(num < q.answer ? "Zu niedrig geschätzt – das Kunstwerk ist höher." : "Zu hoch geschätzt – das Kunstwerk ist niedriger.");
        }
      });
      wrap.append(form);
    }
    wrap.append(fb.el);
  }

  function showCode() {
    const C = st.code;
    const len = C.length || 3;
    const fb = makeFeedback();

    wrap.append(
      h("div", { class: "quiz-head" }, [
        h("span", { class: "tag green", text: "Finaler Code" }),
        h("div", { class: "mini-bar" }, [h("div", { class: "mini-fill", style: "width:90%" })])
      ]),
      h("p", { class: "question", text: `Berechnet den ${len}-stelligen Öffnungscode mit Hilfe der Hinweise:` }),
      h("div", { class: "clues" }, (C.clues || []).map((c) =>
        h("div", { class: "clue" }, [
          c.image
            ? h("img", { src: c.image, alt: c.title, loading: "lazy", class: "clue-img" })
            : h("div", { class: "clue-icon", text: c.icon || "❔" }),
          h("div", { class: "clue-text" }, [h("b", { text: c.title }), h("span", { text: c.text })])
        ])
      ))
    );

    const boxes = Array.from({ length: len }, (_, i) => {
      const b = h("input", {
        class: "code-box", type: "text", inputmode: "numeric", maxlength: "1",
        pattern: "[0-9]*", autocomplete: "off", "aria-label": `Ziffer ${i + 1}`
      });
      b.addEventListener("input", () => {
        b.value = b.value.replace(/\D/g, "").slice(-1);
        if (b.value && boxes[i + 1]) boxes[i + 1].focus();
      });
      b.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !b.value && boxes[i - 1]) boxes[i - 1].focus();
        if (e.key === "Enter") submit();
      });
      return b;
    });

    function submit() {
      const value = boxes.map((b) => b.value).join("");
      if (value.length < len) { fb.set(`Bitte alle ${len} Ziffern eingeben.`, "err"); return; }
      if (value === String(C.answer)) {
        fb.set("CODE AKZEPTIERT", "ok");
        ctx.later(() => ctx.solve(), 500);
      } else {
        ctx.fail();
        fb.set("CODE ABGELEHNT – prüft eure Berechnung.", "err");
        boxes.forEach((b) => (b.value = ""));
        boxes[0].focus();
      }
    }

    wrap.append(
      h("div", { class: "code-row" }, boxes),
      h("button", { class: "btn", type: "button", text: "Code eingeben", onclick: submit }),
      fb.el
    );
  }

  show();
});

/* ==========================================================================
   TYP 'audio' – Das Ohr: manipulierte Alien-Botschaft (Station 6)
   Die Botschaft liegt nur auf EINEM Stereokanal, der andere bekommt Rauschen.
   Mit audio.src → Audiodatei wird auf einen Kanal gelegt;
   ohne audio.src → Botschaft wird als Morse-Signal erzeugt (Demo).
   ========================================================================== */
const MORSE = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----."
};

registerStationType("audio", (st, ctx) => {
  const A = Object.assign({ channel: "left", noise: 0.12, unit: 0.14, freq: 620 }, st.audio);
  const pan = A.channel === "right" ? 1 : -1;
  const useFile = Boolean(A.src);

  let graph = null;     // WebAudio-Graph (wird beim ersten Abspielen gebaut)
  let live = [];        // aktuell laufende Quellen
  let fileEl = null;
  let fileNode = null;
  let raf = 0;
  let idleTimer = 0;

  const playBtn = h("button", { class: "btn cyan", type: "button", text: "▶ Signal abspielen" });
  const meterL = h("div", { class: "meter-fill" });
  const meterR = h("div", { class: "meter-fill" });
  const meters = h("div", { class: "meters" }, [
    h("div", { class: "meter" }, [h("span", { text: "L" }), h("div", { class: "meter-track" }, [meterL])]),
    h("div", { class: "meter" }, [h("span", { text: "R" }), h("div", { class: "meter-track" }, [meterR])])
  ]);
  const playsInfo = h("p", { class: "muted", text: "Noch nicht abgespielt." });
  let plays = 0;

  function ensureGraph() {
    if (graph) return graph;
    const ac = getAudioCtx();
    const mix = ac.createGain();
    const msgBus = ac.createGain();
    const noiseBus = ac.createGain();
    noiseBus.gain.value = A.noise;

    const msgPan = ac.createStereoPanner(); msgPan.pan.value = pan;
    const noisePan = ac.createStereoPanner(); noisePan.pan.value = -pan;
    msgBus.connect(msgPan).connect(mix);
    noiseBus.connect(noisePan).connect(mix);
    mix.connect(ac.destination);

    // Pegelanzeige je Kanal
    const split = ac.createChannelSplitter(2);
    const anL = ac.createAnalyser(); anL.fftSize = 256;
    const anR = ac.createAnalyser(); anR.fftSize = 256;
    mix.connect(split);
    split.connect(anL, 0);
    split.connect(anR, 1);

    graph = { ac, mix, msgBus, noiseBus, anL, anR };
    return graph;
  }

  function noiseSource(ac) {
    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass"; filter.frequency.value = 1800; filter.Q.value = 0.6;
    src.connect(filter).connect(graph.noiseBus);
    return src;
  }

  function scheduleMorse(t0, text) {
    const { ac, msgBus } = graph;
    const u = A.unit;
    const osc = ac.createOscillator(); osc.type = "sine"; osc.frequency.value = A.freq;
    const lfo = ac.createOscillator(); lfo.frequency.value = 7;
    const lfoGain = ac.createGain(); lfoGain.gain.value = 25;
    lfo.connect(lfoGain).connect(osc.frequency);          // "Alien"-Vibrato
    const gate = ac.createGain(); gate.gain.value = 0;
    osc.connect(gate).connect(msgBus);

    let t = t0;
    for (const word of text.toUpperCase().split(/\s+/)) {
      for (const ch of word) {
        const code = MORSE[ch];
        if (!code) continue;
        for (const sym of code) {
          const len = sym === "." ? u : 3 * u;
          gate.gain.setValueAtTime(0, t);
          gate.gain.linearRampToValueAtTime(0.9, t + 0.01);
          gate.gain.setValueAtTime(0.9, t + len - 0.01);
          gate.gain.linearRampToValueAtTime(0, t + len);
          t += len + u;
        }
        t += 2 * u;      // Buchstabenabstand (insgesamt 3 Einheiten)
      }
      t += 4 * u;        // Wortabstand (insgesamt 7 Einheiten)
    }
    osc.start(t0); lfo.start(t0);
    osc.stop(t + 0.1); lfo.stop(t + 0.1);
    live.push(osc, lfo);
    return t - t0;
  }

  function setIdle() {
    playBtn.textContent = plays ? "↻ Signal erneut abspielen" : "▶ Signal abspielen";
  }

  function stopAll() {
    clearTimeout(idleTimer);
    live.forEach((n) => { try { n.stop(); } catch (e) { /* schon gestoppt */ } });
    live = [];
    if (fileEl) { fileEl.pause(); fileEl.currentTime = 0; }
  }

  function play() {
    stopAll();
    const { ac, msgBus } = ensureGraph();
    const t0 = ac.currentTime + 0.1;
    const noise = noiseSource(ac);
    live.push(noise);
    plays++;
    playsInfo.textContent = `Signal ${plays}× empfangen.`;
    playBtn.textContent = "◼ Signal läuft …";

    if (useFile) {
      if (!fileEl) {
        fileEl = new Audio(A.src);
        fileNode = ac.createMediaElementSource(fileEl);
        fileNode.connect(msgBus);
        fileEl.addEventListener("ended", () => { stopAll(); setIdle(); });
      }
      fileEl.currentTime = 0;
      fileEl.play().catch(() => fb.set("Audiodatei konnte nicht geladen werden.", "err"));
      noise.start();
    } else {
      const dur = scheduleMorse(t0, A.morse || "SOS");
      noise.start(t0);
      noise.stop(t0 + dur + 0.4);
      idleTimer = setTimeout(setIdle, (dur + 0.6) * 1000);
    }
  }
  playBtn.addEventListener("click", play);

  // Pegelanzeige
  const buf = new Uint8Array(256);
  function level(an) {
    an.getByteTimeDomainData(buf);
    let m = 0;
    for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - 128));
    return m / 128;
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!graph) return;
    meterL.style.width = `${clamp(level(graph.anL) * 140, 0, 100)}%`;
    meterR.style.width = `${clamp(level(graph.anR) * 140, 0, 100)}%`;
  }
  raf = requestAnimationFrame(loop);

  ctx.onCleanup(() => {
    cancelAnimationFrame(raf);
    stopAll();
    if (graph) { try { graph.mix.disconnect(); } catch (e) { /* ignorieren */ } }
  });

  const { form, fb } = answerForm({
    placeholder: "> Entschlüsselte Botschaft…",
    button: "Botschaft senden",
    async onSubmit(value, fb, input, btn) {
      btn.disabled = true;
      await ctx.scan("DEKODIERUNG …", 800);
      btn.disabled = false;
      if (matchesAnswer(value, st.answer)) ctx.solve();
      else { ctx.fail(); fb.set("BOTSCHAFT UNGÜLTIG – hört noch einmal genau hin.", "err"); input.select(); }
    }
  });

  ctx.body.append(
    h("div", { class: "headphone-note", text: "🎧 Kopfhörer aufsetzen! Das Signal ist stereo-manipuliert." }),
    meters, playBtn, playsInfo
  );

  if (!useFile && A.showMorseTable !== false) {
    ctx.body.append(h("details", { class: "fallback" }, [
      h("summary", { text: "Morse-Tabelle (Dekodier-Hilfe)" }),
      h("div", { class: "morse-table" },
        Object.entries(MORSE).map(([k, v]) => h("span", {}, [h("b", { text: k }), ` ${v}`]))
      )
    ]));
  }

  ctx.body.append(form, fb.el);
});
