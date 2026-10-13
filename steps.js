/* ==========================================================================
   steps.js – DIE ANORDNUNG: Reihenfolge der Schritte und ihre Inhalte
   --------------------------------------------------------------------------
   Das Spiel besteht aus Schritten (STEPS). Jeder Schritt benutzt ein Modul (type):

     info      Text-/Bildseite zum Durchlesen.   Felder: heading, sections[{image, caption, text}], button
     locate    Ortungs-Radar zu einem Ort.       Felder: lat, lng, radius, maxAccuracy, fixes
               (ein Ort = ein Schritt; „WEITER“ erscheint erst am Ort)
     password  Eingabefeld für ein Passwort.     Felder: heading, image, caption, text, placeholder, answers[], button
     end       Abschlussseite.                   Felder: heading, subtitle, image, caption, text

   Gemeinsame Felder: id (eindeutig, unter ihr wird der Fortschritt gespeichert) und
   title (nur für die Debug-Seite).

   Neuen Schritt einbauen: ein Objekt an der gewünschten Stelle in STEPS einfügen.
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
  {
    id: "einfuehrung",
    type: "info",
    title: "Einführung (Story)",
    heading: "INFORMATIONEN",
    sections: [
      { image: "", caption: "BILD-PLATZHALTER 1", text: "Platzhaltertext: Hier steht die Einführung in die Geschichte. Worum geht es, wer sind die Figuren, was ist passiert?" },
      { image: "", caption: "BILD-PLATZHALTER 2", text: "Platzhaltertext: Spielregeln und Hinweise.\n• Bleibt zusammen.\n• Achtet auf den Straßenverkehr.\n• Der Story-Guide führt euch durch das Spiel." },
      { image: "", caption: "BILD-PLATZHALTER 3", text: "Platzhaltertext: Wenn ihr bereit seid, tippt unten auf „Fertig“." }
    ],
    button: "FERTIG"
  },

  { id: "ort1", type: "locate", title: "Ort 1 (Start)", lat: 47.758796076746,    lng: 8.83948384873872 },

  {
    id: "wort1",
    type: "password",
    title: "Story-Guide: Passwort 1",
    heading: "STORY-GUIDE",
    image: "",
    caption: "BILD-PLATZHALTER",
    text: "Platzhaltertext: Hier fragt der Story-Guide nach dem ersten Passwort. Gebt das Codewort aus dem Heft ein.",
    placeholder: "PASSWORT",
    answers: ["platzhalter"],
    button: "PRÜFEN"
  },

  { id: "ort2", type: "locate", title: "Ort 2", lat: 47.759442881868516, lng: 8.8405967427222 },
  { id: "ort3", type: "locate", title: "Ort 3", lat: 47.760105831192874, lng: 8.839979882181922 },
  { id: "ort4", type: "locate", title: "Ort 4", lat: 47.76058112053592,  lng: 8.841501782310322 },
  { id: "ort5", type: "locate", title: "Ort 5", lat: 47.76114913914456,  lng: 8.841115675526469 },
  { id: "ort6", type: "locate", title: "Ort 6", lat: 47.76170564732148,  lng: 8.842634771566102 },
  { id: "ort7", type: "locate", title: "Ort 7 (Ziel: Marktweiber)", lat: 47.76225845637471, lng: 8.842851679977652 },

  {
    id: "ende",
    type: "end",
    title: "Ende",
    heading: "ZIEL ERREICHT",
    subtitle: "DIE ERDE IST GERETTET",
    image: "",
    caption: "BILD-PLATZHALTER",
    text: "Platzhaltertext: Glückwunsch, ihr habt alle Orte gefunden! Hier steht der Abschluss der Geschichte und wie es weitergeht (Treffpunkt, Auswertung, Preise …)."
  }
];
