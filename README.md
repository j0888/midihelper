# MIDI-Helper

Minimalistische Webapp, die MIDI-Befehle für Geräte berechnet und im
[StageTraxx 4 Format](https://stagetraxx.com/docs/v4/midi/) zum Kopieren
ausgibt — z. B. `[midi: CC47.4@1, CC50.1@1, CC50.0@1]` für den Songtext.

Enthaltene Geräte:

- **Kemper Profiler Stage** — Patch-Wechsel im Performance-Modus
  (Performance 1–125 + Slot 1–5) oder Browser-Modus (Program Change,
  optional Bank), dazu Effektmodule, Regler, Tap, Tuner, Morph u. a.
- **Hotone Ampero II Stomp** — Patch-Wechsel per Bank (0–99) + Patch (1–3)
  oder fortlaufender Nummer (1–300), dazu Scenes, Tempo/Tap, Tuner,
  Footswitches, Effekt-Slots u. a.
- **IK Multimedia ToneX Pedal** — Preset-Wechsel per Bank (00–49) +
  Slot (A/B/C) oder fortlaufender Nummer (1–150), dazu Bypass,
  Preset-/Bank-Navigation, Tuner, Tap, Effekte an/aus, Effekt-Typen
  und Regler (Gain, EQ, Model Volume/Mix …).

## Benutzung

Reine statische Seite ohne Build und ohne Abhängigkeiten:
`index.html` direkt im Browser öffnen oder z. B. mit
`python3 -m http.server` ausliefern (auch für GitHub Pages geeignet).

1. Gerät oben auswählen, MIDI-Kanal einstellen (wird gemerkt).
2. Patch-Umschaltung ausfüllen — die Ausgabe aktualisiert sich live.
3. „Senden bei" bestimmt den Zeitpunkt, zu dem StageTraxx die Befehle
   schickt: **Laden** → `[midi: …]` (beim Laden des Songs),
   **Play** → `[midi@play: …]` (beim Start der Wiedergabe),
   **Stop** → `[midi@stop: …]` (beim Stoppen).
4. „Kopieren" legt die gewählte Zeile in die Zwischenablage;
   sie kann direkt in den StageTraxx-Songtext eingefügt werden.
5. Unter „Weitere Funktionen" stehen die übrigen MIDI-Steuerungen
   des Geräts (Effekte, Tempo, Tuner …).

## Neues Gerät hinzufügen

1. Datei `devices/mein-geraet.js` anlegen (Vorlage: vorhandene Dateien):

   ```js
   (function () {
     "use strict";
     window.MidiHelper.registerDevice({
       id: "mein-geraet",
       name: "Mein Gerät",
       defaultChannel: 1,
       functions: [
         {
           id: "patch",
           label: "Patch wählen",
           primary: true, // erscheint im Bereich „Patch umschalten"
           params: [
             { id: "nr", label: "Patch (1–128)", type: "number", min: 1, max: 128, default: 1 }
           ],
           build: function (p, ch) {
             return [{ type: "PC", program: p.nr - 1, channel: ch, note: "Patch " + p.nr + " laden" }];
           }
         }
       ]
     });
   })();
   ```

2. In `index.html` einbinden: `<script src="devices/mein-geraet.js"></script>`
   (vor `js/format.js`).

`build(params, channel)` liefert eine Liste von Nachrichten:

| Nachricht | Felder | StageTraxx-Ausgabe |
| --- | --- | --- |
| Control Change | `{ type: "CC", controller, value, channel, note? }` | `CC<nr>.<wert>@<kanal>` |
| Program Change | `{ type: "PC", program, channel, note? }` | `PC<nr>@<kanal>` |
| PC mit Bank-LSB | `{ type: "PC", program, bankLsb, channel, note? }` | `PC<nr>.<bank>@<kanal>` (StageTraxx sendet CC32 vorweg) |

Parameter-Typen: `number` (mit `min`/`max`/`default`) und `select`
(mit `options: [{ value, label }]`). `note` erscheint in der
Klartext-Erklärung. Funktionen mit `primary: true` bilden die
Modus-Umschalter im Patch-Bereich, alle übrigen landen unter
„Weitere Funktionen".

Optional kann die Gerätedefinition ein Feld `icon` enthalten: ein
Inline-SVG-String (Strichzeichnung mit `stroke="currentColor"`), der
im Auswahl-Button vor dem Namen angezeigt wird und die Buttonfarbe
erbt. Ohne `icon` zeigt der Button nur den Namen.

## Tests

```sh
node tests/mapping-test.mjs
```

Prüft die Umrechnungslogik gegen die in den Hersteller-Dokumenten
belegten Eckfälle (Kemper Performance/Slot → CC47/CC50–54, Ampero
Patch-Tabelle → CC0 + PC, Tempo-Split CC74/75).

## Quellen

- KEMPER PROFILER MIDI Parameter Documentation 14.1 (S. 8–11, CC-Tabellen)
- Hotone Ampero II Stomp MIDI Control Information List, Firmware V2.0.0
- IK Multimedia TONEX Pedal User Manual, Kapitel „MIDI specifications"
  (S. 36–41)
- [StageTraxx 4 MIDI-Dokumentation](https://stagetraxx.com/docs/v4/midi/)
