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
                                                 optional: failTo (id: bei falscher Antwort nach kurzer Meldung dorthin zurück,
                                                 sonst darf man es erneut versuchen), failText (eigene Meldung),
                                                 texts ({ empty, ok, wrong }: eigene Meldungen, damit es nicht nach „Passwort“ klingt),
                                                 noteMd (Notizzettel, schräg neben dem Eingabefeld, immer sichtbar),
                                                 inputmode ("numeric" = Zifferntastatur), maxlength
     choice    Frage mit Auswahlantworten.       Felder: md (Frage, darf ein Bild enthalten), options[] (Antworten in dieser Reihenfolge),
                                                 answers[] (richtige Option(en) als Text), button, failTo, failText
     estimate  Zahl schätzen („zu groß“, „zu klein“, bei großem Abstand „viel zu …“, bis sie stimmt).
                                                 Felder: md, answer (richtige Zahl), unit, decimals (Nachkommastellen, Standard 1),
                                                 farFactor (Abstand als Anteil der Lösung, ab dem „viel zu …“ gilt, Standard 0.35), placeholder, button,
                                                 maxTries (Fehlversuche, danach wird die Lösung verraten und es geht weiter, Standard 6;
                                                 mit failTo stattdessen zurück zu einem Schritt)
     hangman   Galgenmännchen: einen Namen Buchstabe für Buchstabe erraten. Jeder falsche Buchstabe zeichnet ein Stück der
               Figur (Kopf, Körper, Arme, Beine, Hände, Gesicht = 6 Fehler), danach ist es vorbei.
                                                 Felder: md, word (gesuchter Name), failTo, failText
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
     sky       Navigations-Aufgabe am Sternenhimmel: eine Route von der Erde (links) zum Heimatplaneten der Aliens (rechts)
               malen, vorbei an zufällig verstreuten Kometen und Asteroiden; das Raumschiff fliegt nur nach rechts, Berührung
               bricht die Linie ab, „RÜCKGÄNGIG“/„LÖSCHEN“, am Ziel „SIMULATION STARTEN“, „NOCH EINMAL“ erzeugt eine neue
               Strecke (füllt den Bildschirm, kein Scrollen).
                                                 Felder: backTo (id: Ziel des „‹ ZURÜCK“-Knopfs), trackLength (Länge der Strecke, Standard 6000),
                                                 gap (Breite des garantiert freien Wegs, Standard 200 – kleiner = schwerer),
                                                 density (Dichte der Hindernisse 0–1, Standard 0.3), shipRadius, undoLength, seed
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
     T19  Eine Sternkarte (Kunst-Relikt)     content/14a6b5ec.md   Platzhalter   (Bild B14: 28ccfcba.jpg)
     T21  Schaut euch die Karte an           content/f5e0f468.md   Platzhalter
     T22  Ihr übernehmt die Navigation       content/6105ac99.md   fertig
     T20  Simulation erfolgreich                 content/413e9fcd.md   Platzhalter   (Bild B15: 2c931172.png)
     T23  Das nächste Signal (Weg zum Hauser-Brunnen) content/bfaae9dd.md   Platzhalter
     T24  Erster Zwischenpunkt               content/e485be82.md   Platzhalter
     T25  Zweiter Zwischenpunkt              content/d2792e96.md   Platzhalter
     T26  Ankunft am Hauser-Brunnen          content/e4a719d8.md   Platzhalter
     T27  Festplatte entschlüsseln: Anleitung   content/7e26f7d1.md   Platzhalter
     T28  Frage 1 von 4 (Steine)             content/e8e9df6e.md   fertig
     T29  Frage 2 von 4 (Metall)             content/2e662bfe.md   fertig
     T30  Frage 3 von 4 (Höhe schätzen)      content/049c4674.md   fertig
     T31  Frage 4 von 4 (Galgenmännchen)     content/fe3cda9c.md   fertig
     T32  Festplatte entschlüsselt           content/59e8aa98.md   Platzhalter
     T33  Der Aktivierungscode (Bild)        content/90ce1763.md   Platzhalter   (Bild B16: 86c5fae2.jpg, Foto der Marktweiber-Figuren)
     T34  Notizzettel zum Aktivierungscode   content/5edb4ab3.md   Platzhalter
     T35  Sender aktiviert: Daten gesendet   content/e9777b85.md   Platzhalter
     T36  Die Antwort kommt (zum Ohr gehen)  content/a367b120.md   Platzhalter
     T37  Ein Ohr für die Antwort            content/68a0892a.md   Platzhalter
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
  /* Ankunft bei Ort 8: Dort liegt kein UFO, sondern eine veraltete Sternkarte – ein öffentliches Kunstobjekt (Relikt).
     Ablauf: Story → Karte in Ruhe ansehen (herumgehen) → Auftrag „Navigation“ → Aufgabe am Sternenhimmel → Story. */
  { id: "story-9", type: "info", title: "Eine Sternkarte: veraltetes Kunst-Relikt (T19)", md: "14a6b5ec", button: "WEITER",
    status: "platzhalter", todo: "Text prüfen/ersetzen (Name/Beschreibung des echten Kunstobjekts einsetzen)" },
  { id: "karte-ansehen", type: "info", title: "Schaut euch die Karte an: herumgehen (T21)", md: "f5e0f468", button: "WEITER",
    status: "platzhalter", todo: "Fragen zum echten Kunstobjekt anpassen" },
  { id: "navigation-auftrag", type: "info", title: "Ihr übernehmt die Navigation: Auftrag (T22)", md: "6105ac99", button: "ZUR NAVIGATION", status: "fertig" },
  { id: "sternenhimmel", type: "sky", title: "Navigation: Route von links nach rechts planen", backTo: "navigation-auftrag", status: "fertig",
    todo: "auf echten Handys testen (Wischen/Malen, Schwierigkeit: gap, trackLength)" },
  { id: "story-10", type: "info", title: "Simulation erfolgreich (T20)", md: "413e9fcd", button: "WEITER",
    status: "platzhalter", todo: "Text und Bild ersetzen; Geschichte weiterentwickeln" },
  /* Weg zum Hauser-Brunnen: Start (ca. 47.76214624845722 / 8.842223027645755) ist nur etwa 13 m vom Ort 8 (Sternkarte)
     entfernt, also gibt es dafür keinen eigenen Ortungs-Schritt – die Gruppe steht schon dort. Danach zwei Zwischenpunkte
     und das Ziel (Hauser-Brunnen). Zwischen jedem Ort liegt eine Story-Seite. */
  { id: "story-11", type: "info", title: "Das nächste Signal: Weg zum Hauser-Brunnen (T23)", md: "bfaae9dd", button: "WEITER",
    status: "platzhalter", todo: "Story-Text und Bild ersetzen; Verbindung zur „letzten Frage“ in T20 klären" },
  { id: "ort9", type: "locate", title: "Ort 9 (Weg zum Hauser-Brunnen, Zwischenpunkt 1)", lat: 47.76171033989303, lng: 8.840728125758773, status: "fertig" },
  { id: "story-12", type: "info", title: "Erster Zwischenpunkt (T24)", md: "e485be82", button: "WEITER",
    status: "platzhalter", todo: "Story-Text und Bild ersetzen; evtl. Hinweis auf den echten Ort ergänzen" },
  { id: "ort10", type: "locate", title: "Ort 10 (Weg zum Hauser-Brunnen, Zwischenpunkt 2)", lat: 47.761144187762625, lng: 8.84110899942255, status: "fertig" },
  { id: "story-13", type: "info", title: "Zweiter Zwischenpunkt (T25)", md: "d2792e96", button: "WEITER",
    status: "platzhalter", todo: "Story-Text und Bild ersetzen" },
  { id: "ort11", type: "locate", title: "Ort 11 (Hauser-Brunnen)", lat: 47.7606285151739, lng: 8.839440665486844, status: "fertig" },
  { id: "story-14", type: "info", title: "Ankunft am Hauser-Brunnen (T26)", md: "e4a719d8", button: "WEITER",
    status: "platzhalter", todo: "Story-Text und Bild ersetzen; hier folgt später die Aufgabe am Brunnen" },
  /* Am Hauser-Brunnen: Die Festplatte entschlüsseln. Jede Frage ist ein eigener Schritt; eine falsche Antwort führt
     zurück zu Frage 1 (failTo), die Entschlüsselung beginnt also von vorn. Die Frage nach den Stufen des Wassers
     fehlt absichtlich: im Winter ist der Brunnen abgedeckt. Bei Bedarf als weiterer password-Schritt einfügen
     (und die Nummerierung „x von 4“ in den Texten anpassen). */
  { id: "entschluesseln-anleitung", type: "info", title: "Festplatte entschlüsseln: Anleitung (T27)", md: "7e26f7d1", button: "ENTSCHLÜSSELN STARTEN",
    status: "platzhalter", todo: "Story-Text prüfen; früher auf dem Weg Festplattenteile finden lassen (Stories 1–10)" },
  { id: "frage-steine", type: "password", title: "Frage 1: Steine um den Turm (T28)", md: "e8e9df6e", placeholder: "ANZAHL", answers: ["8", "24"], button: "PRÜFEN",
    texts: { empty: "BITTE EINE ZAHL EINGEBEN", ok: "STIMMT ✔", wrong: "DAS STIMMT NICHT – ZÄHLT NOCH EINMAL" },
    status: "fertig", todo: "vor Ort prüfen: 8 oder 24 Steine" },
  { id: "frage-metall", type: "choice", title: "Frage 2: Metall des Turms (T29)", md: "2e662bfe", options: ["Kupfer", "Aluminium", "Edelstahl", "Messing", "Bronze", "Zink"], answers: ["Edelstahl"],
    failTo: "frage-steine", status: "fertig", todo: "vor Ort prüfen: Edelstahl; Auswahl bei Bedarf ändern" },
  { id: "frage-hoehe", type: "estimate", title: "Frage 3: Höhe des Turms schätzen (T30)", md: "049c4674", answer: 12, unit: "m", decimals: 1, placeholder: "SCHÄTZUNG IN METERN (Z. B. 8,5)", button: "PRÜFEN", maxTries: 6,
    status: "fertig", todo: "vor Ort prüfen: 12 m (genau 12,0); nach 6 Versuchen wird die Höhe verraten" },
  { id: "frage-kuenstler", type: "hangman", title: "Frage 4: Künstler des Brunnens als Galgenmännchen (T31)", md: "fe3cda9c", word: "Erich Hauser",
    failTo: "frage-steine", status: "fertig", todo: "vor Ort prüfen: Künstlername „Erich Hauser“ (z. B. Tafel am Brunnen)" },
  { id: "entschluesselt", type: "info", title: "Festplatte entschlüsselt (T32)", md: "59e8aa98", button: "WEITER",
    status: "platzhalter", todo: "Story fertigstellen; danach folgt der dreistellige Code" },
  /* Aktivierungscode des Senders am Brunnen (nichts mit der Festplatte zu tun): ein dreistelliger Code, unendlich viele Versuche. Erste Ziffer: Anzahl der Zeichen der römischen Zahl
     aus dem Rätsel am Anfang; zweite Ziffer: Zahl, die im Rucksack versteckt ist; dritte Ziffer: Hausnummer des Gebäudes, auf
     das der Finger der Marktweiber zeigt (Hausnummer 3, auf dem Foto zu sehen). Lösung: 483. Der Zettel bleibt sichtbar. */
  { id: "code-eingabe", type: "password", title: "Aktivierungscode des Senders (T33 + T34)", md: "90ce1763", noteMd: "5edb4ab3",
    placeholder: "AKTIVIERUNGSCODE (3 ZIFFERN)", answers: ["483"], inputmode: "numeric", maxlength: 3, button: "SENDER AKTIVIEREN",
    texts: { empty: "BITTE DEN CODE EINGEBEN", ok: "SENDER AKTIVIERT ✔", wrong: "DAS IST NICHT DER CODE – PROBIERT ES NOCH EINMAL" },
    status: "platzhalter", todo: "Code 483 steht fest; das Rätsel mit der römischen Zahl (4 Zeichen) am Anfang und die Zahl 8 im Rucksack müssen noch eingebaut werden" },
  { id: "brunnen-geschafft", type: "info", title: "Sender aktiviert: Daten gesendet (T35)", md: "e9777b85", button: "WEITER",
    status: "platzhalter", todo: "Story-Text prüfen; evtl. Bild oder kleine Sende-Animation ergänzen" },
  /* Die Antwort der Aliens: Die Gruppe geht zu einem Ort, an dem sie die Antwort HÖREN kann (ein „Ohr“, ca. 50 m vom Brunnen
     entfernt). Normaler Ortungs-Schritt; die Seite davor nennt den Ort nie als Entfernung. */
  { id: "story-15", type: "info", title: "Die Antwort kommt: zum Ohr gehen (T36)", md: "a367b120", button: "WEITER",
    status: "platzhalter", todo: "Text prüfen; Wortlaut für das Ohr abstimmen" },
  { id: "ohr", type: "locate", title: "Ort 12 (das Ohr, ca. 50 m vom Brunnen)", lat: 47.7610785, lng: 8.8394407, status: "platzhalter",
    todo: "ECHTE KOORDINATEN DES OHRS EINTRAGEN (aktuell nur ein Platzhalter-Punkt 50 m nördlich vom Brunnen)" },
  { id: "story-16", type: "info", title: "Ein Ohr für die Antwort (T37)", md: "68a0892a", button: "WEITER",
    status: "platzhalter", todo: "Hier folgt die Audio-Aufgabe (verzerrte Aufnahme reparieren); Text und Bild ersetzen" },
  /* Die Geschichte ist noch nicht zu Ende: Hier kommt später der Audio-Editor (Aufnahme reparieren) – dann das Ende.
     Das Ende selbst ist vorläufig. */
  { id: "ende", type: "end", title: "Ende, vorläufig (T09)", md: "0845e9c6",
    status: "platzhalter", todo: "echtes Ende schreiben" }
];
