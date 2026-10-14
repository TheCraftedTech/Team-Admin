"use strict";

/* ======================================================================
   Gemeinsame Hilfen für die Frage-Module (password, choice, estimate, hangman)
   ====================================================================== */
function shakePage(page) {
  page.classList.remove("shake");
  void page.offsetWidth;                // Animation neu starten
  page.classList.add("shake");
}

/** Falsche Antwort mit failTo: Meldung zeigen und nach kurzer Pause zurück zum angegebenen Schritt (Rückgabe: Timer) */
function restartAfterWrong(ctx, page, feedback) {
  feedback.className = "feedback err";
  feedback.textContent = ctx.step.failText || "FALSCH – DIE ENTSCHLÜSSELUNG BEGINNT VON VORN";
  shakePage(page);
  vibrateOnce();
  return setTimeout(() => ctx.goToId(ctx.step.failTo), 1800);
}
