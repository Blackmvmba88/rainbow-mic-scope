const VERSION = "1.5.0-webui";
const PRESET_STORAGE_KEY = "rainbowMicScope.presets";

const THEMES = {
  rainbow: { bg: "#05060a", hue: 0, sat: 100, light: 55 },
  plasma: { bg: "#03010a", hue: 285, sat: 100, light: 60 },
  aurora: { bg: "#02070a", hue: 165, sat: 95, light: 58 },
  ghost: { bg: "#00040a", hue: 195, sat: 100, light: 72 },
  mono: { bg: "#020202", hue: 0, sat: 0, light: 86 },
};

const canvas = document.getElementById("scope");
const ctx = canvas.getContext("2d", { alpha: false });
const hud = document.getElementById("hud");

const state = {
  mode: "line",
  theme: "rainbow",
  targetRms: 0.12,
  gain: 1,
  integral: 0,
  previousError: 0,
  rms: 0,
  fps: 30,
  measuredFps: 0,
  renderPoints: 720,
  trailDepth: 18,
  trailFadeMs: 2600,
  trailExpand: 0.28,
  lineScale: 1,
  twin: true,
  trail: true,
  hud: true,
  clean: false,
  recording: false,
  recordStartedAt: 0,
  hueShift: 0,
};

let audioContext;
let analyser;
let timeData;
let running = false;
let lastFrame = 0;
let fpsLast = performance.now();
let fpsFrames = 0;
let trailHistory = [];
let mediaRecorder;
let recordedChunks = [];

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function fileStem(extension) {
  return `rainbow-mic-scope-${state.mode}-${state.theme}-${timestamp()}.${extension}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function snapshotPreset(name = "Untitled Preset") {
  return {
    schema: 1,
    name,
    mode: state.mode,
    theme: state.theme,
    targetRms: state.targetRms,
    fps: state.fps,
    renderPoints: state.renderPoints,
    trailDepth: state.trailDepth,
    trailFadeMs: state.trailFadeMs,
    trailExpand: state.trailExpand,
    lineScale: state.lineScale,
    twin: state.twin,
    trail: state.trail,
    hud: state.hud,
  };
}

function getBuiltInPresets() {
  return [
    {
      schema: 1,
      name: "Portal Rainbow",
      mode: "portal",
      theme: "rainbow",
      targetRms: 0.12,
      fps: 30,
      renderPoints: 720,
      trailDepth: 18,
      trailFadeMs: 2600,
      trailExpand: 0.28,
      lineScale: 1,
      twin: true,
      trail: true,
      hud: true,
    },
    {
      schema: 1,
      name: "Aurora Clean",
      mode: "portal",
      theme: "aurora",
      targetRms: 0.1,
      fps: 30,
      renderPoints: 960,
      trailDepth: 22,
      trailFadeMs: 3400,
      trailExpand: 0.36,
      lineScale: 1.15,
      twin: true,
      trail: true,
      hud: false,
    },
    {
      schema: 1,
      name: "Line Scope",
      mode: "line",
      theme: "ghost",
      targetRms: 0.12,
      fps: 30,
      renderPoints: 720,
      trailDepth: 10,
      trailFadeMs: 1700,
      trailExpand: 0.08,
      lineScale: 0.85,
      twin: true,
      trail: true,
      hud: true,
    },
  ];
}

function getSavedPresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setSavedPresets(presets) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

function applyPreset(preset) {
  if (!preset || preset.schema !== 1) return;

  const keys = [
    "mode",
    "theme",
    "targetRms",
    "fps",
    "renderPoints",
    "trailDepth",
    "trailFadeMs",
    "trailExpand",
    "lineScale",
    "twin",
    "trail",
    "hud",
  ];
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(preset, key)) state[key] = preset[key];
  });
  trailHistory = [];
  syncControls();
}

function refreshPresetSelect() {
  const select = document.getElementById("presetSelect");
  const presets = [...getBuiltInPresets(), ...getSavedPresets()];
  select.innerHTML = '<option value="">Preset</option>';
  presets.forEach((preset, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = preset.name;
    select.appendChild(option);
  });
}

function syncControls() {
  document.querySelectorAll(".mode").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
  document.getElementById("theme").value = state.theme;
  document.getElementById("targetRms").value = state.targetRms;
  document.getElementById("renderPoints").value = state.renderPoints;
  document.getElementById("fps").value = state.fps;
  document.getElementById("trailDepth").value = state.trailDepth;
  document.getElementById("trailFade").value = state.trailFadeMs;
  document.getElementById("trailExpand").value = state.trailExpand;
  document.getElementById("lineScale").value = state.lineScale;
  document.getElementById("twinBtn").classList.toggle("active", state.twin);
  document.getElementById("trailBtn").classList.toggle("active", state.trail);
  document.getElementById("hudBtn").classList.toggle("active", state.hud);
  hud.classList.toggle("hidden", !state.hud);
  document.body.classList.toggle("clean", state.clean);
  document.body.style.background = THEMES[state.theme].bg;
}

function updatePid(measured, dt) {
  const kp = 10.0;
  const ki = 1.6;
  const kd = 1.8;
  const error = state.targetRms - measured;
  state.integral = clamp(state.integral + error * dt, -0.6, 0.6);
  const derivative = dt > 0 ? (error - state.previousError) / dt : 0;
  state.previousError = error;
  const targetGain = clamp(1 + kp * error + ki * state.integral + kd * derivative, 0.18, 32);
  state.gain = state.gain * 0.88 + targetGain * 0.12;
}

function readAudio() {
  const points = state.renderPoints;
  const signal = new Float32Array(points);

  if (!analyser) return signal;

  analyser.getFloatTimeDomainData(timeData);
  let mean = 0;
  for (let i = 0; i < timeData.length; i += 1) mean += timeData[i];
  mean /= timeData.length;

  let rms = 0;
  for (let i = 0; i < timeData.length; i += 1) {
    const centered = timeData[i] - mean;
    rms += centered * centered;
  }
  rms = Math.sqrt(rms / timeData.length);
  state.rms = state.rms * 0.78 + rms * 0.22;
  updatePid(state.rms, 1 / Math.max(1, state.fps));

  for (let i = 0; i < points; i += 1) {
    const index = Math.floor((i / Math.max(1, points - 1)) * (timeData.length - 1));
    signal[i] = clamp((timeData[index] - mean) * state.gain, -1, 1);
  }

  return signal;
}

function colorAt(index, count, alpha = 1) {
  const theme = THEMES[state.theme];
  const hue = state.theme === "mono" ? 0 : (theme.hue + state.hueShift + (index / count) * 360) % 360;
  return `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${alpha})`;
}

function geometry(signal, offset = 0, strength = 1) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w / 2;
  const cy = h / 2;
  const size = Math.min(w, h);
  const points = signal.length;
  const coords = [];

  if (state.mode === "portal") {
    for (let i = 0; i < points - 1; i += 1) {
      const value = signal[(i + offset) % points] * strength;
      const angle = (i / (points - 1)) * Math.PI * 2 - Math.PI / 2;
      const inner = size * (0.135 + Math.min(value, 0) * 0.035);
      const outer = size * (0.285 + Math.max(value, 0) * 0.19 + Math.abs(value) * 0.08);
      coords.push({
        x1: cx + Math.cos(angle) * inner,
        y1: cy + Math.sin(angle) * inner,
        x2: cx + Math.cos(angle) * outer,
        y2: cy + Math.sin(angle) * outer,
      });
    }
    return coords;
  }

  const path = [];
  for (let i = 0; i < points; i += 1) {
    const value = signal[(i + offset) % points] * strength;
    if (state.mode === "circle") {
      const angle = (i / (points - 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = size * (0.25 + value * 0.105);
      path.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    } else {
      const x = w * 0.09 + (i / (points - 1)) * w * 0.82;
      const y = cy + value * size * 0.28;
      path.push({ x, y });
    }
  }

  for (let i = 0; i < path.length - 1; i += 1) {
    coords.push({ x1: path[i].x, y1: path[i].y, x2: path[i + 1].x, y2: path[i + 1].y });
  }
  return coords;
}

function drawSegments(segments, alpha, width, expand = 1) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const x1 = cx + (seg.x1 - cx) * expand;
    const y1 = cy + (seg.y1 - cy) * expand;
    const x2 = cx + (seg.x2 - cx) * expand;
    const y2 = cy + (seg.y2 - cy) * expand;
    ctx.strokeStyle = colorAt(i, segments.length, alpha);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function draw(now) {
  requestAnimationFrame(draw);
  if (!running) return;

  const interval = 1000 / state.fps;
  if (now - lastFrame < interval) return;
  const dt = (now - lastFrame) / 1000 || 1 / state.fps;
  lastFrame = now;

  const theme = THEMES[state.theme];
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const signal = readAudio();
  const loudness = clamp(state.rms * state.gain, 0, 1);
  const main = geometry(signal);
  const width = (1.15 + loudness * 2.4) * state.lineScale;
  state.hueShift = (state.hueShift + 28 * dt + loudness * 60 * dt) % 360;

  if (state.trail && state.trailDepth > 0 && fpsFrames % 3 === 0) {
    trailHistory.unshift({ born: now, segments: main, width });
    trailHistory = trailHistory.slice(0, state.trailDepth);
  }

  for (const item of trailHistory) {
    const age = clamp((now - item.born) / state.trailFadeMs, 0, 1);
    const alpha = 0.42 * Math.pow(1 - age, 2.4);
    const expand = 1 + state.trailExpand * Math.pow(age, 1.35);
    if (alpha > 0.004) drawSegments(item.segments, alpha, Math.max(0.2, item.width * (1 - age * 0.74)), expand);
  }
  trailHistory = trailHistory.filter((item) => now - item.born < state.trailFadeMs);

  if (state.twin) drawSegments(geometry(signal, Math.floor(signal.length * 0.035), 0.64), 0.42, width * 0.7, 0.985);
  drawSegments(main, 0.96, width);

  fpsFrames += 1;
  if (now - fpsLast > 500) {
    state.measuredFps = Math.round((fpsFrames * 1000) / (now - fpsLast));
    fpsLast = now;
    fpsFrames = 0;
  }

  document.getElementById("modeReadout").textContent = `MODE ${state.mode.toUpperCase()}`;
  document.getElementById("rmsReadout").textContent = `RMS ${state.rms.toFixed(4)}`;
  document.getElementById("gainReadout").textContent = `PID ${state.gain.toFixed(2)}x`;
  document.getElementById("recordReadout").textContent = state.recording
    ? `REC ${Math.floor((now - state.recordStartedAt) / 1000)}s`
    : "REC OFF";
  document.getElementById("fpsReadout").textContent = `FPS ${state.measuredFps}`;
}

function exportPng() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(blob, fileStem("png"));
  }, "image/png");
}

function getRecorderMimeType() {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function toggleRecording() {
  if (state.recording) {
    mediaRecorder?.stop();
    return;
  }

  if (!canvas.captureStream || !window.MediaRecorder) {
    alert("Recording is not supported in this browser.");
    return;
  }

  recordedChunks = [];
  const stream = canvas.captureStream(state.fps);
  const mimeType = getRecorderMimeType();
  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  });
  mediaRecorder.addEventListener("stop", () => {
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "video/webm" });
    downloadBlob(blob, fileStem("webm"));
    state.recording = false;
    document.getElementById("recordBtn").textContent = "REC";
    document.getElementById("recordBtn").classList.remove("active");
  });
  mediaRecorder.start(1000);
  state.recording = true;
  state.recordStartedAt = performance.now();
  document.getElementById("recordBtn").textContent = "Stop";
  document.getElementById("recordBtn").classList.add("active");
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
}

function toggleCleanMode() {
  state.clean = !state.clean;
  document.body.classList.toggle("clean", state.clean);
  document.getElementById("cleanBtn").classList.toggle("active", state.clean);
}

function savePreset() {
  const name = prompt("Preset name", `${state.mode} ${state.theme}`);
  if (!name) return;
  const presets = getSavedPresets();
  presets.push(snapshotPreset(name));
  setSavedPresets(presets);
  refreshPresetSelect();
}

async function startMic() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 8192;
  timeData = new Float32Array(analyser.fftSize);
  audioContext.createMediaStreamSource(stream).connect(analyser);
  running = true;
  document.getElementById("startBtn").textContent = "Mic Live";
  document.getElementById("startBtn").classList.add("active");
}

function bindControls() {
  document.getElementById("startBtn").addEventListener("click", () => {
    startMic().catch((error) => {
      document.getElementById("startBtn").textContent = "Mic Blocked";
      console.error(error);
    });
  });

  document.querySelectorAll(".mode").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      document.querySelectorAll(".mode").forEach((item) => item.classList.toggle("active", item === button));
      trailHistory = [];
    });
  });

  document.getElementById("theme").addEventListener("input", (event) => {
    state.theme = event.target.value;
    document.body.style.background = THEMES[state.theme].bg;
  });

  document.getElementById("exportPngBtn").addEventListener("click", exportPng);
  document.getElementById("recordBtn").addEventListener("click", toggleRecording);
  document.getElementById("fullscreenBtn").addEventListener("click", () => {
    toggleFullscreen().catch(console.error);
  });
  document.getElementById("cleanBtn").addEventListener("click", toggleCleanMode);
  document.getElementById("savePresetBtn").addEventListener("click", savePreset);
  document.getElementById("presetSelect").addEventListener("input", (event) => {
    if (!event.target.value) return;
    const presets = [...getBuiltInPresets(), ...getSavedPresets()];
    applyPreset(presets[Number(event.target.value)]);
    event.target.value = "";
  });

  const ranges = {
    targetRms: "targetRms",
    renderPoints: "renderPoints",
    fps: "fps",
    trailDepth: "trailDepth",
    trailFade: "trailFadeMs",
    trailExpand: "trailExpand",
    lineScale: "lineScale",
  };
  Object.entries(ranges).forEach(([id, key]) => {
    document.getElementById(id).addEventListener("input", (event) => {
      state[key] = Number(event.target.value);
      if (key === "renderPoints") trailHistory = [];
    });
  });

  [
    ["twinBtn", "twin"],
    ["trailBtn", "trail"],
    ["hudBtn", "hud"],
  ].forEach(([id, key]) => {
    document.getElementById(id).addEventListener("click", (event) => {
      state[key] = !state[key];
      event.currentTarget.classList.toggle("active", state[key]);
      if (key === "hud") hud.classList.toggle("hidden", !state.hud);
      if (key === "trail") trailHistory = [];
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === " ") {
      event.preventDefault();
      const modes = ["line", "circle", "portal"];
      state.mode = modes[(modes.indexOf(state.mode) + 1) % modes.length];
      document.querySelectorAll(".mode").forEach((button) => button.classList.toggle("active", button.dataset.mode === state.mode));
      trailHistory = [];
    }
    if (event.key === "h") document.getElementById("hudBtn").click();
    if (event.key === "Escape" && state.clean) toggleCleanMode();
  });
}

resize();
bindControls();
refreshPresetSelect();
syncControls();
requestAnimationFrame(draw);
window.addEventListener("resize", resize);
console.info(`Rainbow Mic Scope ${VERSION}`);
