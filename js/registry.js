/*
 * Geräteregister des MIDI-Helpers.
 *
 * Jede Datei in devices/ ruft MidiHelper.registerDevice(definition) auf.
 * Eine Definition beschreibt Name, Standard-MIDI-Kanal, optional ein
 * stilisiertes Inline-SVG-Icon für den Auswahl-Button (Feld "icon",
 * Strichzeichnung mit currentColor, damit es die Buttonfarbe erbt)
 * und die verfügbaren Funktionen. Jede Funktion liefert über build(params, channel) eine Liste
 * abstrakter MIDI-Nachrichten:
 *
 *   { type: "CC", controller: 0-127, value: 0-127, channel: 1-16, note?: string }
 *   { type: "PC", program: 0-127, bankLsb?: 0-127, channel: 1-16, note?: string }
 *
 * bankLsb erzeugt in der StageTraxx-Ausgabe die Kurzform PC<n>.<bank>@<ch>
 * (StageTraxx sendet dann CC32 vor dem Program Change).
 */
(function () {
  "use strict";

  var devices = [];

  window.MidiHelper = {
    devices: devices,
    registerDevice: function (definition) {
      devices.push(definition);
    }
  };
})();
