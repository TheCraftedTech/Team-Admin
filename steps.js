/* ==========================================================================
   steps.js – DIE ANORDNUNG: Reihenfolge der Schritte und ihre Inhalte
   --------------------------------------------------------------------------
   Das Spiel besteht aus Schritten (STEPS). Jeder Schritt benutzt ein Modul (type):

     info      Text-/Bildseite zum Durchlesen.   Felder: md, button
     locate    Ortungs-Radar zu einem Ort.       Felder: lat, lng, radius, maxAccuracy, fixes
               (ein Ort = ein Schritt; „WEITER“ erscheint erst am Ort)
     password  Eingabefeld für ein Passwort.     Felder: md (Text darüber), placeholder, answers[], button
     memory    Minispiel: Muster merken und nachtippen (Seite 1 Anleitung, Seite 2 Spiel – ohne Scrollen).
                                                 Felder: md (Anleitung), button (Anleitung → Spiel), startLabel (Start im Spiel),
                                                 size (Raster, 5 = 5×5), dots (leuchtende Tasten; Zahl oder Liste je Runde, z. B. [4, 5, 6]),
                                                 rounds (Runden hintereinander; ein Fehler = Kombo von vorne),
                                                 blinks (wie oft das Muster blinkt), onMs, offMs (Blinktempo)
     end       Abschlussseite.                   Felder: md

   Gemeinsame Felder: id (eindeutig, unter ihr wird der Fortschritt gespeichert) und
   title (nur für die Debug-Seite).

   TEXTE UND BILDER (Markdown): md ist die ID einer Datei im Ordner content/, z. B. md: "8861a3f4"
   lädt content/8861a3f4.md. Bilder liegen im selben Ordner, ebenfalls mit Hash als Namen, und
   werden im Markdown nur mit dem Dateinamen eingebunden:  ![Beschreibung](769642ab.png)
   Hash-Namen anlegen:  node tools/hashify.js bild.png text.md   (kopiert die Dateien nach content/)
   oder einen neuen Text mit festem Namen:  node tools/hashify.js --neu
   Achtung: Wer die Seite im Browser untersucht, kann alle Dateien in content/ abrufen – Hash-Namen
   verhindern nur das Erraten, keine Einsicht in steps.js.

   Neuen Schritt einbauen: ein Objekt an der gewünschten Stelle in STEPS einfügen.
   Das Modul „password“ ist fertig, wird aber noch von keinem Schritt benutzt: Sobald die Passwörter
   des Story-Guides feststehen, kommt dort, wo sie gebraucht werden, ein Schritt mit type: "password"
   und answers: [ … ] hinein.
   Neues Modul bauen: in modules.js mit registerModule("name", (ctx) => …) anlegen und
   hier mit type: "name" benutzen.

   image: Pfad zu einem Bild (z. B. "img/start.jpg"). Leer = gestrichelte Platzhalterfläche.
   ========================================================================== */

/* Vorgabewerte für alle „locate“-Schritte (jeder Schritt kann sie einzeln überschreiben) */
const SETTINGS = {
  radius: 50,          // Meter: so nah muss man am Ort sein, damit „WEITER“ erscheint
  maxAccuracy: 50,     // Meter: das GPS muss mindestens so genau sein, sonst zählt die Ankunft nicht
  fixes: 2             // So viele GPS-Messungen in Folge müssen im Radius liegen
};

const STEPS = [
  { id: "einfuehrung", type: "info", title: "Einführung (Story)", md: "8861a3f4", button: "FERTIG" },

  /* Ort 1 ist der Start (Turm VI, 47.758796076746 / 8.83948384873872): Dort findet die Einführung statt,
     deshalb gibt es dafür keinen eigenen Ortungs-Schritt. Die Orte 2 bis 7 folgen der Reihe nach. */
  { id: "ort2", type: "locate", title: "Ort 2", lat: 47.759442881868516, lng: 8.8405967427222 },
  { id: "ort3", type: "locate", title: "Ort 3", lat: 47.760105831192874, lng: 8.839979882181922 },
  { id: "ort4", type: "locate", title: "Ort 4", lat: 47.76058112053592,  lng: 8.841501782310322 },

  { id: "stoersender", type: "memory", title: "Minispiel: Störsender", md: "d027c79e", button: "ZUM SPIEL", startLabel: "STÖRSENDER ANGREIFEN", size: 5, dots: 5, rounds: 3 },

  { id: "ort5", type: "locate", title: "Ort 5", lat: 47.76114913914456,  lng: 8.841115675526469 },
  { id: "ort6", type: "locate", title: "Ort 6", lat: 47.76170564732148,  lng: 8.842634771566102 },
  { id: "ort7", type: "locate", title: "Ort 7 (Ziel: Marktweiber)", lat: 47.76225845637471, lng: 8.842851679977652 },

  { id: "ende", type: "end", title: "Ende", md: "0845e9c6" }
];
