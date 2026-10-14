"use strict";

/* ======================================================================
   Modul „info“ – Seite zum Durchlesen, am Ende ein Button
   ====================================================================== */
registerModule("info", (ctx) => {
  const S = ctx.step;
  const content = h("div", "md");
  const parts = [content];
  if (S.leadMd) {
    const lead = h("div", "md leadbox");
    parts.unshift(lead);
    fillMarkdown(lead, S.leadMd);
  }
  if (S.hintMd) {
    const hint = h("div", "md hintbox");
    parts.push(hint);
    fillMarkdown(hint, S.hintMd);
  }
  const button = h("button", "go", S.button || "WEITER");
  button.type = "button";
  button.addEventListener("click", () => ctx.next());
  parts.push(button);

  ctx.root.append(h("div", "scroller", "", [h("div", "page", "", parts)]));

  let glitchTimer = 0;
  fillMarkdown(content, S.md).then(() => {
    if (S.garble && !content.classList.contains("error")) glitchTimer = startGarble(content, S.garble);
  });

  return {
    destroy() { clearInterval(glitchTimer); },
    info: () => ({ type: "info", md: S.md, garble: S.garble || 0 })
  };
});

/** „Gestörter“ Text: ein Teil der Buchstaben und Ziffern wird ständig durch Zeichen ersetzt (strength = Anteil 0–1).
    Die Struktur (Überschriften, Absätze, Listen, Bilder) bleibt erhalten, nur lesen kann man es nicht richtig. */
const GLITCH_CHARS = "#%&@$?*/\\<>=+0123456789ABXZ";
function startGarble(el, strength) {
  el.classList.add("garbled");
  const nodes = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeValue.trim()) nodes.push({ node, text: node.nodeValue });
  }
  const tick = () => nodes.forEach(({ node, text }) => {
    let out = "";
    for (const ch of text) {
      out += /[\p{L}\p{N}]/u.test(ch) && Math.random() < strength ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)] : ch;
    }
    node.nodeValue = out;
  });
  tick();
  return setInterval(tick, 160);
}
