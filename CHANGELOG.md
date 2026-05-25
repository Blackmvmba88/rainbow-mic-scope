# Changelog

## v1.5.0 - Frequency Color Branch

- Adds WebUI audio input selection for available browser `audioinput` devices.
- Adds frequency-driven coloring from FFT peak and spectral centroid.
- Adds `Color Source` control to compare frequency-driven color vs position rainbow.
- Adds `PEAK Hz` readout to the HUD.

## v1.4.1 - Phone Access

- Adds Docker and Docker Compose for local LAN hosting.
- Adds GitHub Pages static branch deployment path for HTTPS phone access.
- Adds phone-access documentation with LAN and Pages URLs.

## v1.4.0 - WebUI

- Agrega `webui/` con Canvas + Web Audio API.
- Replica modos `line`, `circle` y `portal` en navegador.
- Agrega controles visuales para tema, sensibilidad, render, FPS, estela, fade, expansion y grosor.
- El microfono se inicia desde un boton para cumplir permisos del navegador.
- Mantiene PID, gemelo y estela expansiva sin depender de Matplotlib.

## v1.3.0 - Portal

- Agrega `--version`.
- Agrega modo `portal`, una corona radial reactiva hecha con audio crudo.
- `space` y `tab` ahora rotan entre `line`, `circle` y `portal`.
- Agrega tecla `p` para entrar directo al modo `portal`.
- Conserva PID, bake visual, gemelo, estela expansiva y temas.

## v1.2.0 - Estela

- Agrega gemelo/eco de linea.
- Agrega estela expansiva con fade lento.
- Agrega controles de performance: `--fps`, `--render-points`, `--trail-step`.

## v1.1.0 - Interfaz

- Agrega temas, HUD, grosor, glow y controles en vivo.
- Agrega runner `./run_scope.sh`.

## v1.0.0 - Osciloscopio

- Convierte la visual en forma de onda cruda del microfono.
- Agrega modos `line` y `circle`.
- Agrega PID de ganancia automatica.
