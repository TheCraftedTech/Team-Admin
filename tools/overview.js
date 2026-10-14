#!/usr/bin/env node
/* ==========================================================================
   tools/overview.js – Übersicht und Prüfung der Schritte (steps.js)

     node tools/overview.js            gibt die Schritt-Tabelle als Markdown aus (für README.md)
     node tools/overview.js --check    prüft steps.js und content/: eindeutige ids, vorhandene Texte, Bilder und
                                       Audiodateien, gültige Sprungziele (failTo, backTo), gültiger Status.
                                       Beendet sich mit Fehlercode 1, wenn etwas nicht stimmt.
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const CONTENT = path.join(ROOT, "content");

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "steps.js"), "utf8") + ";this.STEPS = STEPS;", sandbox);
const STEPS = sandbox.STEPS;

const mdFile = (id) => path.join(CONTENT, `${id}.md`);
const readMd = (id) => (fs.existsSync(mdFile(id)) ? fs.readFileSync(mdFile(id), "utf8") : "");
const imagesOf = (step) => {
  const ids = [step.md, step.leadMd, step.hintMd, step.noteMd].filter(Boolean);
  return [...new Set(ids.flatMap((id) => [...readMd(id).matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1])))];
};
const mdIdsOf = (step) => [step.md, step.leadMd, step.hintMd, step.noteMd].filter(Boolean);

if (process.argv.includes("--check")) {
  const problems = [];
  const seen = new Set();
  for (const s of STEPS) {
    if (!s.id) problems.push("Schritt ohne id");
    if (seen.has(s.id)) problems.push(`id doppelt: ${s.id}`);
    seen.add(s.id);
    if (!["fertig", "platzhalter"].includes(s.status)) problems.push(`${s.id}: status muss "fertig" oder "platzhalter" sein`);
  }
  for (const s of STEPS) {
    for (const id of mdIdsOf(s)) if (!fs.existsSync(mdFile(id))) problems.push(`${s.id}: content/${id}.md fehlt`);
    for (const img of imagesOf(s)) if (!fs.existsSync(path.join(CONTENT, img))) problems.push(`${s.id}: Bild content/${img} fehlt`);
    if (s.src && !fs.existsSync(path.join(CONTENT, s.src))) problems.push(`${s.id}: Audiodatei content/${s.src} fehlt`);
    for (const key of ["failTo", "backTo"]) if (s[key] && !seen.has(s[key])) problems.push(`${s.id}: ${key} zeigt auf unbekannte id „${s[key]}“`);
    if (s.type === "locate" && !(Number.isFinite(s.lat) && Number.isFinite(s.lng))) problems.push(`${s.id}: lat/lng fehlen`);
  }
  // Dateien in content/, die kein Schritt benutzt
  const used = new Set();
  for (const s of STEPS) { mdIdsOf(s).forEach((id) => used.add(`${id}.md`)); imagesOf(s).forEach((i) => used.add(i)); if (s.src) used.add(s.src); }
  for (const f of fs.readdirSync(CONTENT)) if (!used.has(f)) problems.push(`content/${f} wird von keinem Schritt benutzt`);

  if (problems.length) { console.error(problems.map((p) => "✗ " + p).join("\n")); process.exit(1); }
  console.log(`✔ ${STEPS.length} Schritte, ${fs.readdirSync(CONTENT).length} Dateien in content/ – alles in Ordnung.`);
  process.exit(0);
}

const clean = (t) => String(t || "").replace(/\|/g, "\\|");
const rows = STEPS.map((s, i) => {
  const media = [...imagesOf(s), s.src].filter(Boolean).join(", ");
  const text = s.md ? `${s.md}.md` : "";
  return `| ${i + 1} | \`${s.id}\` | ${s.type} | ${clean(s.title)} | ${text} | ${media} | ${s.status === "fertig" ? "fertig" : "Platzhalter"} |`;
});
console.log("| Nr | id | Modul | Titel | Text | Bild / Audio | Status |");
console.log("|---:|----|-------|-------|------|--------------|--------|");
console.log(rows.join("\n"));
