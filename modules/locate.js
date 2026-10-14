"use strict";

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
