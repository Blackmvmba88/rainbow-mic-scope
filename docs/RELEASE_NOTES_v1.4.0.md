# Rainbow Mic Scope v1.4.0

First packaged release.

## Highlights

- New WebUI built with Canvas and Web Audio API.
- Real microphone input with browser permission flow.
- Three visual modes: `line`, `circle`, and `portal`.
- PID-like auto-gain for reactive but controlled movement.
- Twin/echo line plus expanding fading trail.
- Performance controls for FPS and render-point baking.
- Python runtime remains available for native Matplotlib experiments.

## Validation

- WebUI JavaScript syntax checked with `node --check`.
- Static WebUI served locally with `python3 -m http.server`.
- Python runtime compiled with `py_compile`.
- Microphone smoke-test flow retained in `./run_scope.sh --smoke-test`.

## Known Notes

- Browser mic access requires `localhost` or another secure context.
- The WebUI starts silent until `Start Mic` is clicked.
- Python mic access may still require macOS microphone permission.
