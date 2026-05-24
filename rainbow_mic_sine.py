#!/usr/bin/env python3
"""Rainbow sine wave that reacts to the microphone in real time."""

from __future__ import annotations

import argparse
import queue
import sys
import time
from dataclasses import dataclass

import matplotlib.pyplot as plt
import numpy as np
import sounddevice as sd
from matplotlib.animation import FuncAnimation
from matplotlib.collections import LineCollection


VERSION = "1.4.0"

THEMES = {
    "rainbow": {"cmap": "hsv", "bg": "#05060a", "fg": "#f8fafc"},
    "plasma": {"cmap": "plasma", "bg": "#03010a", "fg": "#fff7ed"},
    "aurora": {"cmap": "turbo", "bg": "#02070a", "fg": "#ecfeff"},
    "ghost": {"cmap": "cool", "bg": "#00040a", "fg": "#e0f2fe"},
    "mono": {"cmap": "gray", "bg": "#020202", "fg": "#f5f5f5"},
}
THEME_NAMES = tuple(THEMES)


@dataclass
class AudioState:
    rms: float = 0.0
    peak_hz: float = 0.0
    hue_shift: float = 0.0
    auto_gain: float = 1.0
    mode: str = "line"


@dataclass
class UiState:
    theme: str = "rainbow"
    hud_visible: bool = True
    glow_level: int = 1
    line_scale: float = 1.0
    twin_visible: bool = True
    trail_visible: bool = True
    trail_depth: int = 18


@dataclass
class GainPid:
    target_rms: float = 0.12
    kp: float = 10.0
    ki: float = 1.6
    kd: float = 1.8
    min_gain: float = 0.18
    max_gain: float = 32.0
    integral: float = 0.0
    previous_error: float = 0.0

    def update(self, measured_rms: float, dt: float) -> float:
        error = self.target_rms - measured_rms
        self.integral = float(np.clip(self.integral + error * dt, -0.6, 0.6))
        derivative = (error - self.previous_error) / dt if dt > 0.0 else 0.0
        self.previous_error = error

        gain = 1.0 + self.kp * error + self.ki * self.integral + self.kd * derivative
        return float(np.clip(gain, self.min_gain, self.max_gain))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Osciloscopio rainbow reactivo al microfono en tiempo real."
    )
    parser.add_argument("--version", action="version", version=f"Rainbow Mic Sine {VERSION}")
    parser.add_argument("--list-devices", action="store_true", help="Muestra entradas/salidas de audio.")
    parser.add_argument("--device", type=int, default=None, help="ID del dispositivo de entrada.")
    parser.add_argument("--samplerate", type=int, default=44100, help="Frecuencia de muestreo.")
    parser.add_argument("--blocksize", type=int, default=1024, help="Muestras por bloque de audio.")
    parser.add_argument("--target-rms", type=float, default=0.12, help="Nivel RMS que el PID intenta mantener.")
    parser.add_argument("--window", type=int, default=2048, help="Muestras visibles en el osciloscopio.")
    parser.add_argument(
        "--mode",
        choices=("line", "circle", "portal"),
        default="line",
        help="Visual inicial: line, circle o portal.",
    )
    parser.add_argument("--theme", choices=THEME_NAMES, default="rainbow", help="Tema visual inicial.")
    parser.add_argument("--no-hud", action="store_true", help="Oculta el HUD inicial.")
    parser.add_argument("--no-twin", action="store_true", help="Oculta el gemelo/eco de la linea.")
    parser.add_argument("--no-trail", action="store_true", help="Oculta la estela fractal.")
    parser.add_argument("--trail-depth", type=int, default=12, help="Cantidad de frames guardados en la estela.")
    parser.add_argument("--trail-step", type=int, default=3, help="Actualiza la estela cada N frames.")
    parser.add_argument("--trail-fade-frames", type=int, default=96, help="Frames que tarda la estela en irse.")
    parser.add_argument("--trail-expand", type=float, default=0.18, help="Expansion radial de la estela al desvanecerse.")
    parser.add_argument("--render-points", type=int, default=960, help="Puntos dibujados despues del bake visual.")
    parser.add_argument("--fps", type=int, default=30, help="FPS objetivo de la animacion.")
    parser.add_argument("--smoke-test", action="store_true", help="Prueba el microfono sin abrir ventana.")
    return parser.parse_args()


def audio_callback(audio_queue: queue.Queue[np.ndarray]):
    def callback(indata: np.ndarray, frames: int, time, status: sd.CallbackFlags) -> None:
        if status:
            print(status, file=sys.stderr)
        audio_queue.put(indata[:, 0].copy())

    return callback


