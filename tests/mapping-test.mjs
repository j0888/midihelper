/*
 * Prüft die Umrechnungslogik der Geräte-Mappings gegen die in den
 * Hersteller-PDFs dokumentierten Eckfälle. Ausführen mit:
 *   node tests/mapping-test.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Browser-Skripte in Node laden: window-Shim + indirekte eval im Global-Scope.
globalThis.window = globalThis;
for (const file of [
  "js/registry.js",
  "js/format.js",
  "devices/kemper-profiler-stage.js",
  "devices/ampero-ii-stomp.js",
  "devices/tonex-pedal.js"
]) {
  (0, eval)(readFileSync(join(root, file), "utf8"));
}

const { devices, format } = globalThis.MidiHelper;
const device = (id) => devices.find((d) => d.id === id);
const fn = (deviceId, fnId) => device(deviceId).functions.find((f) => f.id === fnId);
const stagetraxx = (deviceId, fnId, params, ch = 1) =>
  format.toStageTraxx(fn(deviceId, fnId).build(params, ch));

let count = 0;
function check(actual, expected, label) {
  assert.equal(actual, expected, label);
  count++;
  console.log("ok  " + label);
}

// --- Kemper Profiler Stage: Performance-Modus (CC47 + CC50-54) ---
check(
  stagetraxx("kemper-profiler-stage", "patch-performance", { performance: 1, slot: 1 }),
  "[midi: CC47.0@1, CC50.1@1, CC50.0@1]",
  "Kemper Performance 1 / Slot 1"
);
check(
  stagetraxx("kemper-profiler-stage", "patch-performance", { performance: 125, slot: 5 }),
  "[midi: CC47.124@1, CC54.1@1, CC54.0@1]",
  "Kemper Performance 125 / Slot 5"
);
check(
  stagetraxx("kemper-profiler-stage", "patch-performance", { performance: 42, slot: 3 }, 2),
  "[midi: CC47.41@2, CC52.1@2, CC52.0@2]",
  "Kemper Performance 42 / Slot 3 auf Kanal 2"
);

// --- Kemper: Browser-Modus (PC, optional Bank via CC32-Kurzform) ---
check(
  stagetraxx("kemper-profiler-stage", "patch-browser", { program: 12, bank: -1 }),
  "[midi: PC12@1]",
  "Kemper Browser PC 12 ohne Bank"
);
check(
  stagetraxx("kemper-profiler-stage", "patch-browser", { program: 5, bank: 3 }),
  "[midi: PC5.3@1]",
  "Kemper Browser PC 5 mit Bank 3 (CC32-Kurzform)"
);

// --- Ampero II Stomp: Patch-Tabelle aus dem PDF ---
// P00-1..P42-2 -> CC0=0, P42-3..P85-1 -> CC0=1, P85-2..P99-3 -> CC0=2
check(
  stagetraxx("ampero-ii-stomp", "patch-bank", { bank: 0, patch: 1 }),
  "[midi: CC0.0@1, PC0@1]",
  "Ampero P00-1 (erster Patch)"
);
check(
  stagetraxx("ampero-ii-stomp", "patch-bank", { bank: 42, patch: 2 }),
  "[midi: CC0.0@1, PC127@1]",
  "Ampero P42-2 (letzter Patch in Bank-MSB 0)"
);
check(
  stagetraxx("ampero-ii-stomp", "patch-bank", { bank: 42, patch: 3 }),
  "[midi: CC0.1@1, PC0@1]",
  "Ampero P42-3 (erster Patch in Bank-MSB 1)"
);
check(
  stagetraxx("ampero-ii-stomp", "patch-bank", { bank: 85, patch: 1 }),
  "[midi: CC0.1@1, PC127@1]",
  "Ampero P85-1 (letzter Patch in Bank-MSB 1)"
);
check(
  stagetraxx("ampero-ii-stomp", "patch-bank", { bank: 85, patch: 2 }),
  "[midi: CC0.2@1, PC0@1]",
  "Ampero P85-2 (erster Patch in Bank-MSB 2)"
);
check(
  stagetraxx("ampero-ii-stomp", "patch-bank", { bank: 99, patch: 3 }),
  "[midi: CC0.2@1, PC43@1]",
  "Ampero P99-3 (letzter Patch)"
);

// Direkte Patch-Nummer muss dieselbe Rechnung ergeben: Nr. 129 = P42-3
check(
  stagetraxx("ampero-ii-stomp", "patch-direct", { number: 129 }),
  "[midi: CC0.1@1, PC0@1]",
  "Ampero Patch-Nummer 129 = P42-3"
);
check(
  stagetraxx("ampero-ii-stomp", "patch-direct", { number: 300 }),
  "[midi: CC0.2@1, PC43@1]",
  "Ampero Patch-Nummer 300 = P99-3"
);

// --- Ampero: Tempo-Split CC74 (MSB) / CC75 (LSB) laut PDF ---
check(
  stagetraxx("ampero-ii-stomp", "tempo", { bpm: 40 }),
  "[midi: CC74.0@1, CC75.40@1]",
  "Ampero Tempo 40 BPM"
);
check(
  stagetraxx("ampero-ii-stomp", "tempo", { bpm: 128 }),
  "[midi: CC74.1@1, CC75.0@1]",
  "Ampero Tempo 128 BPM"
);
check(
  stagetraxx("ampero-ii-stomp", "tempo", { bpm: 300 }),
  "[midi: CC74.2@1, CC75.44@1]",
  "Ampero Tempo 300 BPM"
);

// --- ToneX Pedal: Preset-Auswahl (CC0 Bank 0-1 + PC, 50 Bänke à A/B/C) ---
check(
  stagetraxx("tonex-pedal", "preset-bank", { bank: 1, slot: 0 }),
  "[midi: CC0.0@1, PC0@1]",
  "ToneX 01A (erstes Preset)"
);
check(
  stagetraxx("tonex-pedal", "preset-bank", { bank: 43, slot: 1 }),
  "[midi: CC0.0@1, PC127@1]",
  "ToneX 43B (letztes Preset in Bank-MSB 0)"
);
check(
  stagetraxx("tonex-pedal", "preset-bank", { bank: 43, slot: 2 }),
  "[midi: CC0.1@1, PC0@1]",
  "ToneX 43C (erstes Preset in Bank-MSB 1)"
);
check(
  stagetraxx("tonex-pedal", "preset-bank", { bank: 50, slot: 2 }),
  "[midi: CC0.1@1, PC21@1]",
  "ToneX 50C (letztes Preset)"
);
check(
  stagetraxx("tonex-pedal", "preset-direct", { number: 128 }),
  "[midi: CC0.0@1, PC127@1]",
  "ToneX Preset-Nummer 128 = 43B"
);
check(
  stagetraxx("tonex-pedal", "preset-direct", { number: 150 }),
  "[midi: CC0.1@1, PC21@1]",
  "ToneX Preset-Nummer 150 = 50C"
);
// Bank+Slot und fortlaufende Nummer müssen dieselben Nachrichten liefern
for (const n of [1, 64, 128, 129, 150]) {
  const viaDirect = stagetraxx("tonex-pedal", "preset-direct", { number: n });
  const viaBank = stagetraxx("tonex-pedal", "preset-bank", {
    bank: Math.floor((n - 1) / 3) + 1,
    slot: (n - 1) % 3
  });
  assert.equal(viaBank, viaDirect, "ToneX Konsistenz Preset " + n);
  count++;
}
console.log("ok  ToneX: Bank+Slot und Preset-Nummer sind konsistent");

// --- StageTraxx-Trigger-Varianten (Sendezeitpunkt) ---
const triggerMessages = fn("kemper-profiler-stage", "patch-browser").build({ program: 7, bank: -1 }, 1);
check(format.toStageTraxx(triggerMessages), "[midi: PC7@1]", "Trigger-Default = Laden");
check(format.toStageTraxx(triggerMessages, "load"), "[midi: PC7@1]", "Trigger load");
check(format.toStageTraxx(triggerMessages, "play"), "[midi@play: PC7@1]", "Trigger play");
check(format.toStageTraxx(triggerMessages, "stop"), "[midi@stop: PC7@1]", "Trigger stop");

// --- Klartext-Renderer ---
const lines = format.toTextLines(
  fn("kemper-profiler-stage", "patch-performance").build({ performance: 5, slot: 1 }, 1)
);
check(lines[0], "CC#47, Wert 4, Kanal 1 — Performance 5 vorwählen", "Klartext CC-Zeile");
check(
  format.toTextLines(fn("ampero-ii-stomp", "patch-bank").build({ bank: 0, patch: 2 }, 1))[1],
  "Program Change 1, Kanal 1 — Patch P00-2 laden",
  "Klartext PC-Zeile"
);

// Jede Funktion beider Geräte muss mit Default-Parametern gültige Nachrichten liefern.
for (const d of devices) {
  for (const f of d.functions) {
    const params = {};
    for (const p of f.params) params[p.id] = p.default;
    const messages = f.build(params, 1);
    assert.ok(messages.length > 0, d.id + "/" + f.id + " liefert Nachrichten");
    for (const m of messages) {
      if (m.type === "CC") {
        assert.ok(m.controller >= 0 && m.controller <= 127, d.id + "/" + f.id + " CC-Nummer im Bereich");
        assert.ok(m.value >= 0 && m.value <= 127, d.id + "/" + f.id + " CC-Wert im Bereich");
      } else {
        assert.equal(m.type, "PC");
        assert.ok(m.program >= 0 && m.program <= 127, d.id + "/" + f.id + " PC-Nummer im Bereich");
      }
    }
    count++;
  }
  console.log("ok  " + d.name + ": alle Funktionen liefern gültige Defaults");
}

console.log("\n" + count + " Prüfungen bestanden.");
