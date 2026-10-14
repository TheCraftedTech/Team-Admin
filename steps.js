/* ==========================================================================
   steps.js – DIE ANORDNUNG: Reihenfolge der Schritte und ihre Inhalte
   --------------------------------------------------------------------------
   Die Schnitzeljagd besteht aus Schritten (STEPS). Jeder Schritt benutzt ein Modul (type):

     info      Text-/Bildseite zum Durchlesen.   Felder: md, button
                                                 optional: garble (0–1: Anteil „gestörter“ Zeichen, der Text ist dann nicht
                                                 lesbar) und hintMd (kleiner Hinweiskasten darunter, z. B. die Kurz-Anleitung)
     locate    Ortungs-Radar zu einem Ort.       Felder: lat, lng, radius, approachRadius, maxAccuracy, holdSeconds
               (ein Ort = ein Schritt; „WEITER“ erscheint erst, wenn man wirklich am Ort ist)
     password  Eingabefeld für ein Passwort.     Felder: md (Text darüber), placeholder, answers[], button
     memory    Aufgabe „Störsender“: Muster merken und nachtippen. EIN Code = EIN Schritt (füllt den Bildschirm, kein Scrollen).
                                                 Felder: startLabel (Start-Button), size (Raster, 5 = 5×5), dots (leuchtende Tasten),
                                                 round / rounds (nur Anzeige „CODE 2 / 3“), blinks, onMs, offMs (Blinktempo),
                                                 autoStart (beginnt sofort), backTo (id: Ziel des „‹ ZURÜCK“-Knopfs),
                                                 failTo (id: bei einem Fehler dorthin springen, sonst neues Muster im selben Schritt)
     end       Abschlussseite.                   Felder: md

   Gemeinsame Felder:
     id      eindeutig; unter ihr wird der Fortschritt gespeichert
     title   nur für die Debug-Seite
     status  nur für die Debug-Seite: "fertig" (Inhalt ist endgültig) oder "platzhalter" (Text/Bild muss noch ersetzt werden)
     todo    nur für die Debug-Seite: kurze Notiz, was noch zu tun ist
   Die Seiten selbst zeigen nie etwas davon; die Debug-Seite trennt „fertig“ und „Platzhalter ersetzen“.

   TEXTE UND BILDER (Markdown): md ist die ID einer Datei im Ordner content/, z. B. md: "8861a3f4"
   lädt content/8861a3f4.md. Bilder liegen im selben Ordner, ebenfalls mit Hash als Namen, und
   werden im Markdown nur mit dem Dateinamen eingebunden:  ![Beschreibung](9bde63bf.png)
   Hash-Namen anlegen:  node tools/hashify.js bild.png text.md   (kopiert die Dateien nach content/)
   oder einen neuen Text mit festem Namen:  node tools/hashify.js --neu
   Achtung: Wer die Seite im Browser untersucht, kann alle Dateien in content/ abrufen – Hash-Namen
   verhindern nur das Erraten, keine Einsicht in steps.js.

   TEXT-ÜBERSICHT (T = Text, B = Bild; die Nummern bleiben stabil, auch wenn die Reihenfolge geändert wird)
     T01  Einführung „Es geht los“           content/8861a3f4.md   Platzhalter   (Bild B01: 9bde63bf.png)
     T10  Wichtige Hinweise (Sicherheit)     content/ce0d842b.md   fertig
     T11  Schmierpapier und Stift            content/1b49aee5.md   fertig
     T02  Story 1 (nach Ort 2)               content/2bfc795f.md   Platzhalter   (Bild B03: bcb145ef.jpg)
     T03  Story 2 (nach Ort 3)               content/07188df6.md   Platzhalter   (Bild B04: d558c290.png)
     T04  Story 3 (nach Ort 4)               content/609fe145.md   Platzhalter   (Bild B05: 1b921479.jpg) – erst gestört, nach dem Störsender lesbar
     T12  Hinweis „Signal gestört“           content/1d44835b.md   fertig
     T05  Störsender: Anleitung              content/d027c79e.md   fertig
     T06  Störsender abgeschaltet            content/6c4d0427.md   Platzhalter   (Bild B06: 66de5a9d.png)
     T07  Story 4 (nach Ort 5)               content/6181fe9d.md   Platzhalter   (Bild B07: 07d5b8c6.jpg)
     T08  Story 5 (nach Ort 6)               content/70e24aae.md   Platzhalter   (Bild B08: 41b41829.png)
     T13  Story 6 (nach Ort 7, Marktweiber)  content/a404e46e.md   Platzhalter   (Bild B10: 268d5d70.png)
     T09  Ende (VORLÄUFIG)                   content/0845e9c6.md   Platzhalter   (Bild B09: a6db5dd6.jpg)

   Es gibt keine Obergrenze für Schritte: lieber jedes Detail als eigenen Schritt anlegen, dann lässt sich
   alles einzeln dokumentieren, testen und in der Debug-Seite vor- und zurückspulen.
   Neuen Schritt einbauen: ein Objekt an der gewünschten Stelle in STEPS einfügen.
   Das Modul „password“ ist fertig, wird aber noch von keinem Schritt benutzt: Sobald die Passwörter
   des Story-Guides feststehen, kommt dort, wo sie gebraucht werden, ein Schritt mit type: "password"
   und answers: [ … ] hinein.
   Neues Modul bauen: in modules.js mit registerModule("name", (ctx) => …) anlegen und
   hier mit type: "name" benutzen.
   ========================================================================== */