def estimate_peak_hz(samples: np.ndarray, samplerate: int) -> float:
    if samples.size < 16:
        return 0.0

    windowed = samples * np.hanning(samples.size)
    spectrum = np.abs(np.fft.rfft(windowed))
    freqs = np.fft.rfftfreq(samples.size, d=1.0 / samplerate)

    min_hz = 60.0
    max_hz = min(2200.0, samplerate / 2.0)
    mask = (freqs >= min_hz) & (freqs <= max_hz)
    if not np.any(mask):
        return 0.0

    local_spectrum = spectrum[mask]
    local_freqs = freqs[mask]
    return float(local_freqs[int(np.argmax(local_spectrum))])


def consume_audio(audio_queue: queue.Queue[np.ndarray], state: AudioState, samplerate: int) -> None:
    chunks: list[np.ndarray] = []
    while True:
        try:
            chunks.append(audio_queue.get_nowait())
        except queue.Empty:
            break

    if not chunks:
        state.rms *= 0.92
        return

    samples = np.concatenate(chunks)
    rms = float(np.sqrt(np.mean(np.square(samples)))) if samples.size else 0.0
    peak_hz = estimate_peak_hz(samples, samplerate)

    state.rms = 0.82 * state.rms + 0.18 * rms
    if peak_hz > 0.0:
        state.peak_hz = 0.88 * state.peak_hz + 0.12 * peak_hz if state.peak_hz else peak_hz


def consume_audio_scope(
    audio_queue: queue.Queue[np.ndarray],
    state: AudioState,
    samplerate: int,
    scope_buffer: np.ndarray,
) -> np.ndarray:
    chunks: list[np.ndarray] = []
    while True:
        try:
            chunks.append(audio_queue.get_nowait())
        except queue.Empty:
            break

    if not chunks:
        state.rms *= 0.94
        return scope_buffer

    samples = np.concatenate(chunks).astype(np.float64, copy=False)
    samples = samples - float(np.mean(samples))

    rms = float(np.sqrt(np.mean(np.square(samples)))) if samples.size else 0.0
    peak_hz = estimate_peak_hz(samples, samplerate)
    state.rms = 0.78 * state.rms + 0.22 * rms
    if peak_hz > 0.0:
        state.peak_hz = 0.86 * state.peak_hz + 0.14 * peak_hz if state.peak_hz else peak_hz

    if samples.size >= scope_buffer.size:
        return samples[-scope_buffer.size :]

    shifted = np.roll(scope_buffer, -samples.size)
    shifted[-samples.size :] = samples
    return shifted


