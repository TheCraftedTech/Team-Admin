"use strict";

/* ======================================================================
   Modul „choice“ – Frage mit Auswahlantworten (eine antippen, dann prüfen)
   Felder: md (Frage), options[], answers[] (richtige Option(en), als Text), button, failTo, failText
   ====================================================================== */
registerModule("choice", (ctx) => {
  const S = ctx.step;
  let picked = -1;
  let timer = 0;

  const buttons = (S.options || []).map((label, i) => {
    const b = h("button", "opt", label);
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      picked = i;
      buttons.forEach((o, j) => o.setAttribute("aria-pressed", String(j === i)));
      check.disabled = false;
      feedback.textContent = "";
      feedback.className = "feedback";
    });
    return b;
  });
  const check = h("button", "go", S.button || "PRÜFEN");
  check.type = "button";
  check.disabled = true;
  const feedback = h("div", "feedback");
  feedback.setAttribute("role", "status");

  const parts = [];
  if (S.md) {
    const content = h("div", "md");
    parts.push(content);
    fillMarkdown(content, S.md);
  }
  parts.push(h("div", "opts", "", buttons), check, feedback);
  const page = h("div", "page", "", parts);
  ctx.root.append(h("div", "scroller", "", [page]));

  const lock = () => { buttons.forEach((b) => { b.disabled = true; }); check.disabled = true; };
  check.addEventListener("click", () => {
    if (picked < 0 || check.disabled) return;
    lock();
    if (matchesAnswer(S.options[picked], S.answers)) {
      buttons[picked].classList.add("right");
      feedback.className = "feedback ok";
      feedback.textContent = "RICHTIG ✔";
      vibrateOnce();
      timer = setTimeout(() => ctx.next(), 800);
    } else {
      buttons[picked].classList.add("wrong");
      if (S.failTo) {
        timer = restartAfterWrong(ctx, page, feedback);
      } else {
        feedback.className = "feedback err";
        feedback.textContent = "FALSCH – VERSUCHT ES NOCH EINMAL";
        shakePage(page);
        timer = setTimeout(() => {
          buttons.forEach((b) => { b.disabled = false; b.classList.remove("wrong"); });
          picked = -1;
          buttons.forEach((b) => b.setAttribute("aria-pressed", "false"));
        }, 900);
      }
    }
  });

  return {
    destroy() { clearTimeout(timer); },
    debugPick(right = true) {
      const i = S.options.findIndex((o) => matchesAnswer(o, S.answers) === right);
      buttons[i].click();
      check.click();
    },
    info: () => ({ type: "choice", options: S.options, answers: [].concat(S.answers || []), picked, failTo: S.failTo || null })
  };
});
