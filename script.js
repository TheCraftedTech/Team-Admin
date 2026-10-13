/* ==========================================================================
   script.js – Spiel-Engine: Zustand, Speicherung, Rendering, Ablauf
   --------------------------------------------------------------------------
   Lade-Reihenfolge (siehe index.html):
     lib.js → stations.js → types.js → script.js
   Inhalte der Stationen:  stations.js
   Oberflächen & Mechaniken: types.js
   ========================================================================== */

const STORAGE_KEY = "alienRallye.v2";
const SCAN_DELAY_MS = 900;
const params = new URLSearchParams(location.search);
const DEBUG = params.has("debug");

const appEl = $("app");

/* ---------- Zustand & Speicherung ---------- */

function defaultState() {
  return { current: 0, score: 0, artifacts: [], progress: {} };
}

function loadState() {
  try {
    const s = JSON.parse(store.get(STORAGE_KEY) || "null");
    if (!s || typeof s !== "object") return defaultState();
    const current = Number.isInteger(s.current) ? s.current : 0;
    return {
      current: clamp(current, 0, stationsData.length),
      score: Number(s.score) || 0,
      artifacts: Array.isArray(s.artifacts) ? s.artifacts : [],
      progress: s.progress && typeof s.progress === "object" ? s.progress : {}
    };
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  store.set(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ---------- Aufräumen beim Stationswechsel ---------- */

let cleanups = [];
function runCleanups() {
  cleanups.splice(0).forEach((fn) => { try { fn(); } catch (e) { /* ignorieren */ } });
}

/* ---------- Scanner-Overlay ---------- */

function showScanner(text) {
  $("scannerText").textContent = text;
  $("scanner").hidden = false;
}
function hideScanner() { $("scanner").hidden = true; }

/* ---------- Rendering ---------- */

const TYPE_LABELS = {
  riddle: "Briefing", radar: "GPS-Radar", memory: "Hack-Minispiel",
  ordering: "Dialog-Puzzle", quiz: "Kunst-Quiz", audio: "Audio-Analyse"
};

let currentCtx = null;

function updateHud() {
  const total = stationsData.length;
  const done = Math.min(state.current, total);
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("score").textContent = state.score;
  $("progressText").textContent = done >= total
    ? `ALLE ${total} STATIONEN GESICHERT`
    : `STATION ${done + 1} / ${total}`;
  $("progressPct").textContent = `${pct}%`;
  $("progressFill").style.width = `${pct}%`;
  $("artifacts").replaceChildren(...state.artifacts.map((a) => h("span", { text: a.icon, title: a.name })));
}

function render() {
  runCleanups();
  currentCtx = null;
  updateHud();
  appEl.replaceChildren();
  document.body.classList.toggle("victory-mode", state.current >= stationsData.length);
  if (state.current >= stationsData.length) renderVictory();
  else renderStation(stationsData[state.current]);
}

function renderStation(station) {
  const card = h("article", { class: `card type-${station.type}` });
  const body = h("div", { class: "station-body" });
  let solved = false;

  const ctx = {
    station, card, body,
    progress() {
      if (!state.progress[station.id]) state.progress[station.id] = {};
      return state.progress[station.id];
    },
    setProgress(patch) { Object.assign(ctx.progress(), patch); saveState(); },
    onCleanup(fn) { cleanups.push(fn); },
    later(fn, ms) { const id = setTimeout(fn, ms); cleanups.push(() => clearTimeout(id)); return id; },
    every(fn, ms) { const id = setInterval(fn, ms); cleanups.push(() => clearInterval(id)); return id; },
    async scan(text, ms = SCAN_DELAY_MS) {
      sfx.scan();
      showScanner(text);
      await new Promise((r) => setTimeout(r, ms));
      hideScanner();
    },
    fail() {
      sfx.error();
      vibrate([80, 40, 80]);
      card.classList.remove("shake");
      void card.offsetWidth; // Animation neu starten
      card.classList.add("shake");
    },
    solve() {
      if (solved) return;
      solved = true;
      solveStation(station);
    }
  };
  currentCtx = ctx;

  card.append(
    h("div", { class: "tag-row" }, [
      h("span", { class: "tag", text: `Station ${station.id}` }),
      h("span", { class: "tag green", text: TYPE_LABELS[station.type] || station.type })
    ]),
    h("h2", { text: station.title }),
    h("p", { class: "story", text: station.story })
  );
  if (station.question) {
    card.append(
      h("div", { class: "task-label", text: "AUFGABE" }),
      h("p", { class: "question", text: station.question })
    );
  }

  const typeFn = stationTypes[station.type];
  if (typeFn) {
    typeFn(station, ctx);
  } else {
    body.append(h("p", { class: "feedback err", text: `Unbekannter Station-Typ: "${station.type}"` }));
  }
  card.append(body);

  if (station.hint) {
    const hintBox = h("div", { class: "hint-box", hidden: true });
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

function solveStation(station) {
  runCleanups();   // GPS, Audio, Timer … beenden
  hideScanner();
  const reward = station.reward || { points: 0 };

  // Fortschritt sofort speichern
  state.current += 1;
  state.score += reward.points || 0;
  if (reward.artifact) state.artifacts.push(reward.artifact);
  delete state.progress[station.id];
  saveState();

  sfx.success();
  vibrate([60, 30, 120]);
  updateHud();

  const isLast = state.current >= stationsData.length;
  const done = h("article", { class: "card success" }, [
    h("div", { class: "tag-row" }, [h("span", { class: "tag green", text: "Station gelöst" })]),
    h("h2", { text: station.title }),
    h("div", { class: "reward" }, [
      reward.artifact ? h("span", { class: "artifact-icon", text: reward.artifact.icon }) : "",
      h("div", { class: "big", text: `+${reward.points || 0} Punkte` }),
      reward.artifact ? h("div", { text: `Artefakt erhalten: ${reward.artifact.name}` }) : ""
    ]),
    station.solvedText ? h("p", { class: "story", text: station.solvedText }) : "",
    h("button", {
      class: "btn cyan", type: "button",
      text: isLast ? "Zur Abschlussmeldung" : "Nächste Station",
      onclick: () => {
        if (isLast) sfx.victory(); else sfx.click();
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    })
  ]);
  currentCtx = null;
  appEl.replaceChildren(done);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderVictory() {
  document.body.classList.add("victory-mode");
  const sparks = Array.from({ length: 18 }, (_, i) =>
    h("i", { class: "spark", style: `--x:${Math.round(Math.random() * 100)}%;--d:${(Math.random() * 3).toFixed(2)}s;--s:${(2 + Math.random() * 3).toFixed(2)}s` })
  );
  appEl.append(h("div", { class: "sparks", "aria-hidden": "true" }, sparks));

  appEl.append(h("article", { class: "card victory success" }, [
    h("span", { class: "earth", text: "🌍" }),
    h("div", { class: "tag-row", style: "justify-content:center" }, [h("span", { class: "tag green", text: "Mission abgeschlossen" })]),
    h("h1", { text: "Erde gerettet!" }),
    h("p", { class: "story", text: "Die Mutterschiffe drehen ab, das Signal ist verstummt. Die Menschheit lebt weiter – dank euch, Agenten. Erde erfolgreich vor den Aliens verteidigt!" }),
    h("div", { class: "reward" }, [
      h("div", { class: "big", text: `${state.score} Punkte` }),
      h("div", { text: "Gesammelte Artefakte:" }),
      h("div", { class: "artifacts", style: "margin-top:8px" },
        state.artifacts.map((a) => h("span", { text: a.icon, title: a.name })))
    ])
  ]));
}

/* ---------- Steuerung ---------- */

function resetGame() {
  if (!confirm("Wirklich alles zurücksetzen? Dein Fortschritt geht verloren.")) return;
  document.body.classList.remove("victory-mode");
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
  store.set(SOUND_KEY, soundOn ? "on" : "off");
  updateSoundBtn();
  sfx.click();
});
updateSoundBtn();

/* ---------- Debug-Leiste (nur mit ?debug in der URL) ---------- */

if (DEBUG) {
  const jump = parseInt(params.get("station"), 10);
  if (jump >= 1 && jump <= stationsData.length) {
    state.current = jump - 1;
    saveState();
  }
  const bar = $("debugBar");
  bar.hidden = false;
  $("dbgPrev").addEventListener("click", () => {
    state.current = Math.max(0, state.current - 1);
    document.body.classList.remove("victory-mode");
    saveState(); render();
  });
  $("dbgSkip").addEventListener("click", () => {
    if (currentCtx) currentCtx.solve();
  });
}

/* ---------- Start ---------- */

initWakeLock();
render();

/* PWA: Service Worker registrieren, sobald sw.js vorhanden ist (siehe Anleitung)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}
*/