def make_rainbow_segments(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    points = np.column_stack([x, y]).reshape(-1, 1, 2)
    return np.concatenate([points[:-1], points[1:]], axis=1)


def make_radial_segments(angles: np.ndarray, signal: np.ndarray) -> np.ndarray:
    values = signal[:-1]
    theta = angles[:-1]

    inner_radius = 0.42 + np.minimum(values, 0.0) * 0.20
    outer_radius = 0.88 + np.maximum(values, 0.0) * 0.58 + np.abs(values) * 0.22

    start = np.column_stack([inner_radius * np.cos(theta), inner_radius * np.sin(theta)])
    end = np.column_stack([outer_radius * np.cos(theta), outer_radius * np.sin(theta)])
    return np.stack([start, end], axis=1)


def main() -> int:
    args = parse_args()

    if args.list_devices:
        print(sd.query_devices())
        return 0

    audio_queue: queue.Queue[np.ndarray] = queue.Queue()
    state = AudioState(mode=args.mode)
    ui = UiState(
        theme=args.theme,
        hud_visible=not args.no_hud,
        twin_visible=not args.no_twin,
        trail_visible=not args.no_trail,
        trail_depth=max(0, args.trail_depth),
    )
    gain_pid = GainPid(target_rms=args.target_rms)

    if args.smoke_test:
        try:
            with sd.InputStream(
                device=args.device,
                channels=1,
                samplerate=args.samplerate,
                blocksize=args.blocksize,
                callback=audio_callback(audio_queue),
            ):
                time.sleep(2.0)
                consume_audio(audio_queue, state, args.samplerate)
        except sd.PortAudioError as exc:
            print(f"No pude abrir el microfono: {exc}", file=sys.stderr)
            return 1

        print(f"smoke ok | rms={state.rms:.5f} | peak_hz={state.peak_hz:.1f}")
        return 0

    visible_samples = max(256, args.window)
    render_points = int(np.clip(args.render_points, 192, visible_samples))
    render_indices = np.linspace(0, visible_samples - 1, render_points).astype(np.int64)
    color_axis = np.linspace(0.0, 1.0, render_points - 1)
    line_x = np.linspace(-1.45, 1.45, render_points)
    line_y = np.zeros_like(line_x)
    angles = np.linspace(0.0, 2.0 * np.pi, render_points, endpoint=True)
    base_radius = 1.0
    if state.mode == "circle":
        radius = np.full_like(angles, base_radius)
        x = radius * np.cos(angles)
        y = radius * np.sin(angles)
    else:
        x = line_x
        y = line_y
    scope_buffer = np.zeros(visible_samples)
    theme = THEMES[ui.theme]
    colors = plt.get_cmap(theme["cmap"])(color_axis)

    fig, ax = plt.subplots(figsize=(11, 6))
    fig.canvas.manager.set_window_title("Rainbow Mic Sine")
    fig.patch.set_facecolor(theme["bg"])
    ax.set_facecolor(theme["bg"])
    ax.set_xlim(-1.55, 1.55)
    ax.set_ylim(-1.55, 1.55)
    ax.set_aspect("equal", adjustable="box")
    ax.axis("off")

    line = LineCollection(make_rainbow_segments(x, y), colors=colors, linewidths=1.6)
    line.set_capstyle("round")
    ax.add_collection(line)

    glow = LineCollection(make_rainbow_segments(x, y), colors=colors, linewidths=4.0, alpha=0.08)
    glow.set_capstyle("round")
    ax.add_collection(glow)

    twin = LineCollection(make_rainbow_segments(x, y), colors=colors, linewidths=1.1, alpha=0.48)
    twin.set_capstyle("round")
    ax.add_collection(twin)

    trail_lines: list[LineCollection] = []
    for _ in range(ui.trail_depth):
        trail = LineCollection(make_rainbow_segments(x, y), colors=colors, linewidths=1.0, alpha=0.0)
        trail.set_capstyle("round")
        ax.add_collection(trail)
        trail_lines.append(trail)

    trail_history: list[tuple[np.ndarray, np.ndarray, float, int]] = []

    meter = ax.text(
        0.02,
        0.96,
        "",
        color=theme["fg"],
        fontsize=12,
        fontfamily="monospace",
        transform=ax.transAxes,
        va="top",
    )

    def set_mode(next_mode: str) -> None:
        if next_mode == state.mode:
            return
        state.mode = next_mode

    def cycle_theme(direction: int = 1) -> None:
        index = THEME_NAMES.index(ui.theme)
        ui.theme = THEME_NAMES[(index + direction) % len(THEME_NAMES)]
        next_theme = THEMES[ui.theme]
        fig.patch.set_facecolor(next_theme["bg"])
        ax.set_facecolor(next_theme["bg"])
        meter.set_color(next_theme["fg"])

    def on_key(event) -> None:
        if event.key in {" ", "tab"}:
            modes = ("line", "circle", "portal")
            set_mode(modes[(modes.index(state.mode) + 1) % len(modes)])
        elif event.key == "l":
            set_mode("line")
        elif event.key == "c":
            set_mode("circle")
        elif event.key == "p":
            set_mode("portal")
        elif event.key == "t":
            cycle_theme(1)
        elif event.key == "T":
            cycle_theme(-1)
        elif event.key == "h":
            ui.hud_visible = not ui.hud_visible
            meter.set_visible(ui.hud_visible)
        elif event.key == "g":
            ui.glow_level = (ui.glow_level + 1) % 4
        elif event.key == "e":
            ui.twin_visible = not ui.twin_visible
        elif event.key == "f":
            ui.trail_visible = not ui.trail_visible
        elif event.key in {"+", "="}:
            ui.line_scale = min(2.8, ui.line_scale + 0.15)
        elif event.key in {"-", "_"}:
            ui.line_scale = max(0.35, ui.line_scale - 0.15)
        elif event.key == "up":
            gain_pid.target_rms = max(0.02, gain_pid.target_rms - 0.01)
        elif event.key == "down":
            gain_pid.target_rms = min(0.40, gain_pid.target_rms + 0.01)

    fig.canvas.mpl_connect("key_press_event", on_key)

    def make_geometry(scoped: np.ndarray, phase_offset: int = 0, strength: float = 1.0) -> tuple[np.ndarray, np.ndarray]:
        source = np.roll(scoped, phase_offset) * strength
        if state.mode == "circle":
            radius = base_radius + source * 0.42
            return radius * np.cos(angles), radius * np.sin(angles)

        return line_x, source * 1.15

    def make_visual_segments(
        scoped: np.ndarray,
        phase_offset: int = 0,
        strength: float = 1.0,
        force_path: bool = False,
    ) -> np.ndarray:
        source = np.roll(scoped, phase_offset) * strength
        if state.mode == "portal" and not force_path:
            return make_radial_segments(angles, source)

        x_values, y_values = make_geometry(scoped, phase_offset, strength)
        return make_rainbow_segments(x_values, y_values)

    def fade_color(colors_in: np.ndarray, alpha: float) -> np.ndarray:
        faded = colors_in.copy()
        faded[:, 3] = np.clip(faded[:, 3] * alpha, 0.0, 1.0)
        return faded

    def update(frame: int):
        nonlocal trail_history
        nonlocal scope_buffer
        scope_buffer = consume_audio_scope(audio_queue, state, args.samplerate, scope_buffer)

        state.auto_gain = 0.88 * state.auto_gain + 0.12 * gain_pid.update(state.rms, 0.016)
        scoped_full = np.clip(scope_buffer * state.auto_gain, -1.0, 1.0)
        scoped = scoped_full[render_indices]
        loudness = min(1.0, max(0.0, state.rms * state.auto_gain))

        segments = make_visual_segments(scoped)
        state.hue_shift = (state.hue_shift + 0.004 + loudness * 0.018) % 1.0
        cmap = plt.get_cmap(THEMES[ui.theme]["cmap"])
        shifted = cmap((color_axis + state.hue_shift) % 1.0)

        linewidth = (0.9 + loudness * 2.2) * ui.line_scale
        line.set_segments(segments)
        line.set_color(shifted)
        line.set_linewidth(linewidth)

        twin_offset = max(4, int(render_points * 0.035))
        twin_strength = 0.62 if state.mode == "portal" else 0.72
        twin.set_segments(make_visual_segments(scoped, phase_offset=twin_offset, strength=twin_strength))
        twin.set_color(fade_color(np.roll(shifted, twin_offset, axis=0), 0.72))
        twin.set_linewidth(linewidth * 0.72)
        twin.set_alpha(0.34 + loudness * 0.24 if ui.twin_visible else 0.0)

        glow.set_segments(segments)
        glow.set_color(shifted)
        glow_scale = [0.0, 1.6, 2.8, 4.2][ui.glow_level]
        glow.set_linewidth(linewidth * max(1.0, glow_scale))
        glow.set_alpha((0.02 + loudness * 0.08) * glow_scale)

        should_sample_trail = frame % max(1, args.trail_step) == 0
        if ui.trail_visible and trail_lines and should_sample_trail:
            trail_history.insert(0, (segments.copy(), shifted.copy(), linewidth, frame))
            trail_history = trail_history[: len(trail_lines)]
        else:
            if not ui.trail_visible:
                trail_history = []

        fade_frames = max(1, args.trail_fade_frames)
        trail_history = [
            item for item in trail_history if frame - item[3] <= fade_frames
        ]

        for index, trail in enumerate(trail_lines):
            if index >= len(trail_history):
                trail.set_alpha(0.0)
                continue

            old_segments, old_colors, old_width, born_frame = trail_history[index]
            age = np.clip((frame - born_frame) / fade_frames, 0.0, 1.0)
            age_by_layer = (index + 1) / max(1, len(trail_lines))
            fractal_decay = (1.0 - age) ** 2.4
            fractal_decay *= (1.0 - age_by_layer * 0.35)

            wave = np.sin((index + 1) * 1.618 + frame * 0.055)
            breathe = 1.0 + args.trail_expand * (age ** 1.35)
            shimmer = 1.0 + 0.012 * wave * (1.0 - age)
            expanded_segments = old_segments * breathe * shimmer

            trail.set_segments(expanded_segments)
            trail.set_color(fade_color(old_colors, 0.46 * fractal_decay))
            trail.set_linewidth(max(0.18, old_width * (1.0 - age * 0.76)))
            trail.set_alpha(0.52 * fractal_decay)

        meter.set_text(
            f"MODE {state.mode.upper()}  THEME {ui.theme.upper()}  RMS {state.rms:.4f}  "
            f"PID {state.auto_gain:5.2f}x/{gain_pid.target_rms:.2f}  "
            f"GLOW {ui.glow_level}  TWIN {int(ui.twin_visible)}  TRAIL {int(ui.trail_visible)}  "
            f"WIDTH {ui.line_scale:.2f}  PEAK {state.peak_hz:7.1f} Hz"
        )
        return line, twin, glow, meter, *trail_lines

    try:
        with sd.InputStream(
            device=args.device,
            channels=1,
            samplerate=args.samplerate,
            blocksize=args.blocksize,
            callback=audio_callback(audio_queue),
        ):
            update(0)
            fig.canvas.draw_idle()
            interval_ms = int(1000 / max(1, args.fps))
            animation = FuncAnimation(fig, update, interval=interval_ms, blit=False, cache_frame_data=False)
            plt.show()
            _ = animation
    except sd.PortAudioError as exc:
        print(f"No pude abrir el microfono: {exc}", file=sys.stderr)
        print("Prueba: python rainbow_mic_sine.py --list-devices", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
