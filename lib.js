/* ==========================================================================
   lib.js – Hilfsfunktionen (DOM, Speicher, Sound, Geo-Mathe, Wake Lock)
   Wird als Erstes geladen und von allen anderen Skripten genutzt.
   ========================================================================== */

const $ = (id) => document.getElementById(id);

/** Kleiner DOM-Builder: h("div", {class:"x", text:"..."}, [children]) */
function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  [].concat(children).forEach((c) => node.append(c));
  return node;
}

/* ---------- Sicherer localStorage-Zugriff ---------- */

const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* z. B. privater Modus */ }
  }
};

/* ---------- Allgemeine Helfer ---------- */

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Vergleichs-Normalisierung: Groß-/Kleinschreibung, Leerzeichen, Umlaute, Satzzeichen egal */
function normalize(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function matchesAnswer(input, answer) {
  const wanted = [].concat(answer ?? []).map(normalize);
  const given = normalize(input);
  return given.length > 0 && wanted.includes(given);
}

/* ---------- Geo-Mathe ---------- */

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Peilung von Punkt 1 nach Punkt 2 in Grad (0 = Norden, im Uhrzeigersinn) */
function bearingDeg(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS_WORDS = ["Norden", "Nordosten", "Osten", "Südosten", "Süden", "Südwesten", "Westen", "Nordwesten"];
const compassWord = (deg) => COMPASS_WORDS[Math.round(deg / 45) % 8];

/** Kürzeste vorzeichenbehaftete Winkeldifferenz a - b in (-180, 180] */
const angleDiff = (a, b) => ((a - b + 540) % 360) - 180;

/* ---------- Sound (WebAudio, keine Dateien nötig) ---------- */

const SOUND_KEY = "alienRallye.sound";
let audioCtx = null;
let soundOn = store.get(SOUND_KEY) !== "off";

function getAudioCtx() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function beep(freq, start, dur, type = "square", vol = 0.06) {
  if (!soundOn) return;
  try {
    const ac = getAudioCtx();
    const t0 = ac.currentTime + start;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch (e) { /* Audio nicht verfügbar */ }
}

const sfx = {
  scan:    () => { for (let i = 0; i < 6; i++) beep(500 + i * 90, i * 0.12, 0.1, "sine"); },
  success: () => { [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.11, 0.18, "triangle", 0.09)); },
  error:   () => { beep(180, 0, 0.18, "sawtooth", 0.08); beep(120, 0.16, 0.28, "sawtooth", 0.08); },
  victory: () => { [392, 523, 659, 784, 659, 784, 1047, 1319].forEach((f, i) => beep(f, i * 0.14, 0.24, "triangle", 0.1)); },
  click:   () => beep(700, 0, 0.05, "square", 0.04),
  blip:    (freq = 880) => beep(freq, 0, 0.07, "sine", 0.05)
};

function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignorieren */ }
}

/* ---------- Screen Wake Lock: Display bleibt an ---------- */

let wakeLock = null;
let wakePending = false;

function setWakeStatus(status) {
  const el = $("wakeStatus");
  if (!el) return;
  el.dataset.state = status;
  el.title = {
    on: "Display-Sperre aktiv: Das Handy schaltet nicht ab.",
    off: "Display-Sperre inaktiv – tippe irgendwo, um sie zu aktivieren.",
    unsupported: "Dieser Browser unterstützt keine Display-Sperre. Bitte Display-Timeout in den Handy-Einstellungen verlängern!"
  }[status];
  el.textContent = status === "on" ? "◉ WACH" : status === "off" ? "○ WACH" : "⚠ WACH";
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) { setWakeStatus("unsupported"); return; }
  if (wakePending || (wakeLock && !wakeLock.released)) return;
  wakePending = true;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => setWakeStatus("off"));
    setWakeStatus("on");
  } catch (e) {
    setWakeStatus("off");
  } finally {
    wakePending = false;
  }
}

function initWakeLock() {
  requestWakeLock();
  // Der Lock geht verloren, wenn der Tab in den Hintergrund wechselt → neu anfordern
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestWakeLock();
  });
  // Manche Browser erlauben die Anforderung erst nach einer Nutzer-Geste
  ["click", "touchend"].forEach((ev) =>
    document.addEventListener(ev, () => { if (!wakeLock || wakeLock.released) requestWakeLock(); }, { passive: true })
  );
}
