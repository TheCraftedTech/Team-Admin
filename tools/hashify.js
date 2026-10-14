#!/usr/bin/env node
/* ==========================================================================
   tools/hashify.js – legt Inhalte mit kurzem Hash-Namen im Ordner content/ ab

   Bilder und Texte kopieren (Originale bleiben unverändert):
     node tools/hashify.js bild.png foto.jpg text.md aufnahme.mp3
   → content/<8 Zeichen Hash des Inhalts>.png  usw. und die Zeile zum Einfügen

   Neuen Text mit festem Namen anlegen (zum Weiterschreiben; der Name bleibt beim Bearbeiten gleich):
     node tools/hashify.js --neu
   → content/<zufälliger 8-stelliger Hash>.md mit einer Vorlage
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const OUT = path.join(__dirname, "..", "content");
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const AUDIO_EXT = new Set([".mp3", ".m4a", ".wav", ".ogg"]);
const args = process.argv.slice(2);

function fail(msg) { console.error(msg); process.exit(1); }

if (!args.length) {
  fail("Benutzung:\n  node tools/hashify.js <datei> [<datei> …]   Bilder/Texte mit Hash-Namen nach content/ kopieren\n  node tools/hashify.js --neu                 neuen Text mit zufälligem Hash anlegen");
}

fs.mkdirSync(OUT, { recursive: true });

if (args[0] === "--neu") {
  let id;
  do { id = crypto.randomBytes(4).toString("hex"); } while (fs.existsSync(path.join(OUT, `${id}.md`)));
  fs.writeFileSync(path.join(OUT, `${id}.md`), "# Überschrift\n\nHier steht der Text. **Fett**, *kursiv*, Listen:\n\n- Punkt 1\n- Punkt 2\n\nEin Bild: ![Beschreibung](hash.png)\n", "utf8");
  console.log(`Angelegt: content/${id}.md\nIn steps.js benutzen:  md: "${id}"`);
  process.exit(0);
}

for (const file of args) {
  if (!fs.existsSync(file)) fail(`Datei nicht gefunden: ${file}`);
  let ext = path.extname(file).toLowerCase();
  if (ext === ".jpeg") ext = ".jpg";
  const isImage = IMAGE_EXT.has(ext);
  const isAudio = AUDIO_EXT.has(ext);
  if (!isImage && !isAudio && ext !== ".md") fail(`Nicht unterstützt: ${file} (erlaubt: .md, .png, .jpg, .gif, .webp, .mp3, .m4a, .wav, .ogg)`);

  const bytes = fs.readFileSync(file);
  const id = crypto.createHash("sha1").update(bytes).digest("hex").slice(0, 8);
  const target = path.join(OUT, id + ext);
  if (fs.existsSync(target) && !fs.readFileSync(target).equals(bytes)) fail(`Der Name ${id}${ext} ist schon mit anderem Inhalt belegt.`);
  fs.copyFileSync(file, target);

  console.log(`${path.basename(file)}  →  content/${id}${ext}`);
  console.log(isImage ? `   im Markdown:  ![Beschreibung](${id}${ext})` : isAudio ? `   in steps.js:  src: "${id}${ext}"  (Modul „audio“; mp3 läuft auf allen Handys)` : `   in steps.js:  md: "${id}"`);
}
