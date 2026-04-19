# Runtime test recipes

Pruebas guardadas para el runtime de voz Level 1.

## Muestras guardadas

- `fixtures/runtime-audio/sample-1-es.mp3`
- `fixtures/runtime-audio/sample-2-es.mp3`
- `fixtures/runtime-audio/sample-3-es.mp3`
- `fixtures/runtime-audio/sample-4-es.mp3`
- `fixtures/runtime-audio/sample-5-es.mp3`
- `fixtures/runtime-audio/sample-6-es.mp3`
- `fixtures/runtime-audio/sample-7-es.mp3`
- `fixtures/runtime-audio/sample-8-es.mp3`
- `fixtures/runtime-audio/sample-9-es.mp3`
- `fixtures/runtime-audio/sample-10-es.mp3`

## Comandos

### Generar o regenerar las muestras sintéticas

```bash
node scripts/runtime-tests/generate-samples.mjs
```

### Verificar que las muestras existen

```bash
npm run runtime:test:prepare
```

### Prueba corta end-to-end

```bash
npm run runtime:test:sample1
```

### Prueba larga end-to-end

```bash
npm run runtime:test:sample2
```

### Prueba de interrupción

```bash
npm run runtime:test:interrupt
```

## Notas

- `sample1` y `sample2` usan:
  - audio por fichero con `ffmpeg`
  - STT real
  - backend eco local
  - TTS real
  - playback real
- Se puede sobreescribir la ruta base de muestras con `OPENCLAW_RUNTIME_SAMPLE_DIR`.
- Se puede ajustar la espera post-audio con `OPENCLAW_RUNTIME_AUDIO_POST_END_WAIT_MS`.
