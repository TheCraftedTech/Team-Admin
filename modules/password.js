"use strict";

/* ======================================================================
   Modul „password“ – Eingabefeld; das richtige Passwort führt zum nächsten Schritt
   ====================================================================== */
registerModule("password", (ctx) => {
  const S = ctx.step;
  const T = Object.assign({
    empty: "BITTE EIN PASSWORT EINGEBEN",
    ok: "PASSWORT RICHTIG ✔",
    wrong: "FALSCHES PASSWORT – VERSUCHT ES NOCH EINMAL"
  }, S.texts);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "field";
  input.placeholder = S.placeholder || "PASSWORT";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.setAttribute("autocorrect", "off");
  input.setAttribute("enterkeyhint", "go");
  input.setAttribute("aria-label", S.placeholder || "Passwort");
  if (S.inputmode) input.setAttribute("inputmode", S.inputmode);
  if (S.maxlength) input.maxLength = S.maxlength;

  const button = h("button", "go", S.button || "PRÜFEN");
  button.type = "submit";
  const feedback = h("div", "feedback");
  feedback.setAttribute("role", "status");

  const form = h("form", "", "", [input, button]);
  form.noValidate = true;

  const parts = [];
  if (S.md) {
    const content = h("div", "md");
    parts.push(content);
    fillMarkdown(content, S.md);
  }
  if (S.noteMd) {
    const paper = h("div", "paper");
    parts.push(paper);
    fillMarkdown(paper, S.noteMd);
  }
  parts.push(form, feedback);

  const page = h("div", "page", "", parts);
  ctx.root.append(h("div", "scroller", "", [page]));

  let timer = 0;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.disabled) return;
    if (!input.value.trim()) {
      feedback.className = "feedback err";
      feedback.textContent = T.empty;
      return;
    }
    if (matchesAnswer(input.value, S.answers)) {
      feedback.className = "feedback ok";
      feedback.textContent = T.ok;
      input.disabled = true;
      button.disabled = true;
      vibrateOnce();
      timer = setTimeout(() => ctx.next(), 700);
    } else if (S.failTo) {
      input.disabled = true;
      button.disabled = true;
      timer = restartAfterWrong(ctx, page, feedback);
    } else {
      feedback.className = "feedback err";
      feedback.textContent = T.wrong;
      shakePage(page);
      input.select();
    }
  });

  return {
    destroy() { clearTimeout(timer); },
    debugAnswer(text) { input.value = text; form.requestSubmit(); },
    info: () => ({ type: "password", answers: [].concat(S.answers || []), failTo: S.failTo || null })
  };
});
