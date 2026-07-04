/*
 * Hotone Ampero II Stomp
 * Quelle: Ampero II Stomp MIDI Control Information List (EN), Firmware V2.0.0.
 *
 * Patches heißen P00-1 bis P99-3 (Bank 00–99, Patch 1–3). Der globale Index
 * i = Bank·3 + (Patch−1) liegt bei 0–299 und wird als Bank-MSB (CC#0,
 * i div 128) plus Program Change (i mod 128) gesendet — entsprechend der
 * Tabelle im PDF (z. B. P42-2 → CC0=0/PC127, P85-2 → CC0=2/PC0).
 */
(function () {
  "use strict";

  function patchMessages(index, patchName, ch) {
    var msb = Math.floor(index / 128);
    var pc = index % 128;
    return [
      { type: "CC", controller: 0, value: msb, channel: ch, note: "Bank MSB " + msb + " wählen" },
      { type: "PC", program: pc, channel: ch, note: "Patch " + patchName + " laden" }
    ];
  }

  function patchName(bank, patch) {
    return "P" + (bank < 10 ? "0" + bank : bank) + "-" + patch;
  }

  var SLOTS = [
    { value: 48, label: "Slot A1" }, { value: 49, label: "Slot A2" },
    { value: 50, label: "Slot A3" }, { value: 51, label: "Slot A4" },
    { value: 52, label: "Slot A5" }, { value: 53, label: "Slot A6" },
    { value: 54, label: "Slot B1" }, { value: 55, label: "Slot B2" },
    { value: 56, label: "Slot B3" }, { value: 57, label: "Slot B4" },
    { value: 58, label: "Slot B5" }, { value: 59, label: "Slot B6" }
  ];

  function optionLabel(options, value) {
    for (var i = 0; i < options.length; i++) {
      if (options[i].value === value) return options[i].label;
    }
    return String(value);
  }

  window.MidiHelper.registerDevice({
    id: "ampero-ii-stomp",
    name: "Ampero II Stomp",
    defaultChannel: 1,
    functions: [
      {
        id: "patch-bank",
        label: "Bank + Patch",
        primary: true,
        params: [
          { id: "bank", label: "Bank (0–99)", type: "number", min: 0, max: 99, default: 0 },
          {
            id: "patch", label: "Patch", type: "select", default: 1,
            options: [
              { value: 1, label: "Patch 1" },
              { value: 2, label: "Patch 2" },
              { value: 3, label: "Patch 3" }
            ]
          }
        ],
        build: function (p, ch) {
          var index = p.bank * 3 + (p.patch - 1);
          return patchMessages(index, patchName(p.bank, p.patch), ch);
        }
      },
      {
        id: "patch-direct",
        label: "Patch-Nummer",
        primary: true,
        help: "Fortlaufende Nummer 1–300: Nr. 1 = P00-1, Nr. 4 = P01-1 usw.",
        params: [
          { id: "number", label: "Patch-Nummer (1–300)", type: "number", min: 1, max: 300, default: 1 }
        ],
        build: function (p, ch) {
          var index = p.number - 1;
          return patchMessages(index, patchName(Math.floor(index / 3), (index % 3) + 1), ch);
        }
      },
      {
        id: "scene",
        label: "Scene wählen",
        params: [
          {
            id: "scene", label: "Scene", type: "select", default: 1,
            options: [
              { value: 1, label: "Scene 1" },
              { value: 2, label: "Scene 2" },
              { value: 3, label: "Scene 3" }
            ]
          }
        ],
        build: function (p, ch) {
          return [{ type: "CC", controller: 25, value: p.scene, channel: ch, note: "Scene " + p.scene + " im aktuellen Patch" }];
        }
      },
      {
        id: "patch-nav",
        label: "Patch/Bank +/−",
        params: [
          {
            id: "action", label: "Aktion", type: "select", default: 27,
            options: [
              { value: 27, label: "Patch +" },
              { value: 26, label: "Patch −" },
              { value: 23, label: "Bank +" },
              { value: 22, label: "Bank −" }
            ]
          }
        ],
        build: function (p, ch) {
          var labels = { 27: "nächstes Patch", 26: "vorheriges Patch", 23: "nächste Bank", 22: "vorherige Bank" };
          return [{ type: "CC", controller: p.action, value: 127, channel: ch, note: labels[p.action] }];
        }
      },
      {
        id: "tempo",
        label: "Tempo (BPM) setzen",
        params: [
          { id: "bpm", label: "Tempo (40–300 BPM)", type: "number", min: 40, max: 300, default: 120 }
        ],
        build: function (p, ch) {
          // Tempo als MSB/LSB-Paar: CC74=0 → CC75 = 40–127 BPM direkt,
          // CC74=1 → BPM 128–255, CC74=2 → BPM 256–300 (PDF, CC#74/75).
          var msb = Math.floor(p.bpm / 128);
          var lsb = p.bpm % 128;
          return [
            { type: "CC", controller: 74, value: msb, channel: ch, note: "Tempo MSB" },
            { type: "CC", controller: 75, value: lsb, channel: ch, note: "Tempo LSB → " + p.bpm + " BPM" }
          ];
        }
      },
      {
        id: "tap",
        label: "Tap Tempo",
        params: [],
        build: function (p, ch) {
          return [{ type: "CC", controller: 76, value: 127, channel: ch, note: "Tap Tempo auslösen" }];
        }
      },
      {
        id: "tuner",
        label: "Tuner",
        params: [
          {
            id: "state", label: "Zustand", type: "select", default: 127,
            options: [{ value: 127, label: "An" }, { value: 0, label: "Aus" }]
          }
        ],
        build: function (p, ch) {
          return [{ type: "CC", controller: 60, value: p.state, channel: ch, note: p.state ? "Tuner einschalten" : "Tuner ausschalten" }];
        }
      },
      {
        id: "patch-volume",
        label: "Patch-Volume",
        params: [
          { id: "volume", label: "Volume (0–100)", type: "number", min: 0, max: 100, default: 100 }
        ],
        build: function (p, ch) {
          return [{ type: "CC", controller: 7, value: p.volume, channel: ch, note: "Patch-Volume auf " + p.volume + " setzen" }];
        }
      },
      {
        id: "expression",
        label: "Expression-Pedal",
        params: [
          { id: "value", label: "Wert (0–127)", type: "number", min: 0, max: 127, default: 64 }
        ],
        build: function (p, ch) {
          return [{ type: "CC", controller: 11, value: p.value, channel: ch, note: "Expression-Pedal (EXP 1/2) auf " + p.value }];
        }
      },
      {
        id: "exp-switch",
        label: "EXP 1/2 umschalten",
        params: [
          {
            id: "target", label: "Pedal", type: "select", default: 0,
            options: [{ value: 0, label: "EXP 1" }, { value: 127, label: "EXP 2" }]
          }
        ],
        build: function (p, ch) {
          return [{ type: "CC", controller: 13, value: p.target, channel: ch, note: p.target ? "auf EXP 2 umschalten" : "auf EXP 1 umschalten" }];
        }
      },
      {
        id: "footswitch",
        label: "Footswitch-Slot umschalten",
        params: [
          {
            id: "fs", label: "Footswitch", type: "select", default: 79,
            options: [
              { value: 79, label: "FS 1" },
              { value: 80, label: "FS 2" },
              { value: 81, label: "FS 3" }
            ]
          }
        ],
        build: function (p, ch) {
          return [{ type: "CC", controller: p.fs, value: 127, channel: ch, note: "Effekt-Slot von FS " + (p.fs - 78) + " umschalten" }];
        }
      },
      {
        id: "slot-toggle",
        label: "Effekt-Slot an/aus",
        params: [
          { id: "slot", label: "Slot", type: "select", options: SLOTS, default: 48 },
          {
            id: "state", label: "Zustand", type: "select", default: 127,
            options: [{ value: 127, label: "An" }, { value: 0, label: "Aus" }]
          }
        ],
        build: function (p, ch) {
          return [{
            type: "CC", controller: p.slot, value: p.state, channel: ch,
            note: optionLabel(SLOTS, p.slot) + (p.state ? " einschalten" : " ausschalten")
          }];
        }
      }
    ]
  });
})();
