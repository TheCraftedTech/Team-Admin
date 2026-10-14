"use strict";

/* ======================================================================
   Modul „audio“ – die verzerrte Aufnahme der Aliens reparieren
   Die Aufnahme (src, eine Datei im Ordner content/) wird absichtlich „gestört“ abgespielt (distort): rückwärts, zu schnell
   und mit verbogenen Tiefen und Höhen. Mit RICHTUNG, TEMPO, TIEFEN und HÖHEN stellt man den Empfänger ein – alles wirkt
   sofort, auch beim Anhören, Vor- und Zurückspulen. Passen alle Regler, ist das Signal klar und „WEITER“ erscheint.
   Technik: Web Audio API (Puffer, Rückwärts-Kopie, playbackRate, zwei Equalizer-Filter) – läuft ohne Server im Browser.
   Wer einen Regler über das Ziel hinausdreht, verschlechtert das Signal wieder (die Anzeige sinkt).
   Felder: md (Text darüber), src (Audiodatei, am besten .mp3), distort ({ reverse, rate, bass, treble }, Standard
           { reverse: true, rate: 1.6, bass: 9, treble: -9 }), button,
           tolRate (erlaubte Abweichung beim Tempo, Standard 0.08), tolEq (beim Equalizer in dB, Standard 3)
   ====================================================================== */
