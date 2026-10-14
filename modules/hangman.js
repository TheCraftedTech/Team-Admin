"use strict";

/* ======================================================================
   Modul „hangman“ – Galgenmännchen: einen Namen Buchstabe für Buchstabe erraten.
   Jeder falsche Buchstabe zeichnet ein Stück der Figur (Kopf, Körper, Arme, Beine, Hände, Gesicht);
   ist sie fertig, ist es vorbei (failTo: zurück zu einem Schritt). Ist der Name komplett, geht es weiter.
   Felder: md (Text darüber), word (gesuchter Name), failTo, failText
   ====================================================================== */
registerModule("hangman", (ctx) => {
  const S = ctx.step;
  const SVG = "http://www.w3.org/2000/svg";
  const base = (c) => String(c).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const word = String(S.word).toUpperCase();
  const guessed = new Set();
  let mistakes = 0, over = false, timer = 0;

  /* Figur: Galgen und sechs Teile, die nacheinander erscheinen */
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 240 250");
  svg.setAttribute("class", "hang-fig");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Galgenmännchen");
  const shape = (tag, attrs) => {
    const el = document.createElementNS(SVG, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };
  const gallows = shape("path", { d: "M30 232 H200 M70 232 V20 H150 M70 62 L112 20 M150 20 V48", class: "hang-gallows" });
  const parts = [
    [shape("circle", { cx: 150, cy: 70, r: 22 })],
    [shape("path", { d: "M150 92 V160" })],
    [shape("path", { d: "M150 110 L114 142 M150 110 L186 142" })],
    [shape("path", { d: "M150 160 L120 212 M150 160 L180 212" })],
    [shape("circle", { cx: 112, cy: 145, r: 6 }), shape("circle", { cx: 188, cy: 145, r: 6 })],
    [shape("path", { d: "M141 63 l8 8 m0 -8 l-8 8 M153 63 l8 8 m0 -8 l-8 8 M141 85 q9 -9 18 0" })]
  ];
  parts.forEach((group) => group.forEach((el) => { el.setAttribute("class", "hang-part"); el.setAttribute("opacity", "0"); }));
  svg.append(gallows, ...parts.flat());
  const MAX = parts.length;

  const wordEl = h("div", "hang-word");
  wordEl.setAttribute("aria-live", "polite");
  const counter = h("div", "hang-count");
  const feedback = h("div", "feedback");
  feedback.setAttribute("role", "status");
  const keys = {};
  const keyboard = h("div", "hang-keys");
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((letter) => {
    const b = h("button", "key", letter);
    b.type = "button";
    b.addEventListener("click", () => guess(letter));
    keys[letter] = b;
    keyboard.append(b);
  });

  const content = [];
  if (S.md) {
    const text = h("div", "md");
    content.push(text);
    fillMarkdown(text, S.md);
  }
  content.push(svg, counter, wordEl, feedback, keyboard);
  const page = h("div", "page", "", content);
  ctx.root.append(h("div", "scroller", "", [page]));

  const shown = () => [...word].map((c) => (c === " " ? " " : guessed.has(base(c)) ? c : "_")).join("");
  function render() {
    wordEl.replaceChildren(...word.split(" ").map((part) => h("span", "hang-w", "", [...part].map((c) => {
      const open = guessed.has(base(c));
      return h("span", "hang-ch" + (open ? " open" : ""), open ? c : "");
    }))));
    counter.textContent = `FEHLER ${mistakes} VON ${MAX}`;
    parts.forEach((group, i) => group.forEach((el) => el.setAttribute("opacity", i < mistakes ? "1" : "0")));
    svg.classList.toggle("dead", mistakes >= MAX);
  }

  function guess(letter) {
    if (over || guessed.has(letter)) return;
    guessed.add(letter);
    const hit = [...word].some((c) => base(c) === letter);
    keys[letter].disabled = true;
    keys[letter].classList.add(hit ? "hit" : "miss");
    if (hit) {
      feedback.className = "feedback ok";
      feedback.textContent = `„${letter}“ KOMMT IM NAMEN VOR ✔`;
    } else {
      mistakes++;
      feedback.className = "feedback err";
      feedback.textContent = `„${letter}“ KOMMT NICHT VOR`;
      shakePage(page);
    }
    render();
    if ([...word].every((c) => c === " " || guessed.has(base(c)))) {
      over = true;
      feedback.className = "feedback ok";
      feedback.textContent = "DER NAME IST KOMPLETT ✔";
      vibrateOnce();
      timer = setTimeout(() => ctx.next(), 1400);
    } else if (mistakes >= MAX) {
      over = true;
      Object.values(keys).forEach((b) => { b.disabled = true; });
      if (S.failTo) {
        timer = restartAfterWrong(ctx, page, feedback);
      } else {
        feedback.className = "feedback err";
        feedback.textContent = "DIE FIGUR IST FERTIG – ES IST VORBEI";
      }
    }
  }

  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const letter = base(e.key);
    if (/^[A-Z]$/.test(letter) && keys[letter]) guess(letter);
  };
  window.addEventListener("keydown", onKey);
  render();

  return {
    destroy() { clearTimeout(timer); window.removeEventListener("keydown", onKey); },
    debugGuess: guess,
    /** rät alle noch fehlenden Buchstaben des Namens */
    debugSolve() { [...new Set([...word].filter((c) => c !== " ").map(base))].forEach(guess); },
    /** rät Buchstaben, die nicht im Namen vorkommen, bis die Figur fertig ist */
    debugFail() { "QXYJVWZKPBFMNT".split("").filter((l) => !word.includes(l)).some((l) => { guess(l); return over; }); },
    info: () => ({ type: "hangman", word, shown: shown(), mistakes, max: MAX, over, failTo: S.failTo || null })
  };
});
