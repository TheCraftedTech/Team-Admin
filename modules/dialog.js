"use strict";

/* ======================================================================
   Modul „dialog“ – Aufgabe: Dialog in die richtige Reihenfolge bringen
   Jede Zeile gehört einer Person (who: 1 oder 2) und hat zwei Fassungen: sw (Schwäbisch) und de (Deutsch).
   Unten schaltet ein Umschalter zwischen beiden Fassungen um. Die Sätze lassen sich am Griff ziehen
   (Zeigereingabe, auch per Finger) oder mit den Pfeilen verschieben. „PRÜFEN“ vergleicht die Reihenfolge.
   Nach maxFails falschen Versuchen hintereinander werden alle Sätze neu gemischt.
   Felder: heading, speakers (Namen der beiden Personen), showSpeakers (false = Namen ausblenden),
           lines (in der RICHTIGEN Reihenfolge), solutions (weitere erlaubte Reihenfolgen als Listen von
           Zeilen-Nummern ab 0), maxFails, button, backTo,
           texts (eigene Meldungen, siehe DIALOG_TEXTS), confirmDe (eigenes Bestätigungsfenster beim Wechsel zu Deutsch)
   Das Wechseln von Schwäbisch auf Deutsch fragt erst in einem eigenen Fenster nach; zurück geht es sofort.
   ====================================================================== */
