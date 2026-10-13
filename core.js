/* ==========================================================================
   core.js – Kern: Hilfsfunktionen, Spielstand, Dienste (Wake Lock, Kompass, GPS)
   und die Schritt-Steuerung. Die Module (modules.js) und die Inhalte (steps.js)
   greifen darauf zu. Geladen wird: steps.js → core.js → modules.js.
   ========================================================================== */
"use strict";

/* ======================================================================
   Hilfsfunktionen
   ====================================================================== */
const $ = (id) => document.getElementById(id);
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const angleDiff = (a, b) => ((a - b + 540) % 360) - 180;

/** Kleiner DOM-Builder: h("div", "klasse", "text", [kinder]) */
function h(tag, cls, text, children) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  (children || []).forEach((c) => n.append(c));
  return n;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

const formatMeters = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2).replace(".", ",")} km` : `${Math.round(m)} m`);

/** Text nur ändern, wenn er sich wirklich geändert hat (schont das Layout) */
function setText(el, text) { if (el.textContent !== text) el.textContent = text; }

/** Vergleich unabhängig von Groß-/Kleinschreibung, Leerzeichen, Umlauten und Satzzeichen */
function normalize(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
function matchesAnswer(input, answers) {
  const given = normalize(input);
  return given.length > 0 && [].concat(answers || []).map(normalize).includes(given);
}

function vibrateOnce() {
  try { if (navigator.vibrate) navigator.vibrate([120, 60, 220]); } catch (e) { /* Gerät ohne Vibration */ }
}

/* ======================================================================
   Spielstand (localStorage): aktueller Schritt + Daten je Schritt (z. B. „am Ort angekommen“)
   ====================================================================== */
const STORAGE_KEY = "radar.v3";   // reset.html leert den gesamten localStorage

function loadState() {
  const fresh = { index: 0, data: {} };
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!s) return fresh;
    return {
      index: Number.isInteger(s.index) ? clamp(s.index, 0, STEPS.length - 1) : 0,
      data: s.data && typeof s.data === "object" ? s.data : {}
    };
  } catch (e) { return fresh; }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* privater Modus */ }
}

let state = loadState();

/* ======================================================================
   Wake Lock – Display bleibt an
   ====================================================================== */
let wakeLock = null, wakePending = false;
async function requestWake() {
  if (!("wakeLock" in navigator)) return;
  if (wakePending || (wakeLock && !wakeLock.released)) return;
  wakePending = true;
  try { wakeLock = await navigator.wakeLock.request("screen"); }
  catch (e) { /* wird bei der nächsten Berührung erneut versucht */ }
  finally { wakePending = false; }
}

/* ======================================================================
   Kompass (Geräte-Ausrichtung)
   ----------------------------------------------------------------------
   Quellen, nach Priorität:
     1. AbsoluteOrientationSensor (Generic Sensor API, Chrome/Android)
     2. deviceorientationabsolute / deviceorientation (alpha, beta, gamma)
     3. iOS: webkitCompassHeading (+ Genauigkeit)
     4. GPS-Bewegungsrichtung (coords.heading), wenn man läuft
   Aus den Drehwinkeln werden die Geräteachsen in Welt-Koordinaten
   (x = Ost, y = Nord, z = oben) berechnet. Liegt das Handy flach, zeigt die
   Gerätespitze die Richtung, wird es aufrecht gehalten, die Rückseite.
   ====================================================================== */
let heading = null;          // Ergebnis: Blickrichtung in Grad (0 = Norden), null = unbekannt
let sensorHd = null, sensorAt = 0;     // letzter Kompasswert (geglättet)
let gpsHd = null, gpsAt = 0;           // Bewegungsrichtung laut GPS
let compassAcc = null;                 // iOS: Genauigkeit in Grad (-1 = unkalibriert)
let sensorApiActive = false;

function headingFromAxes(top, zAxis) {
  const flat = Math.abs(zAxis.z) > 0.6;                       // Display zeigt zum Himmel/Boden
  const v = flat ? top : { x: -zAxis.x, y: -zAxis.y };        // sonst: Rückseite des Geräts
  if (Math.hypot(v.x, v.y) < 1e-3) return null;
  return (deg(Math.atan2(v.x, v.y)) + 360) % 360;
}

function axesFromEuler(alpha, beta, gamma) {
  const a = rad(alpha), b = rad(beta), c = rad(gamma);
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(c), sg = Math.sin(c);
  return {
    top:   { x: -sa * cb,               y: ca * cb,                z: sb },
    zAxis: { x: ca * sg + sa * sb * cg, y: sa * sg - ca * sb * cg, z: cb * cg }
  };
}

function axesFromQuaternion(q) {
  const [x, y, z, w] = q;
  return {
    top:   { x: 2 * (x * y - z * w), y: 1 - 2 * (x * x + z * z), z: 2 * (y * z + x * w) },
    zAxis: { x: 2 * (x * z + y * w), y: 2 * (y * z - x * w),     z: 1 - 2 * (x * x + y * y) }
  };
}

function setSensorHeading(hd) {
  sensorHd = sensorHd === null ? hd : (sensorHd + angleDiff(hd, sensorHd) * 0.2 + 360) % 360;
  sensorAt = performance.now();
  resolveHeading();
}

/** Entscheidet, welche Quelle gerade gilt (Kompass → GPS-Richtung → keine) */
function resolveHeading() {
  const now = performance.now();
  if (sensorHd !== null && now - sensorAt < 3000) { heading = sensorHd; return; }
  if (gpsHd !== null && now - gpsAt < 8000) { heading = gpsHd; return; }
  heading = null;
}

function onOrientation(e) {
  if (sensorApiActive) return;                                  // Sensor-API hat Vorrang
  if (typeof e.webkitCompassHeading === "number") {             // iOS
    compassAcc = typeof e.webkitCompassAccuracy === "number" ? e.webkitCompassAccuracy : null;
    if (e.webkitCompassHeading >= 0) setSensorHeading(e.webkitCompassHeading);
    return;
  }
  if (!e.absolute || e.alpha == null || e.beta == null || e.gamma == null) return;
  const ax = axesFromEuler(e.alpha, e.beta, e.gamma);
  const hd = headingFromAxes(ax.top, ax.zAxis);
  if (hd !== null) setSensorHeading(hd);
}

function startOrientationSensor() {
  if (!("AbsoluteOrientationSensor" in window)) return;
  try {
    const sensor = new AbsoluteOrientationSensor({ frequency: 30, referenceFrame: "device" });
    sensor.addEventListener("reading", () => {
      if (!sensor.quaternion) return;
      const ax = axesFromQuaternion(sensor.quaternion);
      const hd = headingFromAxes(ax.top, ax.zAxis);
      if (hd === null) return;
      sensorApiActive = true;
      setSensorHeading(hd);
    });
    sensor.addEventListener("error", () => { sensorApiActive = false; });   // dann greifen die Events
    sensor.start();
  } catch (e) { /* nicht verfügbar / blockiert → Events nutzen */ }
}

let orientationListening = false;
function listenOrientation() {
  if (orientationListening) return;
  orientationListening = true;
  startOrientationSensor();
  window.addEventListener("deviceorientationabsolute", onOrientation, true);
  window.addEventListener("deviceorientation", onOrientation, true);
}

/* iOS fragt die Kompass-Freigabe nur nach einer Berührung ab. Wurde sie schon erteilt
   (z. B. über init.html), kommen die Events ohne weiteres. Sonst versuchen wir es still
   bei der ersten Berührung des Displays. */
function silentOrientationRequest() {
  const needs = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
  if (!needs) return;
  try {
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      DeviceMotionEvent.requestPermission().catch(() => {});
    }
    DeviceOrientationEvent.requestPermission().then(() => {}, () => {});
  } catch (e) { /* ohne Kompass weiter (GPS-Richtung als Reserve) */ }
}

/* ======================================================================
   GPS-Tracking (gemeinsam für alle Module)
   ====================================================================== */
let pos = null;           // { lat, lng, acc, t }
let watchIds = [];
let gpsError = "";        // Fehlermeldung (leer = alles in Ordnung)
let trackStart = Date.now();
let probeAt = 0;          // Zeitpunkt der laufenden Erst-Anfrage (0 = keine)

/** Statuszeile zum GPS. near = { dist, radius, maxAcc } (optional) für den Hinweis „noch ungenau“ */
function gpsStatus(near) {
  if (gpsError) return { text: gpsError, error: true };
  if (!pos) return { text: `SUCHE GPS-SIGNAL … ${Math.round((Date.now() - trackStart) / 1000)} s`, error: false };
  const age = (Date.now() - pos.t) / 1000;
  if (age > 10) return { text: `GPS-SIGNAL VERLOREN (${Math.round(age)} s) – BITTE INS FREIE`, error: false };
  if (near && near.dist !== null && near.dist <= near.radius * 3 && pos.acc > near.maxAcc) {
    return { text: `GPS NOCH UNGENAU (±${Math.round(pos.acc)} m) – BITTE WARTEN`, error: false };
  }
  if (compassAcc !== null && (compassAcc < 0 || compassAcc > 30)) return { text: "KOMPASS UNGENAU – HANDY IN EINER 8 SCHWENKEN", error: false };
  return { text: `GPS ±${Math.round(pos.acc)} m`, error: false };
}

/** Zwei Dauer-Abfragen: grob (kommt in Sekunden, auch in Gebäuden) und fein (echtes GPS, braucht Sicht zum Himmel) */
function beginWatching() {
  if (watchIds.length) return;
  watchIds = [
    navigator.geolocation.watchPosition(onPosition, onPositionError, { enableHighAccuracy: false, maximumAge: 15000, timeout: 30000 }),
    navigator.geolocation.watchPosition(onPosition, onPositionError, { enableHighAccuracy: true,  maximumAge: 0,     timeout: 60000 })
  ];
}

/** Zuerst EINE einzelne Anfrage (sie löst den Berechtigungs-Dialog aus – mehrere gleichzeitige Erst-Anfragen
    bringen Safari durcheinander), danach die Dauer-Abfragen. */
function startTracking() {
  if (watchIds.length) return;
  if (!navigator.geolocation) { gpsError = "DIESES GERÄT UNTERSTÜTZT KEINE ORTUNG"; notifyModule(); return; }
  if (probeAt && Date.now() - probeAt < 15000) return;
  if (!pos) trackStart = Date.now();
  probeAt = Date.now();
  navigator.geolocation.getCurrentPosition(
    (p) => { probeAt = 0; onPosition(p); beginWatching(); },
    (err) => { probeAt = 0; onPositionError(err); if (err.code !== 1) beginWatching(); },
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 60000 }
  );
  notifyModule();
}
function stopTracking() {
  if (navigator.geolocation) watchIds.forEach((id) => navigator.geolocation.clearWatch(id));
  watchIds = [];
}

/** Abfrage neu anstoßen – auch aus einer Berührung heraus (iOS zeigt den Dialog dann sicher) */
function restartTracking() {
  probeAt = 0;
  stopTracking();
  startTracking();
}

function onPosition(p) {
  const acc = p.coords.accuracy, now = Date.now();
  // Eine deutlich schlechtere (grobe) Messung überschreibt keine frische, genaue
  if (pos && now - pos.t < 6000 && acc > pos.acc * 1.2 + 5) return;
  gpsError = "";
  pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc, t: now };
  // Bewegungsrichtung laut GPS (nur beim Gehen verlässlich) – Reserve, falls kein Kompass da ist
  const { heading: gh, speed } = p.coords;
  if (typeof gh === "number" && !Number.isNaN(gh) && (speed || 0) > 0.8) { gpsHd = gh; gpsAt = performance.now(); }
  resolveHeading();
  notifyModule();
}

function onPositionError(err) {
  if (err.code === 1) {
    stopTracking();
    pos = null;
    gpsError = IS_IOS
      ? "STANDORT AUS – iPhone: Einstellungen → Datenschutz & Sicherheit → Ortungsdienste → Safari-Websites → „Beim Verwenden“"
      : "STANDORT BLOCKIERT – bitte in den Browser-Einstellungen für diese Seite erlauben";
  } else if (err.code === 2) {
    gpsError = "KEIN GPS-SIGNAL – ORTUNGSDIENSTE DES HANDYS EINSCHALTEN, INS FREIE GEHEN";
  }
  // code 3 (Zeitüberschreitung): GPS sucht weiter – die Statuszeile zählt die Sekunden mit
  notifyModule();
}

/* ======================================================================
   Module & Schritt-Steuerung
   ----------------------------------------------------------------------
   Ein Modul ist eine Funktion (ctx) => instanz. Sie baut ihre Oberfläche in ctx.root auf.
   ctx:       step (die Inhalte aus steps.js), index, root, data (gespeichert je Schritt),
              save(), next() (zum nächsten Schritt), goToId(id) (zu einem Schritt per id)
   instanz:   destroy()     aufräumen, wenn der Schritt verlassen wird
              onPosition()  optional: neue GPS-Daten sind da
              info()        optional: Zustand für die Debug-Seite
   ====================================================================== */
const MODULES = {};
function registerModule(type, factory) { MODULES[type] = factory; }

let current = null;       // { step, ctx, instance }

function notifyModule() {
  if (current && current.instance && typeof current.instance.onPosition === "function") current.instance.onPosition();
}

function showStep() {
  if (current && current.instance && typeof current.instance.destroy === "function") {
    try { current.instance.destroy(); } catch (e) { /* Aufräumen darf nie den Wechsel verhindern */ }
  }
  const view = $("view");
  view.replaceChildren();
  current = null;

  const step = STEPS[state.index];
  const factory = MODULES[step.type];
  if (!factory) {
    view.append(h("div", "note err", `Unbekanntes Modul „${step.type}“ in Schritt „${step.id}“.`));
    return;
  }

  if (!state.data[step.id]) state.data[step.id] = {};
  const ctx = {
    step,
    index: state.index,
    root: view,
    data: state.data[step.id],
    save: saveState,
    next() { if (state.index < STEPS.length - 1) goTo(state.index + 1); },
    /** Zu einem Schritt anhand seiner id springen (true, wenn es ihn gibt) */
    goToId(id) {
      const i = STEPS.findIndex((s) => s.id === id);
      if (i < 0) return false;
      goTo(i);
      return true;
    }
  };
  current = { step, ctx, instance: null };
  current.instance = factory(ctx) || {};
}

/** Zu einem beliebigen Schritt wechseln (die Module nutzen ctx.next(), die Debug-Seite goTo) */
function goTo(index) {
  state.index = clamp(index, 0, STEPS.length - 1);
  saveState();
  showStep();
}

/** Fortschrittspunkte (kein Text): ein Punkt je Schritt */
function renderDots(el) {
  if (el.children.length !== STEPS.length) el.replaceChildren(...STEPS.map(() => document.createElement("i")));
  [...el.children].forEach((d, i) => { d.className = i < state.index ? "done" : i === state.index ? "now" : ""; });
}

function startApp() {
  requestWake();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    requestWake();
    restartTracking();            // Nach Display-Sperre / App-Wechsel hängen die Abfragen oft fest
  });
  ["click", "touchend"].forEach((ev) =>
    document.addEventListener(ev, () => { if (!wakeLock || wakeLock.released) requestWake(); }, { passive: true }));

  listenOrientation();
  setInterval(resolveHeading, 500);   // Quelle wechseln, wenn der Kompass ausfällt

  // Erste Berührung: iOS-Kompass-Freigabe und – falls noch keine Position da ist – GPS-Abfrage neu anstoßen
  document.addEventListener("click", () => { silentOrientationRequest(); if (!pos) restartTracking(); }, { once: true });

  startTracking();
  try {
    navigator.permissions.query({ name: "geolocation" }).then((status) => {
      status.addEventListener("change", () => { if (status.state !== "denied") startTracking(); });
    });
  } catch (e) { /* Browser kennt keine Berechtigungs-Events */ }

  showStep();
}
