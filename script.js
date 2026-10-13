/* ==========================================================================
   ALIEN-RALLYE
   --------------------------------------------------------------------------
   NEUE STATION HINZUFÜGEN: Einfach ein weiteres Objekt in `stationsData`
   ergänzen (Reihenfolge im Array = Reihenfolge im Spiel). Die App passt
   Fortschrittsbalken, Zähler und Abschluss automatisch an.

   Felder:
     id        Nummer (nur zur Übersicht, die Reihenfolge bestimmt das Array)
     title     Name des Sektors
     story     Alien-Briefing (Zeilenumbruch mit \n möglich)
     type      'riddle' | 'gps' | 'qr'
     question  Die Aufgabe für den Spieler
     hint      Optionaler Tipp (wird per Button eingeblendet)
     answer    riddle: richtige Antwort (String oder Array mit Varianten)
               qr:     Text, der im QR-Code steckt (String oder Array)
               gps:    optional – Notfall-Code, falls GPS nicht funktioniert
     location  nur bei 'gps': { lat, lng, radius }  (radius in Metern)
     reward    { points, artifact: { icon, name } }
   ========================================================================== */

const stationsData = [
  {
    id: 1,
    title: "Sektor 1 – Landezone",
    story: "Unbekannte Flugobjekte sind über der Stadt gesichtet worden.\nDeine Aufgabe, Agent: Finde heraus, womit sie kommunizieren.",
    type: "riddle",
    question: "Ich habe Städte, aber keine Häuser. Ich habe Berge, aber keine Bäume. Ich habe Wasser, aber keine Fische. Was bin ich?",
    hint: "Du hast sie wahrscheinlich gerade in der Tasche – oder im Auto.",
    answer: ["karte", "landkarte", "eine karte", "stadtplan"],
    reward: { points: 100, artifact: { icon: "🛸", name: "Antriebskristall" } }
  },
  {
    id: 2,
    title: "Sektor 2 – Signalquelle",
    story: "Die Aliens haben einen Sender in der Nähe des Marktplatzes versteckt.\nPeile die Koordinaten an und bestätige deine Position.",
    type: "gps",
    question: "Begib dich zum Zielpunkt und tippe auf „Standort scannen“.",
    hint: "Folge dem Radar – der Zielpunkt liegt am zentralen Platz.",
    // TODO: Eigene Koordinaten eintragen (Rechtsklick in Google Maps → Koordinaten kopieren)
    location: { lat: 52.5219, lng: 13.4132, radius: 40 },
    // Notfall-Code, falls GPS ausfällt (kann auch weggelassen werden)
    answer: "notfall42",
    reward: { points: 150, artifact: { icon: "📡", name: "Signalverstärker" } }
  },
  {
    id: 3,
    title: "Sektor 3 – Datenknoten",
    story: "Ein verschlüsselter QR-Code enthält die Schwachstelle des Mutterschiffs.\nFinde den Code vor Ort und gib das Losungswort ein.",
    type: "qr",
    question: "Scanne den QR-Code an der Station und tippe das Losungswort ein.",
    hint: "Das Losungswort steht direkt unter dem QR-Code.",
    answer: "zenit",
    reward: { points: 200, artifact: { icon: "🔮", name: "Datenkern" } }
  },
  {
    id: 4,
    title: "Sektor 4 – Das Mutterschiff",
    story: "Letzter Schritt! Das Mutterschiff lädt seine Waffen.\nNur der richtige Abschaltcode kann die Invasion stoppen.",
    type: "riddle",
    question: "Was wird nasser, je mehr es trocknet?",
    hint: "Du benutzt es nach dem Duschen.",
    answer: ["handtuch", "ein handtuch", "das handtuch"],
    reward: { points: 300, artifact: { icon: "☄️", name: "Abschaltcode" } }
  }
];

/* ==========================================================================
   Ab hier: App-Logik
   ========================================================================== */

const STORAGE_KEY = "alienRallye.v1";
const SOUND_KEY = "alienRallye.sound";
const SCAN_DELAY_MS = 900;

const $ = (id) => document.getElementById(id);
const appEl = $("app");

/* ---------- Zustand & Speicherung ---------- */

function defaultState() {
  return { current: 0, score: 0, artifacts: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const current = Number.isInteger(s.current) ? s.current : 0;
    return {
      current: Math.min(Math.max(current, 0), stationsData.length),
      score: Number(s.score) || 0,
      artifacts: Array.isArray(s.artifacts) ? s.artifacts : []
    };
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* z. B. privater Modus */ }
}

let state = loadState();

/* ---------- Sound (per WebAudio simuliert, keine Dateien nötig) ---------- */

let audioCtx = null;
let soundOn = true;
try { soundOn = localStorage.getItem(SOUND_KEY) !== "off"; } catch (e) { /* ignorieren */ }

function beep(freq, start, dur, type = "square", vol = 0.06) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime + start;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch (e) { /* Audio nicht verfügbar */ }
}

