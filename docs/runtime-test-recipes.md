# Runtime test recipes

Pruebas guardadas para el runtime de voz Level 1.

## Muestras guardadas

- `fixtures/runtime-audio/sample-1-es.mp3`
- `fixtures/runtime-audio/sample-2-es.mp3`

## Comandos

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
