# Visual Evolution Engine

Rainbow Mic Scope can evolve beyond static visual presets into a living visual ecosystem.

Instead of manually choosing one perfect visual mode, the system can generate many visual variants, score them, keep the best ones, and discard weak or unstable ones over time.

## Core Idea

Each visual preset becomes a small organism with a genome.

```json
{
  "id": "portal_aurora_mutation_001",
  "mode": "portal",
  "theme": "aurora",
  "trailDepth": 18,
  "trailFadeFrames": 140,
  "trailExpand": 0.28,
  "glow": 1.4,
  "rotation": 0.03,
  "noise": 0.08,
  "smoothness": 0.72,
  "colorEntropy": 0.61
}
```

The genome controls how the waveform behaves, how trails expand, how color shifts, how much glow is used, and how aggressively the visual reacts to sound.

## Evolution Loop

1. Generate visual genomes from safe baseline presets.
2. Mutate selected parameters within bounded ranges.
3. Render each candidate against live microphone input or recorded audio samples.
4. Score each visual using fitness metrics.
5. Keep the best candidates in a survivor pool.
6. Remove weak, unstable, boring, or expensive candidates.
7. Breed strong candidates into the next generation.

```text
baseline presets
      ↓
mutation engine
      ↓
candidate visuals
      ↓
fitness scoring
      ↓
survivor pool
      ↓
next generation
```

## Fitness Metrics

A visual survives when it is both beautiful and stable.

Possible scoring signals:

- Frame stability: avoids FPS collapse.
- Audio reactivity: responds clearly to RMS, peaks, and transients.
- Smoothness: avoids harsh jitter unless intentionally selected.
- Contrast: waveform remains readable.
- Motion richness: avoids dead/static visuals.
- Energy match: visual intensity follows audio intensity.
- Human rating: user can like/dislike a visual during runtime.
- Session survival: visuals used longer get stronger scores.

Example scoring model:

```text
fitness =
  fps_score * 0.20 +
  audio_reactivity * 0.25 +
  smoothness * 0.15 +
  contrast * 0.15 +
  motion_richness * 0.15 +
  human_rating * 0.10
```

## Mutation Rules

Mutations must stay bounded so the system explores without destroying usability.

Examples:

```text
trailExpand       ± 0.04
trailDepth        ± 2
trailFadeFrames   ± 12
glow              ± 0.15
rotation          ± 0.01
noise             ± 0.02
smoothness        ± 0.05
colorEntropy      ± 0.05
```

Hard limits protect the renderer:

```text
fps >= 24
trailDepth <= 64
glow <= 3.0
noise <= 0.35
renderPoints <= 1440
```

## Audio as Evolutionary Pressure

Different audio material should naturally favor different species of visuals.

- Reggae / dub: long trails, slow expansion, warm pulse behavior.
- Drum and bass: fast transients, sharper motion, dense rhythmic response.
- Ambient: low entropy, slow drift, smooth portal breathing.
- Rock / metal: high contrast, aggressive peaks, thick wave energy.
- Experimental electronic: unstable geometry, spectral color shifts, controlled chaos.

The visual engine should not only display sound. It should adapt to it.

## Phase 1: Manual Evolution

Add a simple WebUI layer:

- `Mutate` button: creates a nearby variant of the current visual.
- `Keep` button: saves the current genome to local storage.
- `Kill` button: discards the candidate.
- `Random Seed` button: starts a new lineage.
- `Survivors` panel: lists saved visual organisms.

Storage target:

```text
localStorage.visualSurvivors
```

## Phase 2: Semi-Automatic Evolution

Add background scoring:

- Measure FPS.
- Measure RMS responsiveness.
- Measure waveform readability.
- Track whether the user stays on the visual.
- Auto-rank candidates.

The user still decides what survives, but the system suggests strong candidates.

## Phase 3: Generational Engine

Add population-based evolution:

- Population size: 8 to 32 candidates.
- Top survivors: 20% to 30%.
- Mutation rate: adaptive.
- Crossover: combine parameters from two strong genomes.
- Extinction: delete poor performers.
- Hall of Fame: preserve legendary visuals permanently.

## Phase 4: Recorded Audio Benchmarking

Use short audio clips as test environments.

```text
tests/audio/reggae_loop.wav
tests/audio/ambient_pad.wav
tests/audio/metal_transient.wav
tests/audio/electronic_glitch.wav
```

Each candidate visual is tested against multiple sonic ecosystems.

## Phase 5: Export and Sharing

Strong survivors should become shareable artifacts:

```text
visuals/portal_aurora_mutation_001.json
visuals/ghost_circle_lineage_014.json
visuals/plasma_portal_hall_of_fame.json
```

Future export targets:

- JSON visual genome.
- URL preset hash.
- Screenshot.
- Short video/GIF capture.
- Album canvas loop.

## Long-Term Vision

The final version of Rainbow Mic Scope should behave like an audio-reactive artificial life laboratory.

The operator does not design every frame by hand.

The operator designs the laws of visual survival.

The best visuals remain.
The weak visuals disappear.
The system becomes more beautiful over time.