const sfx = {
  scan:    () => { for (let i = 0; i < 6; i++) beep(500 + i * 90, i * 0.12, 0.1, "sine"); },
  success: () => { [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.11, 0.18, "triangle", 0.09)); },
  error:   () => { beep(180, 0, 0.18, "sawtooth", 0.08); beep(120, 0.16, 0.28, "sawtooth", 0.08); },
  victory: () => { [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.14, 0.22, "triangle", 0.1)); },
  click:   () => beep(700, 0, 0.05, "square", 0.04)
};

function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignorieren */ }
}

/* ---------- Helfer ---------- */

/** Kleiner DOM-Builder: h("div", {class:"x", text:"..."}, [children]) */
function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  [].concat(children).forEach((c) => node.append(c));
  return node;
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

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 15000, maximumAge: 0
    });
  });
}

/* ---------- Prüf-Logik pro Stationstyp ----------
   Jeder Checker gibt { ok: boolean, message: string } zurück.
   Neuen Typ hinzufügen? Einfach hier einen weiteren Eintrag ergänzen
   und in renderStation() ggf. das passende Eingabefeld bauen.           */

const checkers = {
  async riddle(station, input) {
    return matchesAnswer(input, station.answer)
      ? { ok: true }
      : { ok: false, message: "ZUGRIFF VERWEIGERT – falsche Antwort. Versuch es nochmal, Agent." };
  },

  async qr(station, input) {
    return matchesAnswer(input, station.answer)
      ? { ok: true }
      : { ok: false, message: "CODE UNGÜLTIG – der Datenknoten reagiert nicht." };
  },

  async gps(station, input) {
    // Notfall-Code hat Vorrang, falls eingegeben
    if (input && station.answer && matchesAnswer(input, station.answer)) return { ok: true };

    const { lat, lng, radius = 50 } = station.location;
    try {
      const pos = await getPosition();
      const dist = distanceMeters(pos.coords.latitude, pos.coords.longitude, lat, lng);
      if (dist <= radius) return { ok: true };
      return { ok: false, message: `SIGNAL SCHWACH – Zielpunkt noch ca. ${Math.round(dist)} m entfernt.` };
    } catch (err) {
      const denied = err && err.code === 1;
      return {
        ok: false,
        message: denied
          ? "ORTUNG BLOCKIERT – bitte Standortfreigabe im Browser erlauben."
          : "KEIN GPS-SIGNAL – geh nach draußen oder nutze den Notfall-Code."
      };
    }
  }
};

/* ---------- Rendering ---------- */

function updateHud() {
  const total = stationsData.length;
  const done = Math.min(state.current, total);
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("score").textContent = state.score;
  $("progressText").textContent = `SEKTOR ${Math.min(done + 1, total)} / ${total}`;
  if (done >= total) $("progressText").textContent = `ALLE ${total} SEKTOREN GESICHERT`;
  $("progressPct").textContent = `${pct}%`;
  $("progressFill").style.width = `${pct}%`;

  const box = $("artifacts");
  box.replaceChildren(...state.artifacts.map((a) => h("span", { text: a.icon, title: a.name })));
}

function render() {
  updateHud();
  appEl.replaceChildren();
  if (state.current >= stationsData.length) renderVictory();
  else renderStation(stationsData[state.current]);
}

const TYPE_LABELS = { riddle: "Rätsel", gps: "GPS-Ortung", qr: "QR-Scan" };

