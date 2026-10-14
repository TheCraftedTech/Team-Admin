"use strict";

/* ======================================================================
   Modul „estimate“ – eine Zahl schätzen: die Seite sagt „zu groß / zu klein“ (bei großem Abstand „viel zu …“),
   bis die Zahl stimmt. Eingabe mit höchstens decimals Nachkommastellen (Komma oder Punkt).
   Felder: md (Frage), answer (richtige Zahl), unit (z. B. "m"), decimals (Standard 1),
           farFactor (ab diesem Anteil der richtigen Zahl heißt es „viel zu …“, Standard 0.35), placeholder, button,
           maxTries (nach so vielen Fehlversuchen verraten die Aliens die Lösung und es geht weiter, Standard 6;
           mit failTo stattdessen zurück zu einem Schritt)
   ====================================================================== */
registerModule("estimate", (ctx) => {
  const S = ctx.step;
  const decimals = S.decimals ?? 1;
  const unit = S.unit ? ` ${S.unit}` : "";
  const target = Number(S.answer);
  const factor = 10 ** decimals;
  const show = (n) => n.toFixed(decimals).replace(".", ",") + unit;
  const maxTries = S.maxTries ?? 6;
  let timer = 0, tries = 0, solved = false;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "field";
  input.placeholder = S.placeholder || "SCHÄTZUNG";
  input.autocomplete = "off";
  input.setAttribute("inputmode", "decimal");
  input.setAttribute("enterkeyhint", "go");
  input.setAttribute("aria-label", S.placeholder || "Schätzung");
  const button = h("button", "go", S.button || "PRÜFEN");
  button.type = "submit";
  const feedback = h("div", "feedback");
  feedback.setAttribute("role", "status");
  const history = h("ul", "est-hist");
  const form = h("form", "", "", [input, button]);
  form.noValidate = true;

  const parts = [];
  if (S.md) {
    const content = h("div", "md");
    parts.push(content);
    fillMarkdown(content, S.md);
  }
  parts.push(form, feedback, history);
  const page = h("div", "page", "", parts);
  ctx.root.append(h("div", "scroller", "", [page]));

  const pattern = new RegExp(`^\\d+([.,]\\d{1,${Math.max(decimals, 1)}})?$`);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (solved) return;
    const text = input.value.trim();
    if (!pattern.test(text) || (decimals === 0 && /[.,]/.test(text))) {
      feedback.className = "feedback err";
      feedback.textContent = decimals ? `BITTE EINE ZAHL MIT HÖCHSTENS ${decimals} NACHKOMMASTELLE EINGEBEN (Z. B. 8,5)` : "BITTE EINE GANZE ZAHL EINGEBEN";
      return;
    }
    const guess = Math.round(Number(text.replace(",", ".")) * factor) / factor;
    tries++;
    if (guess === Math.round(target * factor) / factor) {
      solved = true;
      input.disabled = true;
      button.disabled = true;
      feedback.className = "feedback ok";
      feedback.textContent = `${show(guess)} – GENAU RICHTIG ✔`;
      vibrateOnce();
      timer = setTimeout(() => ctx.next(), 1000);
      return;
    }
    const tooBig = guess > target;
    const far = Math.abs(guess - target) > target * (S.farFactor ?? 0.35);
    const verdict = `${far ? "VIEL " : ""}ZU ${tooBig ? "GROSS" : "KLEIN"}`;
    feedback.className = "feedback err";
    feedback.textContent = `${show(guess)}: ${verdict}`;
    const li = h("li", far ? "far" : "", `${tooBig ? "▼" : "▲"} ${show(guess)} – ${verdict}`);
    history.prepend(li);
    while (history.children.length > 8) history.lastChild.remove();
    shakePage(page);
    const left = maxTries - tries;
    if (left > 0) {
      feedback.textContent += ` · NOCH ${left} VERSUCH${left === 1 ? "" : "E"}`;
      input.select();
      return;
    }
    solved = true;
    input.disabled = true;
    button.disabled = true;
    if (S.failTo) {
      timer = restartAfterWrong(ctx, page, feedback);
    } else {
      feedback.className = "feedback ok";
      feedback.textContent = `${maxTries} VERSUCHE – DIE AUFLÖSUNG: ${show(target)}`;
      timer = setTimeout(() => ctx.next(), 3200);
    }
  });

  return {
    destroy() { clearTimeout(timer); },
    debugAnswer(value) { input.value = String(value); form.requestSubmit(); },
    info: () => ({ type: "estimate", answer: target, unit: S.unit || "", decimals, tries, solved })
  };
});
