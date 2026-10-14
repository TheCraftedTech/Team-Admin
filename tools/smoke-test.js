#!/usr/bin/env node
/* ==========================================================================
   tools/smoke-test.js – automatischer Durchlauf der ganzen Rallye (Rauchtest)

     node tools/smoke-test.js

   Benötigt Node.js und Google Chrome (oder Edge/Chromium; Pfad notfalls in der Umgebungsvariable CHROME).
   Der Test prüft zuerst steps.js und content/ (tools/overview.js --check), startet dann einen kleinen lokalen Server und
   lässt Chrome ohne Fenster die Debug-Seite laden. Dort wird jeder Schritt geöffnet und zum Schluss die Rallye mit der
   Automatik (Fake-GPS, richtige Antworten) komplett durchgespielt.
   Geprüft wird: jede Seite lädt ohne Fehlermeldung, kein „Spiel“ in den Texten, alle Bilder laden und haben das Format 16:9,
   die Aufnahme lädt, jede Sternenhimmel-Strecke hat einen freien Weg, die Automatik erreicht das Ende.
   ========================================================================== */
"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg" };

/* ---------- der Test, der im Browser läuft (wird als Text in die Debug-Seite eingebaut) ---------- */
async function testInPage() {
  const log = [];
  const ok = (name, cond, extra) => log.push((cond ? "PASS " : "FAIL ") + name + (cond || extra === undefined ? "" : "  -> " + extra));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const game = () => $("game").contentWindow;
  const doc = () => game().document;
  const step = () => JSON.parse(game().eval("JSON.stringify({ id: STEPS[state.index].id, type: STEPS[state.index].type })"));
  const until = async (fn, tries = 100) => { for (let i = 0; i < tries && !fn(); i++) await sleep(100); return fn(); };
  try {
    await sleep(1800);
    const ids = JSON.parse(game().eval("JSON.stringify(STEPS.map((s) => s.id))"));
    const texts = [], pictures = [], errors = [];
    for (let i = 0; i < ids.length; i++) {
      $("steps").children[i].click();
      await sleep(450);
      if (["info", "end", "password", "choice", "estimate", "hangman", "audio"].includes(step().type)) await until(() => doc().querySelector(".md h1, .md p, .go"), 30);
      if (step().type === "audio") await until(() => game().eval("current.instance.info().ready || current.instance.info().failed"), 60);
      await sleep(200);
      texts.push(doc().body.innerText);
      if (doc().querySelector(".md.error, .error")) errors.push(ids[i]);
      doc().querySelectorAll(".md img").forEach((img) => {
        const box = img.getBoundingClientRect();
        pictures.push({ id: ids[i], ratio: box.width / box.height, loaded: img.naturalWidth > 0 });
      });
    }
    ok(ids.length + " Schritte öffnen sich ohne Fehlermeldung", errors.length === 0, errors.join(", "));
    ok("kein „Spiel“ in den Texten", !texts.some((t) => /spiel/i.test(t)), ids[texts.findIndex((t) => /spiel/i.test(t))]);
    ok(pictures.length + " Bilder laden", pictures.every((p) => p.loaded), pictures.filter((p) => !p.loaded).map((p) => p.id).join(", "));
    ok("alle Bilder erscheinen im festen 16:9-Rahmen", pictures.every((p) => Math.abs(p.ratio - 16 / 9) < 0.03), pictures.filter((p) => Math.abs(p.ratio - 16 / 9) >= 0.03).map((p) => p.id).join(", "));

    const audioStep = ids.indexOf(ids.find((id) => JSON.parse(game().eval("JSON.stringify(STEPS.find((s) => s.id === '" + id + "').type)")) === "audio"));
    if (audioStep >= 0) {
      $("steps").children[audioStep].click();
      await sleep(600);
      await until(() => game().eval("current.instance.info().ready || current.instance.info().failed"), 80);
      ok("Audio: die Aufnahme lädt", game().eval("current.instance.info().ready") === true);
    }
    const skyStep = ids.indexOf(ids.find((id) => JSON.parse(game().eval("JSON.stringify(STEPS.find((s) => s.id === '" + id + "').type)")) === "sky"));
    if (skyStep >= 0) {
      $("steps").children[skyStep].click();
      await sleep(800);
      ok("Sternenhimmel: 200 zufällige Strecken haben jeweils einen freien Weg", game().eval("current.instance.debugCheckFields(200)") === 0);
    }

    $("reset").click();
    await sleep(1800);
    $("auto").checked = true;
    $("stepM").value = 80;
    await until(() => step().type === "end", 7000);
    ok("Automatik spielt die ganze Rallye bis zum Ende durch", step().type === "end", step().id);
  } catch (e) {
    log.push("FEHLER " + e.message);
  }
  const out = document.createElement("pre");
  out.id = "smoke";
  out.textContent = log.join("\n") + "\nFERTIG";
  document.body.append(out);
}

/* ---------- Chrome finden ---------- */
function findChrome() {
  const candidates = [
    process.env.CHROME,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"
  ].filter(Boolean);
  return candidates.find((c) => fs.existsSync(c));
}

/* ---------- Ablauf ---------- */
const check = spawnSync(process.execPath, [path.join(__dirname, "overview.js"), "--check"], { encoding: "utf8" });
process.stdout.write(check.stdout + check.stderr);
if (check.status !== 0) process.exit(1);

const chrome = findChrome();
if (!chrome) { console.error("✗ Chrome nicht gefunden. Pfad in der Umgebungsvariable CHROME angeben."); process.exit(1); }

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/__smoke.html") {
    const page = fs.readFileSync(path.join(ROOT, "debug.html"), "utf8");
    const at = page.lastIndexOf("</body>");
    res.writeHead(200, { "Content-Type": TYPES[".html"] });
    res.end(page.slice(0, at) + `<script>(${testInPage.toString()})();</script>` + page.slice(at));
    return;
  }
  const file = path.join(ROOT, url === "/" ? "index.html" : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

server.listen(0, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${server.address().port}/__smoke.html`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-"));
  const args = ["--headless=new", "--disable-gpu", "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${profile}`,
    "--window-size=1100,900", "--virtual-time-budget=900000", "--dump-dom", url];
  let dom = "";
  const child = spawn(chrome, args, { stdio: ["ignore", "pipe", "ignore"] });
  child.stdout.on("data", (d) => { dom += d; });
  child.on("close", () => {
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
    const m = dom.match(/<pre id="smoke">([\s\S]*?)<\/pre>/);
    if (!m) { console.error("✗ Der Test hat kein Ergebnis geliefert (Chrome ohne Ausgabe)."); process.exit(1); }
    const lines = m[1].replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&").split("\n").filter((l) => l && l !== "FERTIG");
    console.log(lines.map((l) => (l.startsWith("PASS") ? "✔ " + l.slice(5) : "✗ " + l.replace(/^(FAIL|FEHLER) /, ""))).join("\n"));
    process.exit(lines.some((l) => !l.startsWith("PASS")) ? 1 : 0);
  });
});