registerModule("audio", (ctx) => {
  const S = ctx.step;
  const D = Object.assign({ reverse: true, rate: 1.6, bass: 9, treble: -9 }, S.distort);
  const TARGET = { reverse: D.reverse, rate: 1 / D.rate, bass: -D.bass, treble: -D.treble };
  const TOL_RATE = S.tolRate ?? 0.08, TOL_EQ = S.tolEq ?? 3;
  const knobs = { reverse: false, rate: 1, bass: 0, treble: 0 };

  /* ----- Oberfläche ----- */
  const mkBtn = (cls, label) => { const b = h("button", cls, label); b.type = "button"; return b; };
  const slider = (min, max, step, value, label, bipolar = false) => {
    const input = document.createElement("input");
    input.type = "range";
    input.className = "aud-range" + (bipolar ? " bipolar" : "");
    input.min = min; input.max = max; input.step = step; input.value = value;
    input.setAttribute("aria-label", label);
    return input;
  };

  const scope = document.createElement("canvas");
  scope.className = "aud-scope";
  scope.width = 600; scope.height = 140;
  scope.setAttribute("aria-hidden", "true");
  const meterFill = h("div", "aud-fill");
  const meterText = h("div", "aud-meter-text");
  const meter = h("div", "aud-meter", "", [h("div", "aud-bar", "", [meterFill]), meterText]);

  const backBtn = mkBtn("ghost", "⏪ 3 S");
  const playBtn = mkBtn("", "▶ ANHÖREN");
  const fwdBtn = mkBtn("ghost", "3 S ⏩");
  const transport = h("div", "aud-transport", "", [backBtn, playBtn, fwdBtn]);
  const seekBar = slider(0, 1000, 1, 0, "Position in der Aufnahme");
  const timeText = h("div", "aud-time", "0:00 / 0:00");

  const dirBtn = mkBtn("aud-dir", "");
  const rateVal = h("span", "aud-val"), bassVal = h("span", "aud-val"), trebleVal = h("span", "aud-val");
  const rateIn = slider(0.4, 2, 0.05, 1, "Tempo");
  const bassIn = slider(-15, 15, 1, 0, "Tiefen", true);
  const trebleIn = slider(-15, 15, 1, 0, "Höhen", true);
  const row = (name, val, input) => h("label", "aud-row", "", [h("span", "aud-name", name), input, val]);
  const knobBox = h("div", "aud-knobs", "", [
    dirBtn,
    row("TEMPO", rateVal, rateIn),
    row("TIEFEN", bassVal, bassIn),
    row("HÖHEN", trebleVal, trebleIn)
  ]);

  const status = h("div", "feedback");
  status.setAttribute("role", "status");
  const next = mkBtn("go", S.button || "WEITER");
  next.disabled = true;

  const parts = [];
  if (S.md) {
    const content = h("div", "md");
    parts.push(content);
    fillMarkdown(content, S.md);
  }
  parts.push(h("div", "aud-sticky", "", [scope, meter]), h("div", "aud-panel", "", [transport, seekBar, timeText]), knobBox, status, next);
  const page = h("div", "page", "", parts);
  ctx.root.append(h("div", "scroller", "", [page]));

  /* ----- Audio ----- */
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = null, bass = null, treble = null, analyser = null;
  let buffer = null, reversed = null;
  let src = null, playing = false, pos = 0, startAt = 0, startPos = 0;
  let solved = false, loadFailed = false;

  try {
    ac = new AC();
    bass = ac.createBiquadFilter(); bass.type = "lowshelf"; bass.frequency.value = 250;
    treble = ac.createBiquadFilter(); treble.type = "highshelf"; treble.frequency.value = 3000;
    analyser = ac.createAnalyser(); analyser.fftSize = 1024;
    bass.connect(treble); treble.connect(analyser); analyser.connect(ac.destination);
  } catch (e) {
    loadFailed = true;
    status.className = "feedback err";
    status.textContent = "DIESES GERÄT KANN KEINEN TON ERZEUGEN";
  }

  const effRate = () => knobs.rate * D.rate;
  const effReverse = () => D.reverse !== knobs.reverse;
  const duration = () => (buffer ? buffer.duration : 0);
  const position = () => (playing ? Math.min(duration(), startPos + (ac.currentTime - startAt) * effRate()) : pos);
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

  function reversedCopy(buf) {
    const out = ac.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const a = buf.getChannelData(c), b = out.getChannelData(c);
      for (let i = 0; i < a.length; i++) b[i] = a[a.length - 1 - i];
    }
    return out;
  }
  const decode = (data) => new Promise((resolve, reject) => {
    const p = ac.decodeAudioData(data, resolve, reject);
    if (p && p.catch) p.catch(reject);
  });
  if (ac) {
    fetch(`content/${S.src}`)
      .then((r) => { if (!r.ok) throw new Error("nicht gefunden"); return r.arrayBuffer(); })
      .then(decode)
      .then((b) => { buffer = b; reversed = reversedCopy(b); refresh(); })
      .catch(() => {
        loadFailed = true;
        status.className = "feedback err";
        status.textContent = "DIE AUFNAHME KONNTE NICHT GELADEN WERDEN";
      });
  }

  function stopSource() {
    if (!src) return;
    src.onended = null;
    try { src.stop(); } catch (e) { /* war schon zu Ende */ }
    src.disconnect();
    src = null;
  }
  function startSource() {
    if (!buffer) return;
    stopSource();
    const s = ac.createBufferSource();
    s.buffer = effReverse() ? reversed : buffer;
    s.playbackRate.value = effRate();
    s.connect(bass);
    s.onended = () => { if (src === s) { src = null; playing = false; pos = 0; refresh(); } };
    pos = clamp(pos, 0, Math.max(0, duration() - 0.02));
    s.start(0, pos);
    src = s; startAt = ac.currentTime; startPos = pos; playing = true;
  }
  function play() {
    if (!buffer) return;
    if (ac.state === "suspended") ac.resume();
    startSource();
    refresh();
  }
  function pause() {
    pos = position();
    playing = false;
    stopSource();
    refresh();
  }
  function seek(t) {
    pos = clamp(t, 0, duration());
    if (playing) startSource();
    refresh();
  }

  /* ----- Regler ----- */
  function quality() {
    const near = (err, tol, span) => (err <= tol ? 1 : clamp(1 - (err - tol) / span, 0, 0.9));
    const parts4 = [
      knobs.reverse === TARGET.reverse ? 1 : 0,
      near(Math.abs(Math.log2(knobs.rate / TARGET.rate)), Math.log2(1 + TOL_RATE / TARGET.rate), 0.6),
      near(Math.abs(knobs.bass - TARGET.bass), TOL_EQ, 10),
      near(Math.abs(knobs.treble - TARGET.treble), TOL_EQ, 10)
    ];
    const ok = parts4.every((p) => p === 1);
    return { value: parts4.reduce((a, b) => a + b, 0) / 4, ok };
  }

  function applyKnobs(rebase = true) {
    if (ac) {
      bass.gain.value = D.bass + knobs.bass;
      treble.gain.value = D.treble + knobs.treble;
      if (playing && rebase) {
        startPos = position(); startAt = ac.currentTime;
        src.playbackRate.value = effRate();
      }
    }
    refresh();
  }
  rateIn.addEventListener("input", () => { knobs.rate = Number(rateIn.value); applyKnobs(); });
  bassIn.addEventListener("input", () => { knobs.bass = Number(bassIn.value); applyKnobs(); });
  trebleIn.addEventListener("input", () => { knobs.treble = Number(trebleIn.value); applyKnobs(); });
  dirBtn.addEventListener("click", () => {
    knobs.reverse = !knobs.reverse;
    if (playing) { pos = position(); startSource(); }
    applyKnobs(false);
  });
  playBtn.addEventListener("click", () => (playing ? pause() : play()));
  backBtn.addEventListener("click", () => seek(position() - 3));
  fwdBtn.addEventListener("click", () => seek(position() + 3));
  seekBar.addEventListener("input", () => seek((Number(seekBar.value) / 1000) * duration()));
  next.addEventListener("click", () => ctx.next());

  /** färbt die Bahn eines Reglers bis zum Griff ein (bei Tiefen/Höhen ab der Mitte) */
  function paintRange(input) {
    const pct = ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
    const from = input.classList.contains("bipolar") ? Math.min(50, pct) : 0;
    const to = input.classList.contains("bipolar") ? Math.max(50, pct) : pct;
    input.style.setProperty("--a", `${from}%`);
    input.style.setProperty("--b", `${to}%`);
  }

  const sgn = (n) => (n > 0 ? "+" : "") + n;
  function refresh() {
    const q = quality();
    if (q.ok && !solved) { solved = true; vibrateOnce(); }
    const pct = Math.round(q.value * 100);
    meterFill.style.width = `${pct}%`;
    meterFill.classList.toggle("clear", solved);
    meterText.textContent = solved ? "SIGNAL KLAR ✔" : `SIGNAL ${pct} %`;
    dirBtn.textContent = knobs.reverse ? "RICHTUNG: RÜCKWÄRTS ◀" : "RICHTUNG: VORWÄRTS ▶";
    dirBtn.classList.toggle("on", knobs.reverse);
    rateVal.textContent = `×${knobs.rate.toFixed(2).replace(".", ",")}`;
    bassVal.textContent = `${sgn(knobs.bass)} DB`;
    trebleVal.textContent = `${sgn(knobs.treble)} DB`;
    playBtn.textContent = playing ? "❚❚ PAUSE" : "▶ ANHÖREN";
    playBtn.disabled = !buffer;
    backBtn.disabled = fwdBtn.disabled = seekBar.disabled = !buffer;
    next.disabled = !solved;
    const p = position();
    timeText.textContent = `${fmt(p)} / ${fmt(duration())}`;
    if (!seekBar.matches(":active")) seekBar.value = duration() ? Math.round((p / duration()) * 1000) : 0;
    [seekBar, rateIn, bassIn, trebleIn].forEach(paintRange);
    if (!loadFailed) {
      status.className = solved ? "feedback ok" : "feedback";
      status.textContent = !buffer ? "AUFNAHME WIRD GELADEN …"
        : solved ? "DIE ANTWORT DER ALIENS IST KLAR ZU VERSTEHEN"
        : playing ? "STELLT DAS SIGNAL SO EIN, DASS ES KLAR WIRD" : "TIPPT AUF „ANHÖREN“ UND STELLT DAS SIGNAL EIN";
    }
  }

  /* ----- Anzeige: Wellenform, die mit besserem Signal ruhiger wird ----- */
  const g = scope.getContext("2d");
  const data = analyser ? new Uint8Array(analyser.fftSize) : null;
  function drawScope() {
    const w = scope.width, hgt = scope.height;
    g.clearRect(0, 0, w, hgt);
    g.strokeStyle = "rgba(0, 255, 102, 0.15)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, hgt / 2); g.lineTo(w, hgt / 2); g.stroke();
    if (analyser && playing) analyser.getByteTimeDomainData(data); else if (data) data.fill(128);
    const noise = solved ? 0 : (1 - quality().value) * 26;
    g.strokeStyle = solved ? "#00ff66" : "#00f0ff"; g.lineWidth = 2.5;
    g.shadowColor = g.strokeStyle; g.shadowBlur = 8;
    g.beginPath();
    for (let i = 0; i < w; i += 3) {
      const v = data ? (data[Math.floor((i / w) * data.length)] - 128) / 128 : 0;
      const y = hgt / 2 + v * hgt * 0.9 + (playing || noise > 12 ? (Math.random() - 0.5) * noise : 0);
      i ? g.lineTo(i, y) : g.moveTo(i, y);
    }
    g.stroke();
    g.shadowBlur = 0;
  }
  const timer = setInterval(() => { drawScope(); if (playing) refresh(); }, 70);
  applyKnobs();

  return {
    destroy() {
      clearInterval(timer);
      stopSource();
      if (ac && ac.state !== "closed") ac.close().catch(() => {});
    },
    /* nur für die Debug-Seite und Tests */
    debugSolve() {
      Object.assign(knobs, { reverse: TARGET.reverse, rate: Math.round(TARGET.rate * 20) / 20, bass: TARGET.bass, treble: TARGET.treble });
      rateIn.value = knobs.rate; bassIn.value = knobs.bass; trebleIn.value = knobs.treble;
      if (playing) { pos = position(); startSource(); }
      applyKnobs(false);
    },
    debugScramble() {
      Object.assign(knobs, { reverse: !TARGET.reverse, rate: 1.5, bass: 10, treble: -10 });
      rateIn.value = knobs.rate; bassIn.value = knobs.bass; trebleIn.value = knobs.treble;
      applyKnobs(false);
    },
    debugPlay: play,
    debugPause: pause,
    info: () => ({
      type: "audio", ready: !!buffer, failed: loadFailed, playing, pos: position(), duration: duration(),
      knobs: { ...knobs }, target: { ...TARGET }, effReverse: effReverse(), effRate: effRate(),
      quality: Math.round(quality().value * 100), solved
    })
  };
});
