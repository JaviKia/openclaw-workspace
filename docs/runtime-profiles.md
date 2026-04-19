# Runtime profiles

Perfiles reutilizables para lanzar el runtime de voz sin reconstruir a mano un bloque largo de variables de entorno.

## Perfil actual

- `profiles/runtime/headless-voice-e2e.env`

Este perfil deja preparado el runtime para:
- audio por fichero con `ffmpeg`
- STT real
- backend eco local
- TTS real
- playback real
- idioma `es`
- voice `en-US-BrianMultilingualNeural`

## Lanzar con muestras guardadas

```bash
npm run runtime:profile:e2e:sample1
npm run runtime:profile:e2e:sample2
```

## Lanzar manualmente con otra muestra

```bash
./scripts/runtime-tests/run-profile.sh \
  ./profiles/runtime/headless-voice-e2e.env \
  ./ruta/a/tu-muestra.mp3
```

## Relación con las pruebas guardadas

Las pruebas guardadas siguen existiendo:
- `npm run runtime:test:sample1`
- `npm run runtime:test:sample2`
- `npm run runtime:test:interrupt`

La diferencia es que ahora además hay un perfil reutilizable y explícito que puede reaprovecharse con otras muestras.