const DIALOG_TEXTS = {
  failLabel: "FEHLVERSUCHE",
  wrong: "NOCH NICHT RICHTIG – {n} VON {total} SÄTZEN STEHEN AN DER RICHTIGEN STELLE",
  tooMany: "{max}× HINTEREINANDER FALSCH – ALLE SÄTZE WERDEN NEU GEMISCHT …",
  reshuffled: "NEU GEMISCHT – SORTIERT DEN DIALOG NOCH EINMAL",
  done: "DIALOG VOLLSTÄNDIG ✔"
};
const DIALOG_CONFIRM_DE = {
  title: "AUF DEUTSCH WECHSELN?",
  text: "Im Original ist der Dialog auf Schwäbisch. Auf Deutsch ist er leichter zu verstehen. Wirklich umschalten?",
  yes: "JA, AUF DEUTSCH",
  no: "ORIGINAL BEHALTEN"
};
registerModule("dialog", (ctx) => {
  const S = ctx.step;
  const lines = S.lines || [];
  const n = lines.length;
  const speakers = S.speakers || ["PERSON 1", "PERSON 2"];
  const maxFails = S.maxFails ?? 3;
  const T = { ...DIALOG_TEXTS, ...(S.texts || {}) };
  const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const mainOrder = lines.map((_, i) => i);
  const solutions = [mainOrder, ...(S.solutions || [])];

  let lang = ctx.data.lang === "de" ? "de" : "sw";
  let fails = clamp(Number(ctx.data.fails) || 0, 0, maxFails - 1);
  let locked = false;
  let drag = null;
  let scrollTimer = 0;

  const timers = new Set();
  function later(fn, ms) {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  }

  const isSolution = (order) => solutions.some((s) => s.length === order.length && s.every((v, k) => v === order[k]));
  const bestMatch = (order) => Math.max(...solutions.map((s) => order.filter((v, k) => v === s[k]).length));
  function shuffledOrder() {
    let order;
    do {
      order = mainOrder.slice();
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    } while (n > 1 && isSolution(order));
    return order;
  }

  let order = Array.isArray(ctx.data.order) && ctx.data.order.length === n && !isSolution(ctx.data.order) ? ctx.data.order.slice() : shuffledOrder();

  /* ----- Oberfläche ----- */
  const topParts = [];
  if (S.backTo) {
    const back = h("button", "back", "‹ ZURÜCK");
    back.type = "button";
    back.addEventListener("click", () => ctx.goToId(S.backTo));
    topParts.push(back);
  }
  topParts.push(h("div", "dlg-title", S.heading || "DIALOG"));

  const failLeds = h("div", "dlg-fails");
  const list = h("ul", "dlg-list");
  const status = h("div", "feedback");
  status.setAttribute("role", "status");

  const nodes = lines.map((line, i) => {
    const li = h("li", "dlg-item");
    li.dataset.i = String(i);
    li.dataset.who = String(line.who);
    const handle = h("div", "dlg-handle", "⠿");
    handle.setAttribute("aria-label", "Zum Verschieben ziehen");
    const chip = h("span", "dlg-chip", speakers[line.who - 1] || `PERSON ${line.who}`);
    chip.hidden = S.showSpeakers === false;
    const text = h("span", "dlg-text");
    const up = h("button", "", "▲"); up.type = "button"; up.setAttribute("aria-label", "Nach oben");
    const down = h("button", "", "▼"); down.type = "button"; down.setAttribute("aria-label", "Nach unten");
    up.addEventListener("click", () => moveBy(li, -1));
    down.addEventListener("click", () => moveBy(li, 1));
    li.append(handle, h("div", "dlg-body", "", [chip, text]), h("div", "dlg-move", "", [up, down]));
    setupDrag(handle, li);
    return li;
  });

  const langSw = h("button", "", "SCHWÄBISCH"); langSw.type = "button";
  const langDe = h("button", "", "DEUTSCH"); langDe.type = "button";
  const langBar = h("div", "dlg-lang", "", [langSw, langDe]);
  langBar.setAttribute("role", "group");
  langBar.setAttribute("aria-label", "Sprache");
  const check = h("button", "go", S.button || "PRÜFEN");
  check.type = "button";

  ctx.root.append(h("div", "dlg-screen", "", [h("div", "dlg-top", "", topParts), failLeds, list, status, langBar, check]));

  /* ----- Anzeige ----- */
  function renderTexts() {
    nodes.forEach((li, i) => { li.querySelector(".dlg-text").textContent = lines[i][lang]; });
    langSw.classList.toggle("on", lang === "sw");
    langDe.classList.toggle("on", lang === "de");
  }
  function renderOrder() { list.append(...order.map((i) => nodes[i])); }
  function renderFails() {
    failLeds.replaceChildren(h("span", "", T.failLabel), ...Array.from({ length: maxFails }, (_, i) => {
      const d = document.createElement("i");
      d.className = i < fails ? "on" : "";
      return d;
    }));
  }
  function setStatus(text, kind) {
    status.textContent = text;
    status.className = "feedback" + (kind ? " " + kind : "");
  }
  function save() {
    ctx.data.order = order.slice();
    ctx.data.fails = fails;
    ctx.data.lang = lang;
    ctx.save();
  }
  function syncOrder() { order = [...list.children].map((li) => Number(li.dataset.i)); }

  function setLang(next) { lang = next; renderTexts(); save(); }
  langSw.addEventListener("click", () => setLang("sw"));
  langDe.addEventListener("click", async () => {
    if (lang === "de") return;
    // Von Schwäbisch auf Deutsch: erst im eigenen Fenster nachfragen (zurück geht es ohne Nachfrage)
    const yes = await confirmBox({ ...DIALOG_CONFIRM_DE, ...(S.confirmDe || {}) });
    if (yes) setLang("de");
  });

  /* ----- Verschieben: Pfeile ----- */
  function moveBy(li, dir) {
    if (locked) return;
    const other = dir < 0 ? li.previousElementSibling : li.nextElementSibling;
    if (!other) return;
    if (dir < 0) list.insertBefore(li, other); else list.insertBefore(other, li);
    syncOrder();
    save();
    li.scrollIntoView({ block: "nearest" });
  }

  /* ----- Verschieben: Ziehen am Griff ----- */
  function updateDrag() {
    if (!drag) return;
    const { li, grab, y } = drag;
    const desiredTop = y - grab - list.getBoundingClientRect().top + list.scrollTop;
    for (let guard = 0; guard < 24; guard++) {
      const prev = li.previousElementSibling, next = li.nextElementSibling;
      const center = desiredTop + li.offsetHeight / 2;
      if (prev && center < prev.offsetTop + prev.offsetHeight / 2) list.insertBefore(li, prev);
      else if (next && center > next.offsetTop + next.offsetHeight / 2) list.insertBefore(next, li);
      else break;
    }
    li.style.transform = `translateY(${desiredTop - li.offsetTop}px)`;
  }
  function autoScroll() {
    if (!drag) return;
    const r = list.getBoundingClientRect();
    if (drag.y < r.top + 44) list.scrollTop -= 12;
    else if (drag.y > r.bottom - 44) list.scrollTop += 12;
    updateDrag();
  }
  function endDrag(e) {
    if (!drag || (e && drag.id !== e.pointerId)) return;
    clearInterval(scrollTimer);
    drag.li.style.transform = "";
    drag.li.classList.remove("drag");
    drag = null;
    syncOrder();
    save();
  }
  function setupDrag(handle, li) {
    handle.addEventListener("pointerdown", (e) => {
      if (locked || drag || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* nicht überall möglich */ }
      drag = { li, id: e.pointerId, grab: e.clientY - li.getBoundingClientRect().top, y: e.clientY };
      li.classList.add("drag");
      scrollTimer = setInterval(autoScroll, 30);
      updateDrag();
    });
    handle.addEventListener("pointermove", (e) => {
      if (drag && drag.id === e.pointerId) { drag.y = e.clientY; updateDrag(); }
    });
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }

  /* ----- Prüfen ----- */
  function reshuffle() {
    order = shuffledOrder();
    fails = 0;
    renderOrder();
    renderFails();
    save();
    nodes.forEach((li) => { li.classList.remove("ok"); });
    list.scrollTop = 0;
    setStatus(T.reshuffled);
  }

  function checkOrder() {
    if (locked) return;
    syncOrder();

    if (isSolution(order)) {
      locked = true;
      nodes.forEach((li) => li.classList.add("ok"));
      check.disabled = true;
      setStatus(T.done, "ok");
      vibrateOnce();
      save();
      later(() => ctx.next(), 1400);
      return;
    }

    fails += 1;
    renderFails();
    if (fails >= maxFails) {
      locked = true;
      setStatus(fill(T.tooMany, { max: maxFails, n: bestMatch(order), total: n }), "err");
      later(() => { locked = false; reshuffle(); }, 1900);
    } else {
      setStatus(fill(T.wrong, { max: maxFails, n: bestMatch(order), total: n }), "err");
    }
    save();
  }
  check.addEventListener("click", checkOrder);

  renderTexts();
  renderOrder();
  renderFails();

  return {
    destroy() { timers.forEach(clearTimeout); timers.clear(); clearInterval(scrollTimer); },
    /* nur für die Debug-Seite */
    debugSolve() { order = mainOrder.slice(); renderOrder(); checkOrder(); },
    debugFail() { order = mainOrder.slice().reverse(); renderOrder(); checkOrder(); },
    info: () => ({ type: "dialog", lang, order: order.slice(), fails, maxFails, locked, lines: n })
  };
});
