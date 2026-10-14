"use strict";

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
