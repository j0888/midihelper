/*
 * IK Multimedia ToneX Pedal
 * Quelle: TONEX Pedal User Manual (MIDI-Kapitel), per Websuche aus
 * Handbuch-Spiegeln und der MIDI-CC-Referenz voes.be/midi-cc
 * zusammengetragen (das Original-PDF war nicht direkt abrufbar).
 *
 * Presets heißen 01A bis 50C (Bank 1–50, Slot A/B/C). Der globale Index
 * i = (Bank−1)·3 + Slot(0–2) liegt bei 0–149 und wird als Bank-Select
 * (CC#0, i div 128, Wert 0–1) plus Program Change (i mod 128) gesendet.
 */
(function () {
  "use strict";

  var SLOT_LETTERS = ["A", "B", "C"];

  function presetName(index) {
    var bank = Math.floor(index / 3) + 1;
    return (bank < 10 ? "0" + bank : bank) + SLOT_LETTERS[index % 3];
  }

  function presetMessages(index, ch) {
    var msb = Math.floor(index / 128);
    var pc = index % 128;
    return [
      { type: "CC", controller: 0, value: msb, channel: ch, note: "Preset-Bank " + msb + " wählen" },
      { type: "PC", program: pc, channel: ch, note: "Preset " + presetName(index) + " laden" }
    ];
  }

  var CONTROLS = [
    { value: 102, label: "Gain" },
    { value: 103, label: "Model Volume" },
    { value: 104, label: "Model Mix" },
    { value: 23, label: "Bass" },
    { value: 25, label: "Mid" },
    { value: 28, label: "Treble" },
    { value: 106, label: "Presence" },
    { value: 107, label: "Depth" },
    { value: 15, label: "Gate Threshold" },
    { value: 19, label: "Comp Threshold" }
  ];

  var REVERB_TYPES = [
    { value: 0, label: "Spring 1" },
    { value: 1, label: "Spring 2" },
    { value: 2, label: "Spring 3" },
    { value: 3, label: "Spring 4" },
    { value: 4, label: "Room" },
    { value: 5, label: "Plate" }
  ];

  function optionLabel(options, value) {
    for (var i = 0; i < options.length; i++) {
      if (options[i].value === value) return options[i].label;
    }
    return String(value);
  }

  window.MidiHelper.registerDevice({
    id: "tonex-pedal",
    name: "ToneX Pedal",
    defaultChannel: 1,
    // Stilisiertes Kompaktpedal: Reglerreihe oben, kleines Display, drei Fußschalter
    icon: '<svg viewBox="0 0 60 32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<rect x="10" y="2" width="40" height="28" rx="3"/>' +
      '<circle cx="17" cy="7.5" r="1.3" fill="currentColor" stroke="none"/>' +
      '<circle cx="23.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/>' +
      '<circle cx="30" cy="7.5" r="1.3" fill="currentColor" stroke="none"/>' +
      '<circle cx="36.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/>' +
      '<circle cx="43" cy="7.5" r="1.3" fill="currentColor" stroke="none"/>' +
      '<rect x="22" y="11" width="16" height="6" rx="1"/>' +
      '<circle cx="18" cy="24" r="2.5"/><circle cx="30" cy="24" r="2.5"/><circle cx="42" cy="24" r="2.5"/>' +
      '</svg>',
    functions: [
      {
        id: "preset-bank",
        label: "Bank + Slot",
        primary: true,
        params: [
          { id: "bank", label: "Bank (1–50)", type: "number", min: 1, max: 50, default: 1 },
          {
            id: "slot", label: "Slot", type: "select", default: 0,
            options: [
              { value: 0, label: "Slot A" },
              { value: 1, label: "Slot B" },
              { value: 2, label: "Slot C" }
            ]
          }
        ],
        build: function (p, ch) {
          return presetMessages((p.bank - 1) * 3 + p.slot, ch);
        }
      },
      {
        id: "preset-direct",
        label: "Preset-Nummer",
        primary: true,
        help: "Fortlaufende Nummer 1–150: Nr. 1 = 01A, Nr. 4 = 02A usw.",
        params: [
          { id: "number", label: "Preset-Nummer (1–150)", type: "number", min: 1, max: 150, default: 1 }
        ],
        build: function (p, ch) {
          return presetMessages(p.number - 1, ch);
        }
      },
      {
        id: "preset-bypass",
        label: "Preset an/aus (Bypass)",
        params: [
          {
            id: "state", label: "Zustand", type: "select", default: 127,
            options: [{ value: 127, label: "An" }, { value: 0, label: "Aus (Bypass)" }]
          }
        ],
        build: function (p, ch) {
          return [{ type: "CC", controller: 12, value: p.state, channel: ch, note: p.state ? "Preset aktivieren" : "Preset bypassen" }];
        }
      },
      {
        id: "preset-nav",
        label: "Preset/Bank +/−",
        params: [
          {
            id: "action", label: "Aktion", type: "select", default: 87,
            options: [
              { value: 87, label: "Preset +" },
              { value: 86, label: "Preset −" },
              { value: 90, label: "Bank +" },
              { value: 89, label: "Bank −" }
            ]
          }
        ],
        build: function (p, ch) {
          var labels = { 87: "nächstes Preset", 86: "vorheriges Preset", 90: "nächste Bank", 89: "vorherige Bank" };
          return [{ type: "CC", controller: p.action, value: 127, channel: ch, note: labels[p.action] }];
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
          return [{ type: "CC", controller: 9, value: p.state, channel: ch, note: p.state ? "Tuner einschalten" : "Tuner ausschalten" }];
        }
      },
      {
        id: "tap",
        label: "Tap Tempo",
        params: [],
        build: function (p, ch) {
          return [{ type: "CC", controller: 10, value: 127, channel: ch, note: "Tap Tempo auslösen" }];
        }
      },
      {
        id: "bpm",
        label: "Tempo (Rohwert)",
        help: "CC#88 nimmt 0–127 entgegen; das Pedal bildet den Wert intern auf seinen BPM-Bereich ab.",
        params: [
          { id: "value", label: "Wert (0–127)", type: "number", min: 0, max: 127, default: 64 }
        ],
        build: function (p, ch) {
          return [{ type: "CC", controller: 88, value: p.value, channel: ch, note: "BPM-Rohwert " + p.value }];
        }
      },
      {
        id: "expression",
        label: "Expression-Pedal",
        params: [
          { id: "value", label: "Wert (0–127)", type: "number", min: 0, max: 127, default: 64 }
        ],
        build: function (p, ch) {
          return [{ type: "CC", controller: 11, value: p.value, channel: ch, note: "Expression-Pedal auf " + p.value }];
        }
      },
      {
        id: "controls",
        label: "Regler setzen",
        params: [
          { id: "target", label: "Regler", type: "select", options: CONTROLS, default: 102 },
          { id: "value", label: "Wert", type: "number", min: 0, max: 127, default: 64 }
        ],
        build: function (p, ch) {
          return [{
            type: "CC", controller: p.target, value: p.value, channel: ch,
            note: optionLabel(CONTROLS, p.target) + " auf " + p.value + " setzen"
          }];
        }
      },
      {
        id: "reverb",
        label: "Reverb an/aus",
        params: [
          {
            id: "state", label: "Zustand", type: "select", default: 127,
            options: [{ value: 127, label: "An" }, { value: 0, label: "Aus" }]
          }
        ],
        build: function (p, ch) {
          return [{ type: "CC", controller: 75, value: p.state, channel: ch, note: p.state ? "Reverb einschalten" : "Reverb ausschalten" }];
        }
      },
      {
        id: "reverb-type",
        label: "Reverb-Typ",
        params: [
          { id: "reverbType", label: "Typ", type: "select", options: REVERB_TYPES, default: 0 }
        ],
        build: function (p, ch) {
          return [{
            type: "CC", controller: 85, value: p.reverbType, channel: ch,
            note: "Reverb-Typ " + optionLabel(REVERB_TYPES, p.reverbType)
          }];
        }
      }
    ]
  });
})();
