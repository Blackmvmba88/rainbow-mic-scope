const VERSION = "1.5.0-webui";

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
  peakHz: 0,
  centroidHz: 0,
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
  hueShift: 0,
  colorSource: "frequency",
  selectedDeviceId: "",
};

let audioContext;
let analyser;
let timeData;
let frequencyData;
let activeStream;
let running = false;
let lastFrame = 0;
let fpsLast = performance.now();
let fpsFrames = 0;
let trailHistory = [];

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function analyzeFrequency() {
  if (!analyser || !frequencyData || !audioContext) return;

  analyser.getByteFrequencyData(frequencyData);

  const nyquist = audioContext.sampleRate / 2;
  const minHz = 55;
  const maxHz = Math.min(6000, nyquist);
  const minBin = Math.max(1, Math.floor((minHz / nyquist) * frequencyData.length));
  const maxBin = Math.min(frequencyData.length - 1, Math.ceil((maxHz / nyquist) * frequencyData.length));
  let peakBin = minBin;
  let peakValue = 0;
  let weighted = 0;
  let total = 0;

  for (let bin = minBin; bin <= maxBin; bin += 1) {
    const value = frequencyData[bin];
    const hz = (bin / frequencyData.length) * nyquist;
    if (value > peakValue) {
      peakValue = value;
      peakBin = bin;
    }
    weighted += hz * value;
    total += value;
  }

  const peakHz = (peakBin / frequencyData.length) * nyquist;
  const centroidHz = total > 0 ? weighted / total : 0;
  state.peakHz = state.peakHz * 0.78 + peakHz * 0.22;
  state.centroidHz = state.centroidHz * 0.82 + centroidHz * 0.18;
}

function hueFromFrequency() {
  const hz = Math.max(55, state.centroidHz || state.peakHz || 55);
  const minHz = 55;
  const maxHz = 4200;
  const normalized = clamp(Math.log2(hz / minHz) / Math.log2(maxHz / minHz), 0, 1);
  return (250 - normalized * 250 + state.hueShift * 0.25 + state.peakHz * 0.015 + 360) % 360;
}

function readAudio() {
  const points = state.renderPoints;
  const signal = new Float32Array(points);

  if (!analyser) return signal;

  analyser.getFloatTimeDomainData(timeData);
  analyzeFrequency();
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
  let hue = theme.hue + state.hueShift + (index / count) * 360;
  if (state.colorSource === "frequency") {
    hue = hueFromFrequency() + (index / count) * 92;
  }
  hue = state.theme === "mono" ? 0 : hue % 360;
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
  document.getElementById("freqReadout").textContent = `PEAK ${Math.round(state.peakHz)} Hz`;
  document.getElementById("fpsReadout").textContent = `FPS ${state.measuredFps}`;
}

async function startMic() {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
  }

  const audioConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  };
  if (state.selectedDeviceId) {
    audioConstraints.deviceId = { exact: state.selectedDeviceId };
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: audioConstraints,
  });
  activeStream = stream;
  audioContext = audioContext || new AudioContext();
  if (audioContext.state === "suspended") await audioContext.resume();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 8192;
  analyser.smoothingTimeConstant = 0.72;
  timeData = new Float32Array(analyser.fftSize);
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  audioContext.createMediaStreamSource(stream).connect(analyser);
  running = true;
  document.getElementById("startBtn").textContent = "Mic Live";
  document.getElementById("startBtn").classList.add("active");
  await refreshAudioInputs();
}

async function refreshAudioInputs() {
  if (!navigator.mediaDevices?.enumerateDevices) return;

  const select = document.getElementById("audioInput");
  const current = select.value || state.selectedDeviceId;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((device) => device.kind === "audioinput");

  select.innerHTML = '<option value="">Default microphone</option>';
  inputs.forEach((device, index) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || `Audio input ${index + 1}`;
    select.appendChild(option);
  });

  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
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

  document.getElementById("colorSource").addEventListener("input", (event) => {
    state.colorSource = event.target.value;
    trailHistory = [];
  });

  document.getElementById("audioInput").addEventListener("input", (event) => {
    state.selectedDeviceId = event.target.value;
    if (running) startMic().catch(console.error);
  });

  document.getElementById("refreshDevicesBtn").addEventListener("click", () => {
    refreshAudioInputs().catch(console.error);
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
  });
}

resize();
bindControls();
refreshAudioInputs().catch(console.error);
requestAnimationFrame(draw);
window.addEventListener("resize", resize);
console.info(`Rainbow Mic Scope ${VERSION}`);
