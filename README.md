# Schnitzel.Art – Alien-Rallye (Prototyp)

Eine **Stadtrallye für das Handy** in Singen (Hohentwiel) mit dem Thema **öffentliche Kunst**: Ein Team läuft per GPS von Ort zu Ort, löst kleine Aufgaben und hilft dabei Aliens, deren UFOs in der Stadt abgestürzt sind. Die Rallye ist rund **1 km** lang (Luftlinie) und hat den Start sowie **11 weitere Orte**.

Die App ist eine **reine Webseite** (HTML und JavaScript, kein Build, kein Server, keine Bibliotheken). Sie läuft im Browser von iPhone und Android. Der Fortschritt und die Position bleiben auf dem Handy, es werden keine Daten gesendet.

**Stand:** Prototyp, Oktober 2026. Der Ablauf, alle Aufgaben und die Technik stehen. Texte und Bilder sind teilweise noch Entwürfe (siehe [Offene Punkte](#10-offene-punkte)).

## Inhalt

1. [Die Geschichte](#1-die-geschichte)
2. [Der Ablauf](#2-der-ablauf)
3. [Schnellstart](#3-schnellstart)
4. [Projektstruktur](#4-projektstruktur)
5. [Inhalte ändern](#5-inhalte-ändern)
6. [Module und eigene Module bauen](#6-module)
7. [Regeln für Texte und Gestaltung](#7-regeln-für-texte-und-gestaltung)
8. [Testen](#8-testen)
9. [Technische Hinweise und Grenzen](#9-technische-hinweise-und-grenzen)
10. [Offene Punkte](#10-offene-punkte)
11. [Ideen für später](#11-ideen-für-später)

---

## 1. Die Geschichte

In Singen am Hohentwiel sind mehrere **UFOs abgestürzt**. Die Spieler:innen sind ein **Forschungsteam**, das angeheuert wurde, den Spuren nachzugehen. Die Geschichte beginnt mitten drin: Die Forscher haben schon ein **fremdartiges Handy** der Aliens gefunden (das ist die App). Sprechen können sie mit den Aliens nicht, aber sie **empfangen ihre Signale**. Die Aliens sprechen dabei in verdrehter Satzstellung („Kaputt unser Navigationssystem ist.“).

Das **Navigationssystem der Aliens ist kaputt**, sie finden nicht mehr nach Hause. Das Team sammelt unterwegs sechs **Festplattenteile**, löst „Nebenaufgaben“ und hilft den Aliens:

- Ein **Störsender** muss abgeschaltet werden, damit das Handy wieder klar empfängt.
- Bei den **Marktweibern** passiert der **erste Kontakt**: Die Aliens hören zum ersten Mal Menschen reden.
- Bei der **Sternkarte** (einem Kunstobjekt) berechnet das Team eine neue **Route** für den Heimflug.
- Am **Hauser-Brunnen** wirkt der Metallturm wie ein Funkmast. Das Team entschlüsselt die Festplatte, aktiviert den Sender und schickt Karte und Daten zu den anderen Aliens im All.
- An einem **Ohr** hört das Team die Antwort der Aliens – eine verzerrte Aufnahme, die es erst reparieren muss.

**Zum Kunstaspekt:** Kunstwerke kommen nur am Anfang und am Ende der Ortungs-Strecken vor (Turm VI, Marktweiber, Sternkarte, Hauser-Brunnen). Die Story-Seiten dazwischen sind reine Wegführung: stehen bleiben, lesen, Gedanken machen, weitergehen.

## 2. Der Ablauf

Die Rallye besteht aus **Schritten**. Ein Schritt ist eine Seite oder eine Aufgabe. Man kommt nur weiter, indem man den Schritt erfüllt: Orte lassen sich nicht überspringen, „WEITER“ erscheint erst, wenn man wirklich dort ist.

### Überblick in sechs Abschnitten

| Abschnitt | Was passiert |
|---|---|
| **1. Start am Turm VI** | Das Kunstwerk betrachten, Sicherheitshinweise, Schmierpapier, Story-Start („Das Handy meldet sich“). |
| **2. Orte 2 bis 4** | Festplattenteile 1 bis 3, die erste Nachricht der Aliens (zuerst gestört). **Aufgabe Störsender:** ein Muster aus leuchtenden Tasten merken und nachtippen, dreimal hintereinander. |
| **3. Orte 5 bis 7** | Festplattenteile 4 und 5. Bei den Marktweibern der erste Kontakt. **Aufgabe Dialog:** Die Sätze eines belauschten Streits in die richtige Reihenfolge bringen (standardmäßig auf Schwäbisch, umschaltbar auf Deutsch). |
| **4. Ort 8 (Sternkarte)** | Etwa 50 m westlich der Marktweiber. Festplattenteil 6. Die Karte betrachten. **Aufgabe Navigation:** Eine Route von der Erde zum Heimatplaneten malen, ohne Kometen oder Asteroiden zu berühren, danach Simulation. |
| **5. Hauser-Brunnen (Orte 9 bis 11)** | Zwei Zwischenpunkte, dann der Brunnen. **Aufgabe Festplatte entschlüsseln:** vier Fragen (Steine zählen, Metall wählen, Höhe schätzen, Künstlernamen als Galgenmännchen raten); eine falsche Antwort startet von vorn. **Aktivierungscode** des Senders (3 Ziffern, unendlich viele Versuche) – danach „Daten wurden gesendet“. |
| **6. Ohr (Ort 12) und Ende** | **Aufgabe Antwort reparieren:** Eine verzerrte Aufnahme (rückwärts, zu schnell, verbogene Höhen und Tiefen) wird mit Reglern klar gestellt. Danach das vorläufige Ende. |

### Der Aktivierungscode

Der Code ist **483**. Die Hinweise darauf bekommt das Team teils vor der App (Schreibweise bewusst verdeckt):

1. Die Anzahl der Zeichen der Römerzahl aus dem Rätsel am Anfang (**4**).
2. Die Zahl, die das Team im Rucksack bei sich trägt (**8**).
3. Die Hausnummer, auf die der Finger der Marktweiber zeigt (**3**, ist auf dem Foto auf der Code-Seite zu sehen).

Die ersten beiden Hinweise gehören zum Material vor dem Start der App. Auf dem Notizzettel auf der Code-Seite stehen sie nur verdeckt.

### Orte

Alle Orte laufen mit denselben Regeln (siehe `SETTINGS` in `steps.js`): innerhalb von **20 m** des Ortes sein, das GPS muss auf mindestens **20 m** genau sein und das **5 Sekunden lang** ununterbrochen. Ab 50 m zeigt der Radar „FAST DA“.

| Schritt | Breite, Länge |
|---|---|
| Start: Turm VI (Ort 1) | 47.758796, 8.839484 |
| `ort2` | 47.759443, 8.840597 |
| `ort3` | 47.760106, 8.839980 |
| `ort4` | 47.760581, 8.841502 |
| `ort5` | 47.761149, 8.841116 |
| `ort6` | 47.761706, 8.842635 |
| `ort7` | 47.762258, 8.842852 |
| `ort8` | 47.762260, 8.842276 |
| `ort9` | 47.761710, 8.840728 |
| `ort10` | 47.761144, 8.841109 |
| `ort11` | 47.760629, 8.839441 |
| `ohr` | 47.761044, 8.839113 |

Die Koordinaten von Ort 8, dem Ohr und den Brunnen-Antworten (8 oder 24 Steine, Edelstahl, 12,0 m, Erich Hauser) sind vor Ort zu bestätigen.

### Alle Schritte

Die Tabelle steht in der Reihenfolge der App. Sie lässt sich mit `node tools/overview.js` neu erzeugen. „Platzhalter“ bedeutet: Der Inhalt ist ein Entwurf und muss noch geprüft oder ersetzt werden (Texte, Bilder, Aufnahme).

| Nr | id | Modul | Titel | Text | Bild / Audio | Status |
|---:|----|-------|-------|------|--------------|--------|
| 1 | `einfuehrung` | info | Einführung: Kunstwerk Turm VI betrachten (T01) | 8861a3f4.md |  | Platzhalter |
| 2 | `hinweise-sicherheit` | info | Wichtige Hinweise: Sicherheit (T10) | ce0d842b.md |  | fertig |
| 3 | `hinweise-notizen` | info | Schmierpapier und Stift (T11) | 1b49aee5.md |  | fertig |
| 4 | `story-0` | info | Das Handy meldet sich: Story-Start (T39) | 4beb0d1c.md | 9bde63bf.png | Platzhalter |
| 5 | `ort2` | locate | Ort 2 |  |  | fertig |
| 6 | `story-1` | info | Story 1 (T02) | 2bfc795f.md | bcb145ef.jpg | Platzhalter |
| 7 | `ort3` | locate | Ort 3 |  |  | fertig |
| 8 | `story-2` | info | Story 2 (T03) | 07188df6.md | d558c290.png | Platzhalter |
| 9 | `ort4` | locate | Ort 4 |  |  | fertig |
| 10 | `story-3-gestoert` | info | Story 3, gestört (T04 + T12) | 609fe145.md | 1b921479.jpg | fertig |
| 11 | `stoersender-anleitung` | info | Störsender: Anleitung (T05) | d027c79e.md |  | fertig |
| 12 | `stoersender-1` | memory | Störsender: Code 1 |  |  | fertig |
| 13 | `stoersender-2` | memory | Störsender: Code 2 |  |  | fertig |
| 14 | `stoersender-3` | memory | Störsender: Code 3 |  |  | fertig |
| 15 | `story-3-klar` | info | Story 3, jetzt lesbar + Meldung „abgeschaltet“ (T04 + T06) | 609fe145.md | 1b921479.jpg | Platzhalter |
| 16 | `ort5` | locate | Ort 5 |  |  | fertig |
| 17 | `story-4` | info | Story 4 (T07) | 6181fe9d.md | 07d5b8c6.jpg | Platzhalter |
| 18 | `ort6` | locate | Ort 6 |  |  | fertig |
| 19 | `story-5` | info | Story 5 (T08) | 70e24aae.md | 41b41829.png | Platzhalter |
| 20 | `ort7` | locate | Ort 7 (Marktweiber) |  |  | fertig |
| 21 | `story-6` | info | Story 6: Ankunft bei den Marktweibern (T13) | a404e46e.md | 268d5d70.png | Platzhalter |
| 22 | `story-7` | info | Eine Aufgabe für euch: eigene Dialoge (T14) | bed8f3d0.md | c35292a8.jpg | Platzhalter |
| 23 | `dialog-anleitung` | info | Der belauschte Streit: Anleitung (T15) | 35e6e118.md |  | fertig |
| 24 | `dialog` | dialog | Marktweiber: abgehörte Aufzeichnung ordnen |  |  | fertig |
| 25 | `dialog-fertig` | info | Aufzeichnung rekonstruiert: Gespräch darüber (T16) | e6a5e05c.md |  | fertig |
| 26 | `story-8` | info | Die Aliens schicken euch weiter: 50 m nach Westen (T18) | 84e2cf1f.md | a9897d02.png | Platzhalter |
| 27 | `ort8` | locate | Ort 8 (ca. 50 m westlich der Marktweiber) |  |  | fertig |
| 28 | `story-9` | info | Eine Sternkarte: veraltetes Kunst-Relikt (T19) | 14a6b5ec.md | 28ccfcba.jpg | Platzhalter |
| 29 | `karte-ansehen` | info | Schaut euch die Karte an: herumgehen (T21) | f5e0f468.md |  | Platzhalter |
| 30 | `navigation-auftrag` | info | Ihr übernehmt die Navigation: Auftrag (T22) | 6105ac99.md |  | fertig |
| 31 | `sternenhimmel` | sky | Navigation: Route von links nach rechts planen |  |  | fertig |
| 32 | `story-10` | info | Simulation erfolgreich (T20) | 413e9fcd.md | 2c931172.png | Platzhalter |
| 33 | `story-11` | info | Das nächste Signal: Weg zum Hauser-Brunnen (T23) | bfaae9dd.md |  | Platzhalter |
| 34 | `ort9` | locate | Ort 9 (Weg zum Hauser-Brunnen, Zwischenpunkt 1) |  |  | fertig |
| 35 | `story-12` | info | Erster Zwischenpunkt (T24) | e485be82.md |  | Platzhalter |
| 36 | `ort10` | locate | Ort 10 (Weg zum Hauser-Brunnen, Zwischenpunkt 2) |  |  | fertig |
| 37 | `story-13` | info | Zweiter Zwischenpunkt (T25) | d2792e96.md |  | Platzhalter |
| 38 | `ort11` | locate | Ort 11 (Hauser-Brunnen) |  |  | fertig |
| 39 | `story-14` | info | Ankunft am Hauser-Brunnen (T26) | e4a719d8.md |  | Platzhalter |
| 40 | `entschluesseln-anleitung` | info | Festplatte entschlüsseln: Anleitung (T27) | 7e26f7d1.md |  | fertig |
| 41 | `frage-steine` | password | Frage 1: Steine um den Turm (T28) | e8e9df6e.md |  | fertig |
| 42 | `frage-metall` | choice | Frage 2: Metall des Turms (T29) | 2e662bfe.md |  | fertig |
| 43 | `frage-hoehe` | estimate | Frage 3: Höhe des Turms schätzen (T30) | 049c4674.md |  | fertig |
| 44 | `frage-kuenstler` | hangman | Frage 4: Künstler des Brunnens als Galgenmännchen (T31) | fe3cda9c.md |  | fertig |
| 45 | `entschluesselt` | info | Festplatte entschlüsselt (T32) | 59e8aa98.md |  | fertig |
| 46 | `code-eingabe` | password | Aktivierungscode des Senders (T33 + T34) | 90ce1763.md | d6ad634b.jpg | fertig |
| 47 | `brunnen-geschafft` | info | Sender aktiviert: Daten gesendet (T35) | e9777b85.md |  | Platzhalter |
| 48 | `story-15` | info | Die Antwort kommt: zum Ohr gehen (T36) | a367b120.md |  | fertig |
| 49 | `ohr` | locate | Ort 12 (das Ohr, ca. 50 m vom Brunnen) |  |  | fertig |
| 50 | `story-16` | info | Ein Ohr für die Antwort (T37) | 68a0892a.md |  | Platzhalter |
| 51 | `audio-reparieren` | audio | Die Antwort der Aliens: Aufnahme reparieren (T38) | 7bb26811.md | 9ab34b5c.mp3 | fertig |
| 52 | `ende` | end | Ende, vorläufig (T09) | 0845e9c6.md | a6db5dd6.jpg | Platzhalter |

## 3. Schnellstart

### Lokal ausprobieren

Die Dateien brauchen einen Webserver (nicht per Doppelklick öffnen). Im Projektordner zum Beispiel:

```
python -m http.server 8000
```

oder `npx serve`. Danach `http://localhost:8000/` öffnen. Zum Ausprobieren am Computer ist die **Debug-Seite** am bequemsten: `http://localhost:8000/debug.html`.

### Auf dem Handy

GPS, Kompass und Bewegungssensoren funktionieren auf dem Handy nur über **https://**. Am einfachsten ist ein Webhosting wie **GitHub Pages**: Das Repository veröffentlichen, die Seite `https://…/index.html` auf dem Handy öffnen. Zum Mitnehmen kann man sie zum Home-Bildschirm hinzufügen.

### Die Seiten

| Datei | Zweck |
|---|---|
| `index.html` | **Die Rallye.** Wird nie verlassen. Der Fortschritt bleibt gespeichert, auch nach dem Schließen. |
| `debug.html` | **Entwicklerseite:** Die Rallye im Handy-Fenster, alle Schritte zum Springen, Fake-GPS, Hilfen für jede Aufgabe, Automatik zum Durchspielen, Anzeige der Platzhalter. |
| `init.html` | **Berechtigungen testen:** zeigt, ob Standort, Kompass und Bewegungssensoren auf dem Handy funktionieren und fragt sie erneut ab. |
| `reset.html` | **Fortschritt löschen** und neu beginnen. Praktisch als Lesezeichen für Tests. |

### Die Debug-Seite

- Links die Rallye im Handy-Fenster, rechts die Schrittliste. Ein Tipp auf einen Schritt springt dorthin (das umgeht die Regeln, nur zum Testen).
- Jeder Schritt trägt „fertig“ oder „Platzhalter“ mit einer kurzen Notiz, was noch zu tun ist. Der Filter „nur Platzhalter“ zeigt, was noch zu prüfen ist.
- **Ort:** Fake-GPS (zum Ort teleportieren, 100 m davor, Schritt zum Ort) und Fake-Kompass.
- **Aufgaben:** Je Modul gibt es Knöpfe zum Lösen oder absichtlich Falsch machen.
- **Automatisch durchspielen:** Das Programm trägt Antworten selbst ein und läuft mit Fake-GPS zu allen Orten bis zum Ende.
- Die Seiten der Rallye zeigen **nie** Platzhalter-Hinweise, nur die Debug-Seite.

## 4. Projektstruktur

```
index.html            die Rallye (Aussehen/CSS und Einbindung der Skripte)
steps.js              DIE ANORDNUNG: Reihenfolge der Schritte, alle Inhalte, Orte, Antworten, Einstellungen
core.js               Kern: Fortschritt, GPS, Kompass, Wake Lock, Schritt-Steuerung, eigenes Bestätigungsfenster
markdown.js           lädt und zeigt Texte aus content/ (kleiner, sicherer Markdown-Leser)
modules/              ein Modul pro Datei (siehe Abschnitt 6)
  common.js             gemeinsame Hilfen der Frage-Module
  info.js               Text-/Bildseite       end.js        Abschlussseite
  password.js           Eingabefeld/Code      choice.js     Auswahlfrage
  estimate.js           Zahl schätzen         hangman.js    Galgenmännchen
  locate.js             Ortungs-Radar         memory.js     Störsender (Muster merken)
  dialog.js             Dialog ordnen         sky.js        Route am Sternenhimmel
  audio.js              Aufnahme reparieren
content/              alle Texte (.md), Bilder (.png/.jpg) und die Aufnahme (.mp3) mit Hash-Namen
tools/
  hashify.js            legt Texte/Bilder/Audio mit Hash-Namen in content/ ab
  overview.js           erzeugt die Schritt-Tabelle; --check prüft Schritte und content/
  smoke-test.js         automatischer Durchlauf der ganzen Rallye (Chrome nötig)
debug.html  init.html  reset.html   Hilfsseiten (siehe Abschnitt 3)
old/                  nicht benötigte Dateien, gehören nicht zur App:
                        quellen/            Originale (Foto als HEIC, Aufnahme als WebM)
                        ar.html             kleines WebAR-Experiment für später
                        Prototyp Starlight/ Greenfoot-Prototyp, Inspiration für den Sternenhimmel
```

Geladen wird in dieser Reihenfolge: `steps.js` → `markdown.js` → `core.js` → `modules/*.js` (siehe `index.html`).

## 5. Inhalte ändern

Fast alles ändert sich in **`steps.js`** (Anordnung) und im Ordner **`content/`** (Texte, Bilder, Audio). Am Kopf von `steps.js` steht die vollständige Liste der Felder jedes Moduls.

### Texte

Ein Text ist eine **Markdown-Datei** in `content/`, deren Name ein kurzer Hash ist, zum Beispiel `content/8861a3f4.md`. Im Schritt steht nur die ID: `md: "8861a3f4"`.

- Unterstützt: `# Überschriften`, **fett**, *kursiv*, Listen (`-` und `1.`), Zitate (`>`), Trennlinien, Bilder, Links. HTML im Text wird nie ausgeführt.
- **Neuen Text anlegen:** `node tools/hashify.js --neu` erzeugt eine Datei mit zufälligem Namen und einer Vorlage. Den Namen als `md` in `steps.js` eintragen.
- **Bestehenden Text ändern:** Die Datei in `content/` bearbeiten, der Name bleibt gleich.

### Bilder ersetzen

Alle Bilder erscheinen in einem **festen 16:9-Rahmen** (Vorgabe: **1280 × 720 Pixel**, PNG oder JPG). Andere Formate werden mittig zugeschnitten, das Layout verschiebt sich nie. Ein Tipp auf ein Bild vergrößert es.

- **Bild austauschen:** Die Datei in `content/` mit **demselben Namen** überschreiben (der Name muss nicht zum Inhalt passen). Nach dem Austausch den Cache des Browsers leeren, sonst erscheint das alte Bild noch.
- **Neues Bild einbauen:** `node tools/hashify.js bild.png` kopiert es mit einem Hash-Namen nach `content/`. Im Text einbinden mit `![Beschreibung](hash.png)`.
- Welches Bild in welchem Schritt steht, zeigt die Tabelle in Abschnitt 2. Die meisten Bilder sind noch Platzhalter (Radar-Grafiken).
- Das Foto auf der Code-Seite (Marktweiber) zeigt die Hausnummer 3. Wird es ersetzt, muss die Hausnummer erkennbar bleiben.

### Audio

Die Aufnahme für den letzten Schritt ist eine **MP3-Datei** (läuft auf allen Handys). Mit `node tools/hashify.js aufnahme.mp3` nach `content/` legen und den Namen im Schritt `audio-reparieren` als `src` eintragen. Es wird immer die **Original-Aufnahme** abgelegt: Die App verzerrt sie selbst (rückwärts, schneller, verbogene Höhen und Tiefen, siehe `distort`). Die richtige Einstellung ist jeweils das Gegenteil davon. Wie schwer es ist, regeln `distort`, `tolRate` und `tolEq`.

### Schritte einfügen, ändern, umordnen

Ein Schritt ist ein Objekt in der Liste `STEPS` in `steps.js`. Neuen Schritt an die gewünschte Stelle schreiben, fertig. Die **ids** müssen eindeutig sein; unter ihnen wird der Fortschritt gespeichert (deshalb bleiben Spielstände beim Umordnen gültig). Der Befehl `node tools/overview.js --check` meldet doppelte ids, fehlende Dateien und falsche Sprungziele.

### Orte

Ein Ort ist ein Schritt mit `type: "locate"`, `lat` und `lng`. Radius, Genauigkeit und Haltezeit stehen in `SETTINGS` (für alle Orte) und lassen sich je Ort überschreiben. Zwischen zwei Orten steht mindestens eine Story-Seite.

### Antworten und Codes

| Aufgabe | Schritt | Antwort steht in |
|---|---|---|
| Steine zählen | `frage-steine` | `answers: ["8", "24"]` |
| Metall | `frage-metall` | `answers: ["Edelstahl"]` (Auswahl in `options`) |
| Höhe schätzen | `frage-hoehe` | `answer: 12` |
| Künstlername | `frage-kuenstler` | `word: "Erich Hauser"` |
| Aktivierungscode | `code-eingabe` | `answers: ["483"]` |
| Marktweiber-Dialog | `dialog` | `lines` in der richtigen Reihenfolge (weitere erlaubte Reihenfolgen in `solutions`) |

Hinweis: Die Dateien in `content/` und `steps.js` kann jeder im Browser einsehen. Die Antworten sind also **nicht geheim**; die Hash-Namen verhindern nur das Raten von Dateinamen.

## 6. Module

Jeder Schritt benutzt ein **Modul** (`type`). Ein Modul ist eine Datei in `modules/` und hat eine eigene Oberfläche und Mechanik. Die ausführliche Feldliste steht am Kopf von `steps.js`.

| Modul | Zweck | Wichtige Felder |
|---|---|---|
| `info` | Seite zum Durchlesen | `md`, `button`; optional `garble`, `hintMd`, `leadMd` |
| `locate` | Ortungs-Radar zu einem Ort | `lat`, `lng`; optional `radius`, `approachRadius`, `maxAccuracy`, `holdSeconds` |
| `password` | Eingabefeld für Passwort oder Code | `answers`, `placeholder`; optional `failTo`, `texts`, `noteMd`, `inputmode`, `maxlength` |
| `choice` | Frage mit Auswahlantworten | `options`, `answers`; optional `failTo` |
| `estimate` | Zahl schätzen („zu groß/klein“) | `answer`, `unit`, `decimals`, `maxTries` |
| `hangman` | Galgenmännchen | `word`, `failTo` |
| `memory` | Muster merken und nachtippen (Störsender) | `size`, `dots`, `round`, `rounds`, `failTo` |
| `dialog` | Sätze in die richtige Reihenfolge ziehen | `lines`, `speakers`, `solutions`, `maxFails` |
| `sky` | Route am Sternenhimmel malen | `trackLength`, `gap`, `density`, `backTo` |
| `audio` | Aufnahme mit Reglern reparieren | `src`, `distort`, `tolRate`, `tolEq` |
| `end` | Abschlussseite | `md` |

**Gemeinsame Felder:** `id`, `type`, `title` und `status` ("fertig" oder "platzhalter") und `todo` gibt es nur für die Debug-Seite. `failTo`/`backTo` nennen eine `id`, zu der bei einem Fehler oder über „‹ ZURÜCK“ gesprungen wird.

### Ein neues Modul bauen

1. Datei `modules/meinmodul.js` anlegen:

   ```js
   "use strict";

   registerModule("meinmodul", (ctx) => {
     const S = ctx.step;                       // das Objekt aus steps.js
     const button = h("button", "go", S.button || "WEITER");
     button.type = "button";
     button.addEventListener("click", () => ctx.next());
     ctx.root.append(h("div", "scroller", "", [h("div", "page", "", [button])]));
     return {
       destroy() { /* Timer, Listener aufräumen */ },
       info: () => ({ type: "meinmodul" })      // Zustand für die Debug-Seite
     };
   });
   ```

2. In `index.html` zu den anderen Skripten hinzufügen: `<script src="modules/meinmodul.js"></script>`.
3. In `steps.js` einen Schritt mit `type: "meinmodul"` anlegen und die Felder dort am Kopf dokumentieren.

Der Haupt-Button eines Moduls trägt die Klasse `go` (so findet ihn die Debug-Seite). `ctx` liefert `step`, `root`, `data` (je Schritt speicherbar), `save()`, `next()` und `goToId(id)`. Der Hilfsbaustein `h("tag", "klasse", "text", [kinder])` baut Elemente. Optional kann das Modul `debug…`-Funktionen anbieten, die die Debug-Seite und der Rauchtest benutzen.

## 7. Regeln für Texte und Gestaltung

- **Das Wort „Spiel/spielen“** kommt in keinem Text vor, den Spieler:innen sehen (auch nicht „abspielen“: wir sagen „anhören“). Gesprochen wird von der **Rallye**, von **Aufgaben** und vom **Team**. Die Debug-Seite ist davon ausgenommen. Der Rauchtest prüft das.
- Die Spieler:innen werden mit **„ihr“** angesprochen.
- **Aliens** sprechen in verdrehter Satzstellung („Gemerkt wir haben: Helfen ihr uns wollt.“).
- Die Seiten dazwischen sind **kurze Wegführung**: Man liest, versteht, macht sich Gedanken, geht weiter. Kunstwerke werden nur an den Stationen am Anfang und Ende der Strecken behandelt.
- **Keine Platzhalter-Hinweise** auf den Seiten der Rallye. Entwürfe werden nur in der Debug-Seite markiert (`status`, `todo`).
- **Keine Browser-Dialoge** (`alert`, `confirm`): Rückfragen laufen über das eigene Fenster `confirmBox` in `core.js`.
- Kein auskommentierter Code. Texte stehen in `content/`, nicht im Quellcode.
- Bildschirm **ohne Scrollen** bei Aufgaben, die den Bildschirm füllen (Störsender, Sternenhimmel). Wer nur liest, darf scrollen.
- Der **Fortschritt** liegt im localStorage unter dem Schlüssel `radar.v3` (id des Schritts und Zwischenstände). `reset.html` löscht ihn.

## 8. Testen

```
node tools/overview.js --check     Prüfung von steps.js und content/ (schnell, ohne Browser)
node tools/smoke-test.js           kompletter automatischer Durchlauf in Chrome (ca. 10 Sekunden)
```

Der **Rauchtest** prüft: jeder Schritt öffnet sich ohne Fehler, kein „Spiel“ in den Texten, alle Bilder laden und sitzen im 16:9-Rahmen, die Aufnahme lädt, jede Strecke am Sternenhimmel hat einen freien Weg, und die Automatik spielt die ganze Rallye bis zum Ende. Chrome wird automatisch gesucht, sonst den Pfad in der Umgebungsvariable `CHROME` angeben.

**Was nur auf echten Handys zu testen ist** (der Rauchtest kann es nicht):

- GPS-Berechtigung und Genauigkeit unterwegs, Verhalten bei Display-Sperre
- Kompass auf dem iPhone (`init.html` hilft)
- Wischen und Malen am Sternenhimmel (Schwierigkeit: `gap`, `density`, `trackLength`)
- Töne der Aufnahme (Stumm-Schalter am iPhone, Lautstärke), Bedienung der Regler
- Alle Texte und Bilder am Bildschirm, Lesbarkeit im Freien

## 9. Technische Hinweise und Grenzen

- **Keine Server-Logik:** Alle Daten (Fortschritt, Position) bleiben im Browser des Handys.
- **GPS im Hintergrund** liefert ein Browser nicht zuverlässig. Die App hält deshalb den Bildschirm wach (Wake Lock) und prüft die Position nur, solange die Seite offen ist. Der Radar zeigt laufend „noch X m“.
- **iPhone:** Standort, Kompass und Bewegungssensoren verlangen eine Berechtigung per Antippen. Die App fragt zuerst den Standort ab. `init.html` zeigt, was funktioniert. Ton startet erst nach einem Antippen und folgt dem Stumm-Schalter.
- **Audio:** Die Wiedergabe nutzt die Web Audio API (Puffer, Rückwärts-Kopie, Tempo, Equalizer). Es ist keine Bibliothek nötig.
- **Sternenhimmel:** Die Strecke wird bei jedem Neustart („NOCH EINMAL“) neu aus einem Zufallswert erzeugt; ein freier Weg ist immer garantiert.
- **Browser:** Getestet wurde bisher in Chrome am Computer (automatischer Rauchtest). Safari auf dem iPhone und Chrome auf Android müssen noch draußen geprüft werden.
- Das Projekt hat **keine Abhängigkeiten**. Node.js ist nur für die Hilfswerkzeuge in `tools/` nötig.

## 10. Offene Punkte

- **Bilder:** Fast alle Bilder der Story-Seiten sind Platzhalter (generierte Radar-Grafiken). Austausch siehe Abschnitt 5.
- **Texte:** Die Story-Texte sind Entwürfe. Die Namen der Kunstwerke an Ort 2, 3, 5 und 6 fehlen noch. In der Debug-Seite sind alle Entwürfe als „Platzhalter“ markiert.
- **Aufnahme:** Die Antwort der Aliens ist eingebaut (`content/9ab34b5c.mp3`, 26 Sekunden). Schwierigkeit und Lautstärke auf dem Handy testen.
- **Ende:** Die Abschlussseite ist vorläufig. Offen ist, wie sie genau aussieht und ob die Gruppe zum Museum zurückgeschickt wird (dafür wäre ein weiterer Ortungs-Schritt nötig).
- **Vor Ort prüfen:** Koordinaten von Ort 8 und vom Ohr, die Antworten der Brunnen-Fragen (8 oder 24, Edelstahl, 12,0 m, Erich Hauser), die Marktweiber-Hausnummer 3.
- **Echte Handys:** Der gesamte Ablauf, vor allem GPS, Sternenhimmel und Audio, sollte einmal draußen mit mehreren Geräten durchlaufen werden.
- Die **Telefonnummer des Teams** (für Notfälle) kann auf der Sicherheitsseite ergänzt werden.

## 11. Ideen für später

- **AR:** Das Modulsystem erlaubt es, eine AR-Aufgabe als weiteres Modul einzubauen. Ein erstes Experiment liegt in `old/ar.html` (WebAR mit `<model-viewer>`).
- Eine **Sende-Animation** beim Aktivieren des Senders.
- Weitere **Nebenaufgaben** (zum Beispiel mit der Kamera) als neue Module.
- Eine **Auswertung** am Ende (Zeit, Fehlversuche), wenn das gewünscht ist.