/* Vorgabewerte für alle „locate“-Schritte (jeder Schritt kann sie einzeln überschreiben).
   „Ankunft“ gilt erst, wenn man im kleinen Radius ist, das GPS genau genug ist UND das holdSeconds Sekunden
   lang ununterbrochen so bleibt. Schon ab approachRadius zeigt die Statuszeile „FAST DA – NOCH ETWAS NÄHER“. */
const SETTINGS = {
  radius: 20,          // Meter: so nah muss man am Ort sein
  approachRadius: 50,  // Meter: ab hier erscheint der Hinweis „FAST DA“ (noch keine Ankunft!)
  maxAccuracy: 20,     // Meter: das GPS muss mindestens so genau sein, sonst zählt die Ankunft nicht
  holdSeconds: 5       // Sekunden, die man ununterbrochen im Radius bleiben muss
};

const STEPS = [
  /* ---- Einführung ---- */
  { id: "einfuehrung", type: "info", title: "Einführung: Es geht los (T01)", md: "8861a3f4", button: "WEITER",
    status: "platzhalter", todo: "Story-Beginn und Bild ersetzen; evtl. Lückentext ergänzen" },
  { id: "hinweise-sicherheit", type: "info", title: "Wichtige Hinweise: Sicherheit (T10)", md: "ce0d842b", button: "VERSTANDEN",
    status: "fertig", todo: "optional: Telefonnummer des Teams ergänzen" },
  { id: "hinweise-notizen", type: "info", title: "Schmierpapier und Stift (T11)", md: "1b49aee5", button: "LOS GEHT'S",
    status: "fertig", todo: "entscheiden, ob die Seite bleibt" },

  /* Ort 1 ist der Start (Turm VI, 47.758796076746 / 8.83948384873872): Dort findet die Einführung statt,
     deshalb gibt es dafür keinen eigenen Ortungs-Schritt. Die Orte 2 bis 7 folgen der Reihe nach,
     zwischen zwei Orten liegt jeweils mindestens ein Story-Schritt. */
  { id: "ort2", type: "locate", title: "Ort 2", lat: 47.759442881868516, lng: 8.8405967427222, status: "fertig" },
  { id: "story-1", type: "info", title: "Story 1 (T02)", md: "2bfc795f", button: "WEITER",
    status: "platzhalter", todo: "Story-Text und Bild ersetzen" },

  { id: "ort3", type: "locate", title: "Ort 3", lat: 47.760105831192874, lng: 8.839979882181922, status: "fertig" },
  { id: "story-2", type: "info", title: "Story 2 (T03)", md: "07188df6", button: "WEITER",
    status: "platzhalter", todo: "Story-Text und Bild ersetzen" },

  { id: "ort4", type: "locate", title: "Ort 4", lat: 47.76058112053592,  lng: 8.841501782310322, status: "fertig" },

  /* Story 3 ist gestört (garble) und nicht lesbar – darunter die Kurz-Anleitung. Erst nach dem Störsender
     kommt derselbe Text noch einmal, jetzt klar lesbar (story-3-klar). */
  { id: "story-3-gestoert", type: "info", title: "Story 3, gestört (T04 + T12)", md: "609fe145", garble: 0.5, hintMd: "1d44835b", button: "ZUM STÖRSENDER",
    status: "fertig", todo: "gestörte Darstellung und Hinweis stehen; der Text darunter kommt aus Story 3 (T04)" },

  /* Aufgabe „Störsender“: bewusst viele kleine Schritte (jeder ist einzeln anspringbar und dokumentierbar).
     Die Anleitung ist ein normaler Info-Schritt, jeder der drei Codes ein eigener Schritt.
     Ein Fehler beim 2. oder 3. Code führt per failTo zurück zum 1. Code („die Sperre setzt sich zurück“). */
  { id: "stoersender-anleitung", type: "info", title: "Störsender: Anleitung (T05)", md: "d027c79e", button: "BEREIT", status: "fertig" },
  { id: "stoersender-1", type: "memory", title: "Störsender: Code 1", round: 1, rounds: 3, dots: 5, startLabel: "STÖRSENDER ANGREIFEN", backTo: "stoersender-anleitung", status: "fertig" },
  { id: "stoersender-2", type: "memory", title: "Störsender: Code 2", round: 2, rounds: 3, dots: 5, autoStart: true, failTo: "stoersender-1", backTo: "stoersender-anleitung", status: "fertig" },
  { id: "stoersender-3", type: "memory", title: "Störsender: Code 3", round: 3, rounds: 3, dots: 5, autoStart: true, failTo: "stoersender-1", backTo: "stoersender-anleitung", status: "fertig" },
  { id: "stoersender-fertig", type: "info", title: "Störsender abgeschaltet (T06)", md: "6c4d0427", button: "WEITER",
    status: "platzhalter", todo: "echten Inhalt einsetzen: was passiert, nachdem der Störsender aus ist" },
  { id: "story-3-klar", type: "info", title: "Story 3, jetzt lesbar (T04)", md: "609fe145", button: "WEITER",
    status: "platzhalter", todo: "Story-3-Text und Bild ersetzen (derselbe Text wie auf der gestörten Seite)" },

  { id: "ort5", type: "locate", title: "Ort 5", lat: 47.76114913914456,  lng: 8.841115675526469, status: "fertig" },
  { id: "story-4", type: "info", title: "Story 4 (T07)", md: "6181fe9d", button: "WEITER",
    status: "platzhalter", todo: "Story-Text und Bild ersetzen" },

  { id: "ort6", type: "locate", title: "Ort 6", lat: 47.76170564732148,  lng: 8.842634771566102, status: "fertig" },
  { id: "story-5", type: "info", title: "Story 5 (T08)", md: "70e24aae", button: "WEITER",
    status: "platzhalter", todo: "Story-Text und Bild ersetzen" },

  { id: "ort7", type: "locate", title: "Ort 7 (Marktweiber)", lat: 47.76225845637471, lng: 8.842851679977652, status: "fertig" },
  { id: "story-6", type: "info", title: "Story 6: hier geht es weiter (T13)", md: "a404e46e", button: "WEITER",
    status: "platzhalter", todo: "Geschichte nach Ort 7 weiterentwickeln, weitere Schritte einfügen" },

  /* Die Geschichte ist nach Ort 7 noch nicht zu Ende: weitere Schritte kommen zwischen story-6 und ende.
     Das Ende selbst ist vorläufig. */
  { id: "ende", type: "end", title: "Ende, vorläufig (T09)", md: "0845e9c6",
    status: "platzhalter", todo: "echtes Ende schreiben" }
];
