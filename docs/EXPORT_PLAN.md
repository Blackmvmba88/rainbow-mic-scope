# Export Plan

The next product leap is giving the user a way to keep the visual: still image, video clip, or reusable configuration.

## PNG Capture

Use `canvas.toBlob()` to export the current frame.

Expected behavior:

- Button: `Export PNG`.
- Captures the current canvas frame.
- Uses visible background by default.
- File name format:

```text
rainbow-mic-scope-{mode}-{theme}-{timestamp}.png
```

Possible later option:

- transparent background export for overlays and video compositing.

## WebM Recording

Use `canvas.captureStream(fps)` with `MediaRecorder`.

Expected behavior:

- Button toggles between `Record` and `Stop`.
- Recording timer appears in HUD or controls.
- Saves a `.webm` file.
- File name format:

```text
rainbow-mic-scope-{mode}-{theme}-{timestamp}.webm
```

Implementation notes:

- Canvas video recording is browser-dependent.
- Chrome support should be the baseline.
- Safari may require fallback messaging.
- Audio does not need to be embedded in v1; the visual itself is the first artifact.

## Fullscreen Clean Mode

Expected behavior:

- Button: `Clean`.
- Hides panel and HUD.
- Keeps keyboard shortcut `h` for HUD.
- Keeps export/record controls reachable by exiting clean mode.

## Error UI

Do not fail silently.

Show clear messages for:

- microphone denied,
- unsupported recording API,
- export blocked,
- no canvas available,
- mobile browser limitations.
