/*
 * Kemper Profiler Stage
 * Quelle: KEMPER PROFILER MIDI Parameter Documentation 14.1, Seiten 8–11
 * (Tabellen "MIDI CC continuous controllers" und "MIDI CC switches").
 */
(function () {
  "use strict";

  // Effektmodule an/aus. Bei DLY/REV bestimmt die CC-Nummer, ob die
  // Delay-/Hall-Fahne beim Ausschalten ausklingt (Spillover) oder nicht.
  var MODULES = [
    { value: 17, label: "Modul A" },
    { value: 18, label: "Modul B" },
    { value: 19, label: "Modul C" },
    { value: 20, label: "Modul D" },
    { value: 22, label: "Modul X" },
    { value: 24, label: "Modul MOD" },
    { value: 27, label: "Modul DLY (mit Spillover)" },
    { value: 26, label: "Modul DLY (ohne Spillover)" },
    { value: 29, label: "Modul REV (mit Spillover)" },
    { value: 28, label: "Modul REV (ohne Spillover)" }
  ];

  var CONTINUOUS = [
    { value: 1, label: "Wah-Pedal" },
    { value: 4, label: "Pitch-Pedal" },
    { value: 7, label: "Volume-Pedal" },
    { value: 10, label: "Panorama" },
    { value: 11, label: "Morph-Pedal" },
    { value: 68, label: "Delay Mix" },
    { value: 69, label: "Delay Feedback" },
    { value: 70, label: "Reverb Mix" },
    { value: 71, label: "Reverb Time" },
    { value: 72, label: "Gain" },
    { value: 73, label: "Monitor-Volume" }
  ];

  function optionLabel(options, value) {
    for (var i = 0; i < options.length; i++) {
      if (options[i].value === value) return options[i].label;
    }
    return String(value);
  }

  window.MidiHelper.registerDevice({
    id: "kemper-profiler-stage",
    name: "Kemper Profiler Stage",
    defaultChannel: 1,
    functions: [
      {
        id: "patch-performance",
        label: "Performance-Modus",
        primary: true,
        params: [
          { id: "performance", label: "Performance", type: "number", min: 1, max: 125, default: 1 },
          {
            id: "slot", label: "Slot", type: "select", default: 1,
            options: [
              { value: 1, label: "Slot 1" },
              { value: 2, label: "Slot 2" },
              { value: 3, label: "Slot 3" },
              { value: 4, label: "Slot 4" },
              { value: 5, label: "Slot 5" }
            ]
          }
        ],
        build: function (p, ch) {
          // CC#47 wählt die Performance vor (Wert = Nummer - 1),
          // CC#50–54 laden Slot 1–5; Wert 0 schließt die Transaktion ab,
          // damit erneutes Senden kein Morphing auslöst.
          var slotCc = 49 + p.slot;
          return [
            { type: "CC", controller: 47, value: p.performance - 1, channel: ch, note: "Performance " + p.performance + " vorwählen" },
            { type: "CC", controller: slotCc, value: 1, channel: ch, note: "Slot " + p.slot + " laden" },
            { type: "CC", controller: slotCc, value: 0, channel: ch, note: "Transaktion abschließen" }
          ];
        }
      },
      {
        id: "patch-browser",
        label: "Browser-Modus",
        primary: true,
        help: "Lädt das Rig, dem diese Program-Change-Nummer im Browse-Modus zugewiesen ist.",
        params: [
          { id: "program", label: "Program Change (0–127)", type: "number", min: 0, max: 127, default: 0 },
          {
            id: "bank", label: "Bank (CC#32)", type: "select", default: -1,
            options: [
              { value: -1, label: "keine" },
              { value: 0, label: "Bank 0" },
              { value: 1, label: "Bank 1" },
              { value: 2, label: "Bank 2" },
              { value: 3, label: "Bank 3" },
              { value: 4, label: "Bank 4" }
            ]
          }
        ],
        build: function (p, ch) {
          var msg = { type: "PC", program: p.program, channel: ch, note: "Rig mit PC-Nummer " + p.program + " laden" };
          if (p.bank >= 0) msg.bankLsb = p.bank;
          return [msg];
        }
      },
      {
        id: "module-toggle",
        label: "Effektmodul an/aus",
        params: [
          { id: "module", label: "Modul", type: "select", options: MODULES, default: 17 },
          {
            id: "state", label: "Zustand", type: "select", default: 1,
            options: [{ value: 1, label: "An" }, { value: 0, label: "Aus" }]
          }
        ],
        build: function (p, ch) {
          return [{
            type: "CC", controller: p.module, value: p.state, channel: ch,
            note: optionLabel(MODULES, p.module) + (p.state ? " einschalten" : " ausschalten")
          }];
        }
      },
      {
        id: "modules-all",
        label: "Alle Module umschalten",
        params: [],
        build: function (p, ch) {
          return [{ type: "CC", controller: 16, value: 1, channel: ch, note: "alle Module A–REV zwischen an/aus umschalten" }];
        }
      },
      {
        id: "continuous",
        label: "Regler setzen",
        params: [
          { id: "target", label: "Regler", type: "select", options: CONTINUOUS, default: 7 },
          { id: "value", label: "Wert", type: "number", min: 0, max: 127, default: 64 }
        ],
        build: function (p, ch) {
          return [{
            type: "CC", controller: p.target, value: p.value, channel: ch,
            note: optionLabel(CONTINUOUS, p.target) + " auf " + p.value + " setzen"
          }];
        }
      },
      {
        id: "performance-nav",
        label: "Performance +/−",
        params: [
          {
            id: "direction", label: "Richtung", type: "select", default: 48,
            options: [
              { value: 48, label: "Nächste Performance" },
              { value: 49, label: "Vorherige Performance" }
            ]
          }
        ],
        build: function (p, ch) {
          return [{
            type: "CC", controller: p.direction, value: 0, channel: ch,
            note: p.direction === 48 ? "Performance-Index um 1 erhöhen" : "Performance-Index um 1 verringern"
          }];
        }
      },
      {
        id: "tap",
        label: "Tap Tempo",
        params: [],
        build: function (p, ch) {
          return [{ type: "CC", controller: 30, value: 0, channel: ch, note: "Tap Tempo auslösen" }];
        }
      },
      {
        id: "tuner",
        label: "Tuner",
        params: [
          {
            id: "state", label: "Zustand", type: "select", default: 1,
            options: [{ value: 1, label: "Öffnen" }, { value: 0, label: "Schließen" }]
          }
        ],
        build: function (p, ch) {
          return [{ type: "CC", controller: 31, value: p.state, channel: ch, note: p.state ? "Tuner-Modus öffnen" : "Tuner-Modus schließen" }];
        }
      },
      {
        id: "morph",
        label: "Morph-Taster",
        params: [
          {
            id: "state", label: "Ziel", type: "select", default: 1,
            options: [{ value: 1, label: "Morph-Sound" }, { value: 0, label: "Base-Sound" }]
          }
        ],
        build: function (p, ch) {
          return [{
            type: "CC", controller: 80, value: p.state, channel: ch,
            note: p.state ? "Rampe zum Morph-Sound (Rise Time)" : "Rampe zum Base-Sound (Fall Time)"
          }];
        }
      },
      {
        id: "rotary",
        label: "Rotary-Speaker",
        params: [
          {
            id: "speed", label: "Geschwindigkeit", type: "select", default: 1,
            options: [{ value: 1, label: "Schnell" }, { value: 0, label: "Langsam" }]
          }
        ],
        build: function (p, ch) {
          return [{ type: "CC", controller: 33, value: p.speed, channel: ch, note: p.speed ? "Rotary schnell" : "Rotary langsam" }];
        }
      },
      {
        id: "effect-button",
        label: "Effect Button I–IIII",
        params: [
          {
            id: "button", label: "Taster", type: "select", default: 75,
            options: [
              { value: 75, label: "Effect Button I" },
              { value: 76, label: "Effect Button II" },
              { value: 77, label: "Effect Button III" },
              { value: 78, label: "Effect Button IIII" }
            ]
          }
        ],
        build: function (p, ch) {
          var name = "Effect Button " + ["I", "II", "III", "IIII"][p.button - 75];
          return [
            { type: "CC", controller: p.button, value: 1, channel: ch, note: name + " drücken" },
            { type: "CC", controller: p.button, value: 0, channel: ch, note: name + " loslassen" }
          ];
        }
      }
    ]
  });
})();
