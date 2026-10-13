/* ==========================================================================
   stations.js – ALLE Inhalte der Rallye
   --------------------------------------------------------------------------
   Reihenfolge im Array = Reihenfolge im Spiel. Jede `id` muss eindeutig sein
   (unter ihr wird der Teil-Fortschritt der Station gespeichert).

   Gemeinsame Felder aller Stationen:
     id         eindeutige Nummer
     type       'riddle' | 'radar' | 'memory' | 'ordering' | 'quiz' | 'audio'
     title      Name der Station
     story      Briefing-Text (Zeilenumbruch mit \n)
     question   Kurze Aufgabe (optional)
     hint       Tipp-Button (optional)
     solvedText Text nach dem Lösen, z. B. Hinweis auf die nächste Station
     reward     { points, artifact: { icon, name } }

   Typ-spezifische Felder stehen direkt an der jeweiligen Station.
   Mit ?debug in der URL (z. B. index.html?debug&station=3) erscheint eine
   Leiste zum Überspringen/Springen – nur zum Testen.
   ========================================================================== */

const stationsData = [
  /* ---------------------------------------------------------------------
     STATION 1 – Briefing  (type: 'riddle')
     answer: String oder Array mit mehreren erlaubten Schreibweisen
     --------------------------------------------------------------------- */
  {
    id: 1,
    type: "riddle",
    title: "Station 1 – Das Briefing",
    story: "Agent, die Invasion hat begonnen. Die Aliens haben ihre Botschaften in unserer Welt versteckt – in Zeitungen, in Codes, in ganz gewöhnlichen Dingen.\nDein Team trägt den Schlüssel zur ersten Spur bereits bei sich.",
    documents: [
      { icon: "🎒", title: "Rucksack-Unterseite", text: "Dreht den Rucksack um. Auf der Unterseite findet ihr alles, was ihr für den Einstieg braucht." },
      { icon: "📰", title: "Zeitungsartikel", text: "Lest den Artikel genau. Auffällig markierte oder falsch gesetzte Buchstaben sind Absicht!" },
      { icon: "🔐", title: "Chiffren", text: "Die Geheimschrift daneben entschlüsselt ihr mit dem Hinweis aus dem Artikel. Das Ergebnis ist ein Lösungswort." }
    ],
    question: "Wie lautet das Lösungswort aus Zeitungsartikel und Chiffre?",
    hint: "Zuerst den Artikel lesen, dann erst die Chiffre knacken.",
    // TODO: echtes Lösungswort eintragen
    answer: ["invasion", "alien"],
    solvedText: "Zugang gewährt. Euer Ortungsgerät wird freigeschaltet – folgt dem Signal!",
    reward: { points: 100, artifact: { icon: "🛸", name: "Antriebskristall" } }
  },

  /* ---------------------------------------------------------------------
     STATION 2 – Ortungsgerät  (type: 'radar')
     target: { lat, lng, radius, range }
       lat/lng  Zielkoordinaten (Rechtsklick in Google Maps → Koordinaten kopieren)
       radius   Meter, ab denen die Station als erreicht gilt
       range    Meter, bis zu denen der Radar den Punkt "heranzoomt"
     answer: optionaler Notfall-Code, falls GPS ausfällt
     --------------------------------------------------------------------- */
  {
    id: 2,
    type: "radar",
    title: "Station 2 – Das Ortungsgerät",
    story: "Ein Alien-Sender versteckt sich irgendwo in der Stadt. Das Ortungsgerät zeigt euch Richtung und Entfernung – je näher ihr kommt, desto schneller pulsiert das Signal.",
    question: "Folgt dem Radar bis zum Sender.",
    hint: "Haltet das Handy flach vor euch – dann dreht sich der Radar mit euch mit.",
    // TODO: echte Koordinaten eintragen (Platzhalter!)
    target: { lat: 48.7784, lng: 9.1800, radius: 25, range: 400 },
    answer: "notfall42",
    solvedText: "Sender lokalisiert! Direkt daneben steht ein Stromkasten – er blockiert das Alien-Signal.",
    reward: { points: 150, artifact: { icon: "📡", name: "Signalverstärker" } }
  },

  /* ---------------------------------------------------------------------
     STATION 3 – Stromkasten  (type: 'memory')
     game: {
       cols, rows   Raster (4 x 5 = 4 Spalten, 5 Zeilen)
       dots         Anzahl der Punkte im Muster
       showMs       Wie lange das Muster sichtbar ist
       maxAttempts  Fehlversuche, bevor das System sperrt
       lockoutSec   Sperrzeit nach zu vielen Fehlern
     }
     --------------------------------------------------------------------- */
  {
    id: 3,
    type: "memory",
    title: "Station 3 – Der Stromkasten",
    story: "Der Stromkasten versorgt den Störsender der Aliens. Hackt das Sicherheitssystem: Merkt euch das Leuchtmuster und baut es aus dem Gedächtnis nach.",
    question: "Prägt euch das Muster ein und tippt danach alle Punkte an.",
    hint: "Merkt euch Formen (Linie, Ecke, Dreieck) statt einzelner Punkte.",
    game: { cols: 4, rows: 5, dots: 6, showMs: 2500, maxAttempts: 3, lockoutSec: 20 },
    solvedText: "Störsender deaktiviert! Aus der Ferne hört ihr aufgeregtes Geschnatter vom Marktplatz …",
    reward: { points: 200, artifact: { icon: "⚡", name: "Energiezelle" } }
  },

  /* ---------------------------------------------------------------------
     STATION 4 – Marktweiber  (type: 'ordering')
     items: Schnipsel in der KORREKTEN Reihenfolge.
       Entweder nur Text oder { text, audio: "audio/datei.mp3" }.
       Die App mischt sie selbst; der Spieler tippt sie in die richtige
       Reihenfolge (zweiter Tipp auf einen gesetzten Schnipsel nimmt ihn zurück).
     --------------------------------------------------------------------- */
  {
    id: 4,
    type: "ordering",
    title: "Station 4 – Die Marktweiber",
    story: "Zwei Marktweiber haben die Aliens belauscht – aber ihr Gespräch ist völlig durcheinandergeraten. Bringt die Sätze in die richtige Reihenfolge, dann verraten sie euch, wo das nächste Kunstwerk steht.",
    question: "Tippt die Schnipsel in der Reihenfolge an, in der das Gespräch Sinn ergibt.",
    hint: "Fängt jemand mit einer Frage an? Wer antwortet darauf?",
    // TODO: eigene Dialoge / Audio-Dateien einsetzen (Beispieltext)
    items: [
      { text: "He, Gretel, hosch du des au gseh? Do stoht ebbes Komisches mitte uffm Platz!" },
      { text: "Was soll dees do? Der Hund hot do gar nix verlora!" },
      { text: "Des isch koi Hund, des isch Kunscht, du Dubbel!" },
      { text: "Kunscht? Do leg i dir glei en Haufa Schtoi na ond sag au, des isch Kunscht!" },
      { text: "Noi, noi – gang liaber zom Brunne ond guck dir dees Ding genau a. Der Hauser woiß Bescheid!" }
    ],
    solvedText: "HINWEIS: Das nächste Kunstwerk ist der Hauser-Brunnen. Geht hin und schaut ganz genau hin!",
    reward: { points: 200, artifact: { icon: "🗣️", name: "Schwäbischer Übersetzer" } }
  },

  /* ---------------------------------------------------------------------
     STATION 5 – Hauser-Brunnen  (type: 'quiz')
     questions: nacheinander gestellt. Fragetypen:
       'number'    Genaue Zahl             { answer: 12 }
       'choice'    Auswahl                 { options: [...], answer: "Text" }
       'text'      Freitext                { answer: ["a", "b"] }
       'estimate'  Schätzfrage             { answer: 8, tolerance: 1.5, unit: "m" }
     code: abschließende Ziffern-Eingabe
       length   Anzahl Ziffern
       answer   richtiger Code als String
       clues    Hinweiskarten { icon, title, text, image? }
                image = optionaler Bildpfad (z. B. "img/roemisch.jpg"),
                sonst wird das Emoji (icon) groß angezeigt.
     --------------------------------------------------------------------- */
  {
    id: 5,
    type: "quiz",
    title: "Station 5 – Der Hauser-Brunnen",
    story: "Dieses Kunstwerk ist ein Tor der Aliens. Untersucht es gründlich – nur wer seine Geheimnisse kennt, kann den Öffnungscode berechnen.",
    question: "Beantwortet erst die Fragen zum Kunstwerk, dann berechnet den 3-stelligen Code.",
    hint: "Schaut euch das Kunstwerk von allen Seiten an. Auch Infotafeln helfen.",
    // TODO: alle Antworten mit den echten Werten vor Ort ersetzen (Beispielwerte!)
    questions: [
      { type: "number",   q: "Wie viele Stufen führen zum Kunstwerk?", answer: 5, hint: "Zählt jede Stufe einzeln." },
      { type: "number",   q: "Aus wie vielen Steinblöcken besteht der Brunnen?", answer: 12, hint: "Zählt auch die verdeckten Seiten." },
      { type: "choice",   q: "Aus welchem Material ist das Kunstwerk gefertigt?", options: ["Bronze", "Edelstahl", "Marmor", "Holz"], answer: "Edelstahl" },
      { type: "text",     q: "Wie heißt der Künstler?", answer: ["erich hauser", "hauser"], hint: "Der Nachname steht im Namen des Brunnens." },
      { type: "estimate", q: "Schätzt: Wie hoch ist das Kunstwerk (in Metern)?", answer: 4, tolerance: 1.5, unit: "m" }
    ],
    code: {
      length: 3,
      answer: "372",   // TODO: echten Code eintragen
      clues: [
        { icon: "🏛️", title: "1. Ziffer – Römische Zahl", text: "Schreibt die Jahreszahl der Entstehung in römischen Ziffern. Wie viele Zeichen hat sie?" },
        { icon: "🎒", title: "2. Ziffer – Die mitgeführte Zahl", text: "Nehmt die Zahl, die ihr seit dem Start mit euch tragt, und bildet ihre Quersumme." },
        { icon: "🧭", title: "3. Ziffer – Richtungshinweis", text: "In welche Himmelsrichtung zeigt die Spitze? Norden = 1, Osten = 2, Süden = 3, Westen = 4." }
      ]
    },
    solvedText: "Das Tor öffnet sich! Aus dem Inneren dringt ein seltsames Flüstern … setzt Kopfhörer auf und folgt dem Ohr.",
    reward: { points: 300, artifact: { icon: "🗿", name: "Tor-Schlüssel" } }
  },

  /* ---------------------------------------------------------------------
     STATION 6 – Das Ohr  (type: 'audio')
     audio: {
       src       Pfad zu einer Audiodatei (z. B. "audio/ohr.mp3"). Fehlt src,
                 wird die Botschaft als Morse-Signal erzeugt (Demo-Modus).
       morse     Text, der im Demo-Modus gemorst wird
       channel   'left' | 'right' – auf welchem Ohr die Botschaft zu hören ist.
                 Das andere Ohr bekommt Störrauschen (Option noise: 0–1).
       unit      Morse-Tempo in Sekunden pro Punkt (Demo-Modus)
     }
     answer: erwartete Lösung (String oder Array)
     --------------------------------------------------------------------- */
  {
    id: 6,
    type: "audio",
    title: "Station 6 – Das Ohr",
    story: "Die Aliens senden ihre letzte Botschaft – aber sie haben sie manipuliert. Die entscheidende Nachricht liegt nur auf einem Ohr, das andere wird von Störgeräuschen übertönt.",
    question: "Hört genau hin und gebt die Botschaft ein.",
    hint: "Kopfhörer aufsetzen! Hört einmal nur mit dem linken Ohr zu.",
    audio: { morse: "KOMET", channel: "left", noise: 0.12, unit: 0.14 },
    answer: ["komet"],
    solvedText: "Botschaft entschlüsselt! Die Aliens ziehen sich zurück …",
    reward: { points: 400, artifact: { icon: "☄️", name: "Alien-Botschaft" } }
  }
];
