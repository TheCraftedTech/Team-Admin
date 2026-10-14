/* ==========================================================================
   steps.js – DIE ANORDNUNG: Reihenfolge der Schritte und ihre Inhalte
   --------------------------------------------------------------------------
   Die Schnitzeljagd besteht aus Schritten (STEPS). Jeder Schritt benutzt ein Modul (type):

     info      Text-/Bildseite zum Durchlesen.   Felder: md, button
                                                 optional: garble (0–1: Anteil „gestörter“ Zeichen, der Text ist dann nicht
                                                 lesbar), hintMd (Hinweiskasten darunter, z. B. die Kurz-Anleitung) und
                                                 leadMd (kurze Meldung darüber, z. B. „Störsender abgeschaltet“)
     locate    Ortungs-Radar zu einem Ort.       Felder: lat, lng, radius, approachRadius, maxAccuracy, holdSeconds
               (ein Ort = ein Schritt; „WEITER“ erscheint erst, wenn man wirklich am Ort ist)
     password  Eingabefeld für ein Passwort.     Felder: md (Text darüber), placeholder, answers[], button
     memory    Aufgabe „Störsender“: Muster merken und nachtippen. EIN Code = EIN Schritt (füllt den Bildschirm, kein Scrollen).
                                                 Felder: startLabel (Start-Button), size (Raster, 5 = 5×5), dots (leuchtende Tasten),
                                                 round / rounds (nur Anzeige „CODE 2 / 3“), blinks, onMs, offMs (Blinktempo),
                                                 autoStart (beginnt sofort), backTo (id: Ziel des „‹ ZURÜCK“-Knopfs),
                                                 failTo (id: bei einem Fehler dorthin springen, sonst neues Muster im selben Schritt)
     dialog    Dialog-Aufgabe: Sätze per Ziehen (oder Pfeile) in die richtige Reihenfolge bringen, Umschalter Schwäbisch / Deutsch.
                                                 Felder: heading, speakers[2], lines[{ who: 1|2, sw, de }] in der RICHTIGEN Reihenfolge,
                                                 solutions (weitere erlaubte Reihenfolgen als Listen von Zeilen-Nummern ab 0),
                                                 maxFails (so oft hintereinander falsch → alles neu gemischt), button, backTo,
                                                 showSpeakers (false = „Marktweib 1/2“ ausblenden), texts (eigene Meldungen),
                                                 confirmDe (eigenes Bestätigungsfenster beim Wechsel auf Deutsch)
     sky       Sternenhimmel: seitlich wischen (Parallaxe) und eine Route für das Raumschiff malen, „ROUTE SENDEN“ lässt es sie
               abfliegen, „NOCH EINMAL“ erlaubt eine neue Route (füllt den Bildschirm, kein Scrollen).
                                                 Felder: backTo (id: Ziel des „‹ ZURÜCK“-Knopfs), minLength (Mindestlänge der Route in Pixeln)
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
     T06  Meldung „Störsender abgeschaltet“  content/6c4d0427.md   fertig        (steht als Kasten über der lesbaren Story 3)
     T07  Story 4 (nach Ort 5)               content/6181fe9d.md   Platzhalter   (Bild B07: 07d5b8c6.jpg)
     T08  Story 5 (nach Ort 6)               content/70e24aae.md   Platzhalter   (Bild B08: 41b41829.png)
     T13  Story 6 (Marktweiber, Ankunft)     content/a404e46e.md   Platzhalter   (Bild B10: 268d5d70.png)
     T14  Eine Aufgabe für euch (Dialog)     content/bed8f3d0.md   Platzhalter   (Bild B11: c35292a8.jpg)
     T15  Der belauschte Streit (Anleitung)  content/35e6e118.md   fertig
     T16  Aufzeichnung rekonstruiert (Gespräch) content/e6a5e05c.md   fertig
     T18  Aliens schicken euch weiter (Westen)  content/84e2cf1f.md   Platzhalter   (Bild B13: a9897d02.png)
     T19  Signal gefunden (Auftrag)          content/14a6b5ec.md   Platzhalter   (Bild B14: 28ccfcba.jpg)
     T20  Karte aktualisiert                 content/413e9fcd.md   Platzhalter   (Bild B15: 2c931172.png)
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
  /* Nach dem Störsender kein eigener Schritt: die Meldung „abgeschaltet“ (leadMd) steht direkt über der
     jetzt lesbaren Story 3 – derselbe Text wie auf der gestörten Seite. */
  { id: "story-3-klar", type: "info", title: "Story 3, jetzt lesbar + Meldung „abgeschaltet“ (T04 + T06)", md: "609fe145", leadMd: "6c4d0427", button: "WEITER",
    status: "platzhalter", todo: "Story-3-Text und Bild ersetzen (derselbe Text wie auf der gestörten Seite)" },

  { id: "ort5", type: "locate", title: "Ort 5", lat: 47.76114913914456,  lng: 8.841115675526469, status: "fertig" },
  { id: "story-4", type: "info", title: "Story 4 (T07)", md: "6181fe9d", button: "WEITER",
    status: "platzhalter", todo: "Story-Text und Bild ersetzen" },

  { id: "ort6", type: "locate", title: "Ort 6", lat: 47.76170564732148,  lng: 8.842634771566102, status: "fertig" },
  { id: "story-5", type: "info", title: "Story 5 (T08)", md: "70e24aae", button: "WEITER",
    status: "platzhalter", todo: "Story-Text und Bild ersetzen" },

  /* Ort 7: die Marktweiber (3D-Scan zur Ansicht: https://scaniverse.com/scan/neojb4zuuz3gxyua).
     Nach der Ankunft: Story, eine freie Aufgabe (eigene Dialoge erfinden), dann die Dialog-Aufgabe. */
  { id: "ort7", type: "locate", title: "Ort 7 (Marktweiber)", lat: 47.76225845637471, lng: 8.842851679977652, status: "fertig" },
  { id: "story-6", type: "info", title: "Story 6: Ankunft bei den Marktweibern (T13)", md: "a404e46e", button: "WEITER",
    status: "platzhalter", todo: "Story-Text und Bild ersetzen" },
  { id: "story-7", type: "info", title: "Eine Aufgabe für euch: eigene Dialoge (T14)", md: "bed8f3d0", button: "WEITER",
    status: "platzhalter", todo: "Aufgabentext und Bild prüfen/ersetzen" },
  { id: "dialog-anleitung", type: "info", title: "Der belauschte Streit: Anleitung (T15)", md: "35e6e118", button: "ZUR AUFGABE", status: "fertig" },

  /* Dialog-Aufgabe: die Zeilen stehen in der RICHTIGEN Reihenfolge; angezeigt werden sie gemischt.
     Schwäbische Fassung nach Vorlage; die deutsche Fassung dient dem Umschalter. Weitere gültige Reihenfolgen
     (es gibt mehrere Lösungen) können in solutions als Listen von Zeilen-Nummern ab 0 ergänzt werden. */
  { id: "dialog", type: "dialog", title: "Marktweiber: abgehörte Aufzeichnung ordnen", heading: "ABGEHÖRTE AUFZEICHNUNG",
    speakers: ["MARKTWEIB 1", "MARKTWEIB 2"], showSpeakers: true, maxFails: 3, button: "AUFZEICHNUNG PRÜFEN", backTo: "dialog-anleitung",
    texts: {
      failLabel: "STÖRUNGEN",
      wrong: "AUFZEICHNUNG UNSTIMMIG – {n} VON {total} SÄTZEN PASSEN",
      tooMany: "AUFZEICHNUNG ZERFÄLLT – DIE ALIENS LESEN ALLE SÄTZE NEU EIN …",
      reshuffled: "NEU EINGELESEN – ORDNET DIE AUFZEICHNUNG NOCH EINMAL",
      done: "AUFZEICHNUNG REKONSTRUIERT ✔"
    },
    confirmDe: {
      title: "AUF DEUTSCH WECHSELN?",
      text: "Das Original der Aufzeichnung ist auf Schwäbisch. Auf Deutsch lesen sich die Sätze leichter – aber die Aliens würden gern wissen, ob ihr auch das Original versteht. Wirklich umschalten?",
      yes: "JA, AUF DEUTSCH",
      no: "ORIGINAL BEHALTEN"
    },
    solutions: [],
    lines: [
      { who: 1, sw: "Was soll dees do? Der Hund hot do gar nix verlora!", de: "Was soll das hier? Der Hund hat hier gar nichts verloren!" },
      { who: 2, sw: "Oh, dud mir leid!", de: "Oh, tut mir leid!" },
      { who: 1, sw: "Jetz seicht der do alles voll, dees ka doch wohl ned wahr sei!", de: "Jetzt pinkelt der hier alles voll, das kann doch wohl nicht wahr sein!" },
      { who: 2, sw: "I nimm eihn ja scho mit.", de: "Ich nehme ihn ja schon mit." },
      { who: 1, sw: "Do liegt überall Wierschdle ond rohs Fleisch rom!", de: "Hier liegen überall Würstchen und rohes Fleisch herum!" },
      { who: 2, sw: "Aber i ka’n ja ned dahoam lassa.", de: "Aber ich kann ihn ja nicht zu Hause lassen." },
      { who: 1, sw: "Der Marktplatz isch aber au koi Ort, wo Leit mit ihra Hünd gassi geha sollat!", de: "Der Marktplatz ist aber auch kein Ort, wo Leute mit ihren Hunden Gassi gehen sollten!" },
      { who: 2, sw: "I ben ja scho weg.", de: "Ich bin ja schon weg." },
      { who: 1, sw: "Aber ganz schnell!", de: "Aber ganz schnell!" }
    ],
    status: "fertig", todo: "deutsche Fassung prüfen; weitere gültige Reihenfolgen in solutions ergänzen" },
  { id: "dialog-fertig", type: "info", title: "Aufzeichnung rekonstruiert: Gespräch darüber (T16)", md: "e6a5e05c", button: "WEITER", status: "fertig" },
  /* Danach schicken die Aliens die Gruppe weiter: etwa 50 Meter nach Westen (tatsächlich ca. 43 m Luftlinie).
     Wieder ein normaler Ortungs-Schritt mit den angegebenen Koordinaten. */
  { id: "story-8", type: "info", title: "Die Aliens schicken euch weiter: 50 m nach Westen (T18)", md: "84e2cf1f", button: "WEITER",
    status: "platzhalter", todo: "Text und Bild prüfen/ersetzen" },
  { id: "ort8", type: "locate", title: "Ort 8 (ca. 50 m westlich der Marktweiber)", lat: 47.7622598458167, lng: 8.842276178706632, status: "fertig",
    todo: "Koordinaten vor Ort prüfen (waren nicht ganz genau bekannt)" },
  /* Ankunft bei Ort 8: erst Text (was ist zu tun), dann die Aufgabe am Sternenhimmel, dann wieder Text. */
  { id: "story-9", type: "info", title: "Signal gefunden: abgestürztes UFO, Auftrag (T19)", md: "14a6b5ec", button: "ZUM STERNENHIMMEL",
    status: "platzhalter", todo: "Text prüfen/ersetzen" },
  { id: "sternenhimmel", type: "sky", title: "Sternenhimmel: Route für das Raumschiff malen", backTo: "story-9", minLength: 500, status: "fertig",
    todo: "auf echten Handys testen (Wischen/Malen, Tempo)" },
  { id: "story-10", type: "info", title: "Karte aktualisiert (T20)", md: "413e9fcd", button: "WEITER",
    status: "platzhalter", todo: "Text und Bild ersetzen; Geschichte weiterentwickeln" },
  /* Die Geschichte ist noch nicht zu Ende: weitere Schritte kommen zwischen story-10 und ende.
     Das Ende selbst ist vorläufig. */
  { id: "ende", type: "end", title: "Ende, vorläufig (T09)", md: "0845e9c6",
    status: "platzhalter", todo: "echtes Ende schreiben" }
];
