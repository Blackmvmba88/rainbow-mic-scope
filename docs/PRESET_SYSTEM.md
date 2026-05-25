# Preset System

Presets should make the visualizer feel like an instrument instead of a pile of sliders.

## Preset Shape

```json
{
  "schema": 1,
  "name": "Portal Aurora Slow Trail",
  "mode": "portal",
  "theme": "aurora",
  "targetRms": 0.12,
  "fps": 30,
  "renderPoints": 720,
  "trailDepth": 18,
  "trailFadeMs": 2600,
  "trailExpand": 0.28,
  "lineScale": 1,
  "twin": true,
  "trail": true,
  "hud": true,
  "colorSource": "position"
}
```

## Built-In Presets

- `Portal Rainbow`: default high-energy portal.
- `Circle Halo`: smooth circular oscilloscope.
- `Line Scope`: classic waveform.
- `Aurora Clean`: no HUD, elegant capture mode.
- `Ghost Minimal`: low-saturation visual for overlays.
- `Neon Social`: high contrast for short clips.

## Browser Storage

Use `localStorage` first.

Suggested keys:

```text
rainbowMicScope.presets
rainbowMicScope.activePreset
```

## Import / Export JSON

Expected behavior:

- `Export Preset` downloads a `.json` file.
- `Import Preset` reads a selected `.json` file.
- Invalid presets show a clear error.
- Schema version is checked before applying.

## Shareable URL Config

Use query parameters for lightweight sharing:

```text
?mode=portal&theme=aurora&trailDepth=18&trailExpand=0.28
```

Rules:

- URL values should never override microphone permission flow.
- Unknown parameters should be ignored.
- Values should be clamped to safe ranges.
