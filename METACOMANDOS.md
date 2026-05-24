# Metacomandos

Vocabulario rapido para operar, probar y evolucionar el osciloscopio rainbow reactivo al microfono.

## Arranque base

```bash
cd /Users/blackmambarecords/Documents/Codex/2026-05-19/vamos-a-programar-una-onda-sinusoidal
source .venv/bin/activate
python rainbow_mic_sine.py
```

Sin activar entorno:

```bash
./run_scope.sh
./run_scope.sh --mode circle --window 4096
```

WebUI:

```bash
python3 -m http.server 4173 -d webui
```

Abrir `http://localhost:4173` y tocar `Start Mic`.

## Verificacion

```bash
python rainbow_mic_sine.py --smoke-test
```

Tambien funciona asi:

```bash
./run_scope.sh --smoke-test
```

Confirma que el microfono abre y devuelve algo como:

```text
smoke ok | rms=0.02400 | peak_hz=505.2
```

```bash
python rainbow_mic_sine.py --list-devices
```

Lista entradas y salidas de Core Audio. En esta Mac ya aparecieron, entre otros:

```text
2 Micrófono de Studio Display
4 Micrófono externo
```

## Modos visuales

```bash
python rainbow_mic_sine.py --mode line
```

Osciloscopio lineal: la linea dibuja la forma de onda cruda del microfono.

```bash
python rainbow_mic_sine.py --mode circle
```

Osciloscopio circular: circulo base perfecto, con el audio deformando el radio en tiempo real.

```bash
python rainbow_mic_sine.py --mode portal
```

Portal radial: corona de radios vivos hecha con audio crudo, PID y estela.

Comando recomendado si tu terminal dice `zsh: command not found: python`:

```bash
./run_scope.sh --mode circle
```

## Teclas en vivo

```text
space  alterna entre line y circle
tab    alterna entre line, circle y portal
l      fuerza modo line
c      fuerza modo circle
p      fuerza modo portal
t      cambia al siguiente tema visual
T      cambia al tema visual anterior
h      muestra/oculta el HUD
g      cambia intensidad de glow
e      prende/apaga el gemelo de la linea
f      prende/apaga la estela
+      engrosa la linea
-      adelgaza la linea
up     mas sensible: baja target-rms
down   menos sensible: sube target-rms
```

## Temas de interfaz

```bash
python rainbow_mic_sine.py --theme rainbow
python rainbow_mic_sine.py --theme plasma
python rainbow_mic_sine.py --theme aurora
python rainbow_mic_sine.py --theme ghost
python rainbow_mic_sine.py --theme mono
```

Tambien puedes cambiar de tema en vivo con `t`.

```bash
python rainbow_mic_sine.py --no-hud
```

Inicia sin texto en pantalla para capturas limpias.

## Gemelo y estela

```bash
./run_scope.sh --mode circle --trail-depth 24
```

Activa una estela mas larga: la forma tarda mas en desvanecerse.

```bash
./run_scope.sh --mode circle --trail-depth 18 --trail-fade-frames 140 --trail-expand 0.28
```

Estela eterea: se expande, se difumina y tarda mas en desaparecer.

```bash
./run_scope.sh --mode circle --trail-depth 8
```

Estela corta y mas limpia.

```bash
./run_scope.sh --mode circle --no-twin
```

Inicia sin el gemelo/eco.

```bash
./run_scope.sh --mode circle --no-trail
```

Inicia sin estela.

## Performance / bake visual

```bash
./run_scope.sh --mode circle --window 4096 --render-points 720 --fps 24 --trail-step 4
```

Preset ligero: mantiene ventana de audio grande, pero pinta menos puntos y actualiza la estela mas lento.

```bash
./run_scope.sh --mode circle --window 4096 --render-points 1280 --fps 30 --trail-depth 18 --trail-fade-frames 120
```

Preset mas detallado: se ve mas fino, usa mas proceso.

```bash
./run_scope.sh --mode circle --window 4096 --render-points 480 --fps 20 --trail-depth 8 --trail-step 5 --trail-fade-frames 72
```

