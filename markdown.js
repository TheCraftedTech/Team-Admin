/* ==========================================================================
   markdown.js – lädt Inhalte aus content/<id>.md und stellt sie dar
   --------------------------------------------------------------------------
   Eine Inhalts-ID ist ein kurzer Hash (6–12 Zeichen aus a–z, 0–9, z. B. "7f3a9c21").
   Bilder liegen im selben Ordner (content/) und haben ebenfalls einen Hash als Namen,
   z. B. content/4f8c2a91.png. Im Markdown genügt der Dateiname:  ![Beschreibung](4f8c2a91.png)

   Unterstützt: # Überschriften (1–4), Absätze, **fett**, *kursiv*, `Code`, Listen (- / 1.),
   > Zitate, --- Linien, ![Bilder](datei.png), [Links](https://…) und ``` Codeblöcke.
   HTML im Markdown wird nie ausgeführt, sondern als Text angezeigt.
   ========================================================================== */
"use strict";

const CONTENT_DIR = "content/";

function mdEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Erlaubte Adressen: http(s), mailto, Anker oder Dateien im content-Ordner. Alles andere (javascript:, data: …) wird verworfen. */
function mdUrl(raw, base) {
  const u = raw.trim();
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith("//")) return null;
  if (u.startsWith("#")) return u;
  return base + u.replace(/^\.?\//, "");
}

/** Textformatierung innerhalb einer Zeile (erwartet bereits maskierten Text) */
function mdInline(text, base) {
  const stash = [];
  const keep = (html) => "\u0000" + (stash.push(html) - 1) + "\u0000";

  let t = text.replace(/`([^`]+)`/g, (m, code) => keep(`<code>${code}</code>`));
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
    const src = mdUrl(url, base);
    return src ? keep(`<img src="${src}" alt="${alt}" loading="lazy">`) : alt;
  });
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const href = mdUrl(url, base);
    return href ? keep(`<a href="${href}" target="_blank" rel="noopener">`) + label + keep("</a>") : label;
  });
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/__(.+?)__/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*\w])\*([^*\s](?:[^*]*?[^*\s])?)\*(?!\*)/g, "$1<em>$2</em>");
  t = t.replace(/(^|[^\w])_([^_\s](?:[^_]*?[^_\s])?)_(?=[^\w]|$)/g, "$1<em>$2</em>");

  return t.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[Number(i)]);
}

function markdownToHtml(src, base = CONTENT_DIR) {
  const lines = String(src).replace(/\u0000/g, "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let para = [], list = null, quote = [], code = null;

  const inline = (s) => mdInline(mdEscape(s), base);
  const flushPara = () => { if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } };
  const flushList = () => {
    if (list) { out.push(`<${list.tag}>` + list.items.map((i) => `<li>${inline(i)}</li>`).join("") + `</${list.tag}>`); list = null; }
  };
  const flushQuote = () => { if (quote.length) { out.push("<blockquote>" + quote.map(inline).join("<br>") + "</blockquote>"); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };
  const addItem = (tag, text) => {
    flushPara(); flushQuote();
    if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
    list.items.push(text);
  };

  for (const raw of lines) {
    if (code !== null) {
      if (/^```/.test(raw)) { out.push("<pre><code>" + mdEscape(code.join("\n")) + "</code></pre>"); code = null; }
      else code.push(raw);
      continue;
    }
    if (/^```/.test(raw)) { flushAll(); code = []; continue; }

    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { flushAll(); continue; }

    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushAll(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushAll(); out.push("<hr>"); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if ((m = line.match(/^\s*[-*+•]\s+(.*)$/))) { addItem("ul", m[1]); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { addItem("ol", m[1]); continue; }

    flushList(); flushQuote();
    para.push(line.trim());
  }
  if (code !== null) out.push("<pre><code>" + mdEscape(code.join("\n")) + "</code></pre>");
  flushAll();
  return out.join("\n");
}

const contentCache = {};

/** Lädt content/<id>.md (wird zwischengespeichert) */
function loadContent(id) {
  if (!/^[0-9a-z]{6,12}$/i.test(String(id))) return Promise.reject(new Error(`Ungültige Inhalts-ID „${id}“`));
  if (!contentCache[id]) {
    contentCache[id] = fetch(`${CONTENT_DIR}${id}.md`, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Inhalt „${id}“ nicht gefunden (${r.status})`);
      return r.text();
    });
    contentCache[id].catch(() => { delete contentCache[id]; });
  }
  return contentCache[id];
}

/** Füllt ein Element mit dem Inhalt zur ID; bei Fehlern steht dort die Fehlermeldung */
async function fillMarkdown(el, id) {
  el.classList.add("loading");
  el.textContent = "LADE …";
  try {
    el.innerHTML = markdownToHtml(await loadContent(id));
    el.classList.remove("loading");
  } catch (e) {
    el.classList.remove("loading");
    el.classList.add("error");
    el.textContent = e.message;
  }
}
