/*
 * UI-Logik: rendert Geräte- und Modus-Umschalter, baut die Eingabefelder
 * dynamisch aus den Mapping-Definitionen (devices/*.js) und zeigt die
 * berechneten Befehle live als Klartext + StageTraxx-Zeile an.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "midihelper.v1";
  var devices = window.MidiHelper.devices;
  var format = window.MidiHelper.format;

  var el = {
    deviceTabs: document.getElementById("device-tabs"),
    variantTabs: document.getElementById("variant-tabs"),
    channel: document.getElementById("channel-input"),
    patchHelp: document.getElementById("patch-help"),
    patchParams: document.getElementById("patch-params"),
    patchOutput: document.getElementById("patch-output"),
    extraSelect: document.getElementById("extra-select"),
    extraHelp: document.getElementById("extra-help"),
    extraParams: document.getElementById("extra-params"),
    extraOutput: document.getElementById("extra-output")
  };

  // ---- Zustand (pro Gerät gemerkt, in localStorage persistiert) ----

  var state = loadState();

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* localStorage nicht verfügbar oder korrupt */ }
    return { deviceId: null, perDevice: {} };
  }

  // Sendezeitpunkt der StageTraxx-Zeile (load/play/stop), global für alle Ausgaben
  if (!state.trigger) state.trigger = "load";

  var TRIGGERS = [
    { id: "load", label: "Laden", title: "Wird gesendet, wenn der Song geladen wird" },
    { id: "play", label: "Play", title: "Wird gesendet, wenn die Wiedergabe startet" },
    { id: "stop", label: "Stop", title: "Wird gesendet, wenn die Wiedergabe stoppt" }
  ];

  // Aktive Ausgabe-Renderer, damit ein Trigger-Wechsel beide Karten aktualisiert
  var updaters = { patch: null, extra: null };

  function refreshOutputs() {
    if (updaters.patch) updaters.patch();
    if (updaters.extra) updaters.extra();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* Speichern ist optional */ }
  }

  function deviceState(device) {
    var s = state.perDevice[device.id];
    if (!s) {
      s = { channel: device.defaultChannel || 1, variantId: null, extraId: null, params: {} };
      state.perDevice[device.id] = s;
    }
    return s;
  }

  function paramValues(device, fn) {
    var s = deviceState(device);
    if (!s.params[fn.id]) {
      var defaults = {};
      fn.params.forEach(function (p) { defaults[p.id] = p.default; });
      s.params[fn.id] = defaults;
    }
    return s.params[fn.id];
  }

  // ---- Hilfsfunktionen ----

  function currentDevice() {
    for (var i = 0; i < devices.length; i++) {
      if (devices[i].id === state.deviceId) return devices[i];
    }
    return devices[0];
  }

  function findFn(device, id, primary) {
    var list = device.functions.filter(function (f) { return !!f.primary === primary; });
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return list[0] || null;
  }

  function clampInfo(paramDef, rawValue) {
    var n = Number(rawValue);
    var valid = rawValue !== "" && isFinite(n) &&
      (paramDef.min == null || n >= paramDef.min) &&
      (paramDef.max == null || n <= paramDef.max);
    return { value: n, valid: valid };
  }

  // ---- Rendering ----

  function renderDeviceTabs() {
    el.deviceTabs.innerHTML = "";
    devices.forEach(function (device) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "device-btn";
      if (device.icon) {
        var icon = document.createElement("span");
        icon.className = "device-icon";
        icon.innerHTML = device.icon; // eigene Mapping-Dateien, kein Fremdinhalt
        btn.appendChild(icon);
      }
      var name = document.createElement("span");
      name.textContent = device.name;
      btn.appendChild(name);
      btn.setAttribute("aria-pressed", String(device === currentDevice()));
      btn.addEventListener("click", function () {
        state.deviceId = device.id;
        saveState();
        renderAll();
      });
      el.deviceTabs.appendChild(btn);
    });
  }

  function renderVariantTabs(device) {
    var s = deviceState(device);
    var variants = device.functions.filter(function (f) { return f.primary; });
    el.variantTabs.innerHTML = "";
    el.variantTabs.hidden = variants.length < 2;
    variants.forEach(function (fn) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = fn.label;
      btn.setAttribute("aria-pressed", String(fn === findFn(device, s.variantId, true)));
      btn.addEventListener("click", function () {
        s.variantId = fn.id;
        saveState();
        renderPatchSection(device);
      });
      el.variantTabs.appendChild(btn);
    });
  }

  function renderExtraSelect(device) {
    var s = deviceState(device);
    var extras = device.functions.filter(function (f) { return !f.primary; });
    el.extraSelect.innerHTML = "";
    extras.forEach(function (fn) {
      var opt = document.createElement("option");
      opt.value = fn.id;
      opt.textContent = fn.label;
      el.extraSelect.appendChild(opt);
    });
    var active = findFn(device, s.extraId, false);
    if (active) el.extraSelect.value = active.id;
    el.extraSelect.onchange = function () {
      s.extraId = el.extraSelect.value;
      saveState();
      renderExtraSection(device);
    };
  }

  function renderParams(container, device, fn, onChange) {
    var values = paramValues(device, fn);
    container.innerHTML = "";
    fn.params.forEach(function (paramDef) {
      var field = document.createElement("div");
      field.className = "field";

      var label = document.createElement("label");
      var inputId = fn.id + "-" + paramDef.id;
      label.htmlFor = inputId;
      label.textContent = paramDef.label;
      field.appendChild(label);

      var input;
      if (paramDef.type === "select") {
        input = document.createElement("select");
        paramDef.options.forEach(function (option) {
          var opt = document.createElement("option");
          opt.value = String(option.value);
          opt.textContent = option.label;
          input.appendChild(opt);
        });
        input.value = String(values[paramDef.id]);
        input.addEventListener("change", function () {
          values[paramDef.id] = Number(input.value);
          saveState();
          onChange();
        });
      } else {
        input = document.createElement("input");
        input.type = "number";
        if (paramDef.min != null) input.min = paramDef.min;
        if (paramDef.max != null) input.max = paramDef.max;
        input.value = values[paramDef.id];
        input.addEventListener("input", function () {
          var info = clampInfo(paramDef, input.value);
          input.classList.toggle("invalid", !info.valid);
          if (info.valid) {
            values[paramDef.id] = info.value;
            saveState();
          }
          onChange();
        });
      }
      input.id = inputId;
      field.appendChild(input);
      container.appendChild(field);
    });
  }

  function paramsValid(container) {
    return !container.querySelector("input.invalid");
  }

  function renderOutput(container, device, fn, valid) {
    container.innerHTML = "";
    if (!fn) return;

    if (!valid) {
      var err = document.createElement("p");
      err.className = "error";
      err.textContent = "Bitte gültige Werte eingeben (Bereich beachten).";
      container.appendChild(err);
      return;
    }

    var channel = deviceState(device).channel;
    var messages = fn.build(paramValues(device, fn), channel);

    var list = document.createElement("ul");
    list.className = "text-lines";
    format.toTextLines(messages).forEach(function (line) {
      var li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    });
    container.appendChild(list);

    var triggerRow = document.createElement("div");
    triggerRow.className = "trigger-row";
    var triggerLabel = document.createElement("span");
    triggerLabel.className = "trigger-label";
    triggerLabel.textContent = "Senden bei:";
    triggerRow.appendChild(triggerLabel);
    var triggerTabs = document.createElement("div");
    triggerTabs.className = "segmented segmented-small";
    TRIGGERS.forEach(function (trigger) {
      var tbtn = document.createElement("button");
      tbtn.type = "button";
      tbtn.textContent = trigger.label;
      tbtn.title = trigger.title;
      tbtn.setAttribute("aria-pressed", String(state.trigger === trigger.id));
      tbtn.addEventListener("click", function () {
        state.trigger = trigger.id;
        saveState();
        refreshOutputs();
      });
      triggerTabs.appendChild(tbtn);
    });
    triggerRow.appendChild(triggerTabs);
    container.appendChild(triggerRow);

    var stagetraxx = format.toStageTraxx(messages, state.trigger);
    var row = document.createElement("div");
    row.className = "stagetraxx-row";

    var code = document.createElement("code");
    code.textContent = stagetraxx;
    row.appendChild(code);

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "Kopieren";
    copyBtn.addEventListener("click", function () {
      copyText(stagetraxx, copyBtn);
    });
    row.appendChild(copyBtn);
    container.appendChild(row);
  }

  function copyText(text, btn) {
    function done(ok) {
      btn.textContent = ok ? "Kopiert ✓" : "Fehler";
      btn.classList.add("copied");
      setTimeout(function () {
        btn.textContent = "Kopieren";
        btn.classList.remove("copied");
      }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
    } else {
      done(fallbackCopy(text));
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { /* nicht unterstützt */ }
    document.body.removeChild(ta);
    return ok;
  }

  function renderHelp(helpEl, fn) {
    helpEl.hidden = !(fn && fn.help);
    helpEl.textContent = (fn && fn.help) || "";
  }

  function renderPatchSection(device) {
    var fn = findFn(device, deviceState(device).variantId, true);
    renderVariantTabs(device);
    renderHelp(el.patchHelp, fn);
    if (!fn) {
      el.patchParams.innerHTML = "";
      el.patchOutput.innerHTML = "";
      updaters.patch = null;
      return;
    }
    var update = function () {
      renderOutput(el.patchOutput, device, fn, paramsValid(el.patchParams));
    };
    updaters.patch = update;
    renderParams(el.patchParams, device, fn, update);
    update();
  }

  function renderExtraSection(device) {
    var fn = findFn(device, deviceState(device).extraId, false);
    renderHelp(el.extraHelp, fn);
    if (!fn) {
      el.extraParams.innerHTML = "";
      el.extraOutput.innerHTML = "";
      updaters.extra = null;
      return;
    }
    var update = function () {
      renderOutput(el.extraOutput, device, fn, paramsValid(el.extraParams));
    };
    updaters.extra = update;
    renderParams(el.extraParams, device, fn, update);
    update();
  }

  function renderAll() {
    var device = currentDevice();
    state.deviceId = device.id;
    renderDeviceTabs();
    el.channel.value = deviceState(device).channel;
    el.channel.classList.remove("invalid");
    renderPatchSection(device);
    renderExtraSelect(device);
    renderExtraSection(device);
  }

  el.channel.addEventListener("input", function () {
    var device = currentDevice();
    var info = clampInfo({ min: 1, max: 16 }, el.channel.value);
    el.channel.classList.toggle("invalid", !info.valid);
    if (info.valid) {
      deviceState(device).channel = info.value;
      saveState();
    }
    renderPatchSection(device);
    renderExtraSection(device);
  });

  if (!devices.length) {
    document.querySelector(".app").textContent = "Keine Geräte registriert — devices/*.js prüfen.";
    return;
  }
  renderAll();
})();