Preset rescue si hay lag.

## Microfonos

```bash
python rainbow_mic_sine.py --device 4
python rainbow_mic_sine.py --device 2
```

Usa `--list-devices` antes si cambia el setup de audio.

## Sensibilidad PID

```bash
python rainbow_mic_sine.py --target-rms 0.08
```

Mas reactivo para senales bajas: baja el objetivo.

```bash
python rainbow_mic_sine.py --target-rms 0.18
```

Menos agresivo si el visual se infla demasiado: sube el objetivo.

El indicador `PID GAIN` en pantalla muestra si el sistema esta amplificando o reduciendo.

## Resolucion temporal

```bash
python rainbow_mic_sine.py --window 1024
```

Mas rapido y nervioso.

```bash
python rainbow_mic_sine.py --window 4096
```

Mas largo y fluido.

## Calidad de audio

```bash
python rainbow_mic_sine.py --samplerate 48000
```

Usa 48 kHz si el dispositivo trabaja mejor a esa frecuencia.

```bash
python rainbow_mic_sine.py --blocksize 512
```

Menos latencia, mas carga.

```bash
python rainbow_mic_sine.py --blocksize 2048
```

Mas estable, un poco mas lento.

## Metacomandos para pedirme cambios

```text
correla
```

Ejecutar el visual y reportar si arranco o fallo.

```text
smoke test
```

Probar microfono sin abrir ventana.

```text
modo linea
```

Iniciar o dejar el visual como osciloscopio lineal.

```text
modo circulo
```

Iniciar o dejar el visual como osciloscopio circular.

```text
modo portal
```

Iniciar o dejar el visual como corona radial reactiva.

```text
webui
```

Levantar la interfaz web con Canvas/Web Audio y controles visuales.

```text
mas sensible
```

Bajar `--target-rms` o ajustar PID para levantar audio bajo.

```text
menos sensible
```

Subir `--target-rms` o limitar ganancia para que no se sature.

```text
mas fino
```

Adelgazar la linea y reducir glow.

```text
mas neon
```

Subir glow, grosor dinamico o velocidad del rainbow.

```text
gemelo
```

Agregar o ajustar la segunda linea/eco.

```text
estela fractal
```

Hacer que las formas anteriores se desvanezcan mas lento y con decaimiento no lineal.

```text
cambia tema
```

Agregar, probar o alternar paletas visuales.

```text
captura limpia
```

Ocultar HUD y dejar solo la visual.

```text
sin formato
```

Mantener la geometria gobernada por audio crudo, sin senoides ni formas inventadas.

```text
hazlo dual
```

Conservar el modo actual y agregar otro alternable, no reemplazarlo.

## Recetas utiles

Linea con microfono externo:

```bash
python rainbow_mic_sine.py --mode line --device 4 --target-rms 0.10
```

Circulo suave y estable:

```bash
python rainbow_mic_sine.py --mode circle --window 4096 --target-rms 0.14
```

Circulo nervioso y sensible:

```bash
python rainbow_mic_sine.py --mode circle --window 1024 --target-rms 0.07 --blocksize 512
```

Portal v1.3 balanceado:

```bash
./run_scope.sh --mode portal --window 4096 --render-points 720 --fps 24 --trail-step 4 --trail-depth 18 --trail-fade-frames 140 --trail-expand 0.28
```

Portal limpio para captura:

```bash
./run_scope.sh --mode portal --window 4096 --render-points 960 --fps 24 --no-hud --theme aurora
```

Circulo plasma sin HUD:

```bash
python rainbow_mic_sine.py --mode circle --theme plasma --no-hud
```

Linea ghost fina:

```bash
python rainbow_mic_sine.py --mode line --theme ghost --target-rms 0.10
```

Diagnostico completo:

```bash
python rainbow_mic_sine.py --list-devices
python rainbow_mic_sine.py --smoke-test
python rainbow_mic_sine.py --mode line
```