function renderStation(station) {
  const card = h("article", { class: "card" });

  card.append(
    h("div", { class: "tag-row" }, [
      h("span", { class: "tag", text: `Mission ${station.id}` }),
      h("span", { class: "tag green", text: TYPE_LABELS[station.type] || station.type })
    ]),
    h("h2", { text: station.title }),
    h("p", { class: "story", text: station.story }),
    h("div", { class: "task-label", text: "AUFGABE" }),
    h("p", { class: "question", text: station.question })
  );

  const feedback = h("p", { class: "feedback", role: "status" });
  const hintBox = h("div", { class: "hint-box", hidden: "" });
  hintBox.hidden = true;

  // Eingabefeld: bei GPS nur als optionaler Notfall-Code
  const needsInput = station.type !== "gps" || Boolean(station.answer);
  const input = needsInput
    ? h("input", {
        class: "input",
        type: "text",
        autocomplete: "off",
        autocapitalize: "off",
        autocorrect: "off",
        spellcheck: "false",
        enterkeyhint: "go",
        "aria-label": "Antwort",
        placeholder:
          station.type === "gps" ? "Notfall-Code (optional)" :
          station.type === "qr"  ? "Losungswort vom QR-Code" : "> Antwort eingeben…"
      })
    : null;

  const submitLabel = station.type === "gps" ? "Standort scannen" : station.type === "qr" ? "Code prüfen" : "Antwort senden";
  const submit = h("button", { class: "btn", type: "submit", text: submitLabel });

  const form = h("form", { novalidate: "" }, [input, submit].filter(Boolean));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = input ? input.value : "";

    if (station.type !== "gps" && !value.trim()) {
      feedback.className = "feedback err";
      feedback.textContent = "Bitte zuerst eine Eingabe machen.";
      input && input.focus();
      return;
    }

    submit.disabled = true;
    feedback.className = "feedback info";
    feedback.textContent = "";
    sfx.scan();
    showScanner(station.type === "gps" ? "ORTUNG LÄUFT…" : "ANALYSE LÄUFT…");

    let result;
    try {
      const [res] = await Promise.all([
        checkers[station.type](station, value),
        new Promise((r) => setTimeout(r, SCAN_DELAY_MS))
      ]);
      result = res;
    } catch (err) {
      result = { ok: false, message: "SYSTEMFEHLER – bitte erneut versuchen." };
    }
    hideScanner();
    submit.disabled = false;

    if (result.ok) {
      solveStation(station, card);
    } else {
      sfx.error();
      vibrate([80, 40, 80]);
      feedback.className = "feedback err";
      feedback.textContent = result.message;
      card.classList.remove("shake");
      void card.offsetWidth; // Animation neu starten
      card.classList.add("shake");
      if (input) { input.select(); input.focus(); }
    }
  });

  card.append(form, feedback);

  if (station.hint) {
    const hintBtn = h("button", {
      class: "btn ghost", type: "button", text: "Tipp anfordern",
      onclick: () => {
        sfx.click();
        hintBox.replaceChildren(h("b", { text: "TIPP: " }), station.hint);
        hintBox.hidden = false;
        hintBtn.remove();
      }
    });
    card.append(hintBtn, hintBox);
  }

  appEl.append(card);
}

function solveStation(station, card) {
  const reward = station.reward || { points: 0 };

  // Fortschritt sofort speichern
  state.current += 1;
  state.score += reward.points || 0;
  if (reward.artifact) state.artifacts.push(reward.artifact);
  saveState();

  sfx.success();
  vibrate([60, 30, 120]);
  updateHud();

  const isLast = state.current >= stationsData.length;
  const done = h("article", { class: "card success" }, [
    h("div", { class: "tag-row" }, [h("span", { class: "tag green", text: "Mission erfüllt" })]),
    h("h2", { text: `${station.title} gesichert` }),
    h("div", { class: "reward" }, [
      reward.artifact ? h("span", { class: "artifact-icon", text: reward.artifact.icon }) : "",
      h("div", { class: "big", text: `+${reward.points || 0} Punkte` }),
      reward.artifact ? h("div", { text: `Artefakt erhalten: ${reward.artifact.name}` }) : ""
    ]),
    h("button", {
      class: "btn cyan", type: "button",
      text: isLast ? "Zur Abschlussmeldung" : "Nächster Sektor",
      onclick: () => {
        if (isLast) sfx.victory(); else sfx.click();
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    })
  ]);

  appEl.replaceChildren(done);
}

function renderVictory() {
  const card = h("article", { class: "card victory success" }, [
    h("span", { class: "earth", text: "🌍" }),
    h("div", { class: "tag-row", style: "justify-content:center" }, [h("span", { class: "tag green", text: "Mission abgeschlossen" })]),
    h("h1", { text: "Erde erfolgreich vor den Aliens verteidigt!" }),
    h("p", { class: "story", text: "Das Mutterschiff zieht sich zurück. Die Menschheit ist gerettet – dank dir, Agent." }),
    h("div", { class: "reward" }, [
      h("div", { class: "big", text: `${state.score} Punkte` }),
      h("div", { text: "Gesammelte Artefakte:" }),
      h("div", { class: "artifacts", style: "margin-top:8px" },
        state.artifacts.map((a) => h("span", { text: a.icon, title: a.name })))
    ]),
    h("button", { class: "btn ghost", type: "button", text: "Rallye neu starten", onclick: resetGame })
  ]);
  appEl.append(card);
}

/* ---------- Scanner-Overlay ---------- */

function showScanner(text) {
  $("scannerText").textContent = text;
  $("scanner").hidden = false;
}
function hideScanner() { $("scanner").hidden = true; }

/* ---------- Steuerung ---------- */

function resetGame() {
  if (!confirm("Wirklich alles zurücksetzen? Dein Fortschritt geht verloren.")) return;
  state = defaultState();
  saveState();
  render();
  window.scrollTo({ top: 0 });
}

$("resetBtn").addEventListener("click", resetGame);

const soundBtn = $("soundBtn");
function updateSoundBtn() { soundBtn.classList.toggle("off", !soundOn); }
soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  try { localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off"); } catch (e) { /* ignorieren */ }
  updateSoundBtn();
  sfx.click();
});
updateSoundBtn();

/* ---------- Start ---------- */

render();

/* PWA: Service Worker registrieren, sobald sw.js vorhanden ist (siehe Anleitung)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}
*/
