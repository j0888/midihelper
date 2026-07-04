/*
 * Wandelt abstrakte MIDI-Nachrichten (siehe registry.js) in die beiden
 * Ausgabeformate um:
 *   - toStageTraxx: [midi: ...]-Zeile nach https://stagetraxx.com/docs/v4/midi/
 *   - toTextLines:  deutsche Klartext-Erklärung, eine Zeile pro Nachricht
 */
(function () {
  "use strict";

  function messageToStageTraxx(msg) {
    if (msg.type === "PC") {
      if (msg.bankLsb != null) {
        return "PC" + msg.program + "." + msg.bankLsb + "@" + msg.channel;
      }
      return "PC" + msg.program + "@" + msg.channel;
    }
    return "CC" + msg.controller + "." + msg.value + "@" + msg.channel;
  }

  function toStageTraxx(messages) {
    return "[midi: " + messages.map(messageToStageTraxx).join(", ") + "]";
  }

  function messageToText(msg) {
    var text;
    if (msg.type === "PC") {
      text = "Program Change " + msg.program;
      if (msg.bankLsb != null) {
        text += " (vorher Bank " + msg.bankLsb + " via CC#32)";
      }
      text += ", Kanal " + msg.channel;
    } else {
      text = "CC#" + msg.controller + ", Wert " + msg.value + ", Kanal " + msg.channel;
    }
    if (msg.note) {
      text += " — " + msg.note;
    }
    return text;
  }

  function toTextLines(messages) {
    return messages.map(messageToText);
  }

  window.MidiHelper.format = {
    toStageTraxx: toStageTraxx,
    toTextLines: toTextLines
  };
})();
