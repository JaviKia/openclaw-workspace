# Voice web phase 1

Prueba privada push-to-talk desde navegador usando el micro y altavoz del portátil, con backend OpenClaw en el VPS.

## Qué hace

- captura audio en navegador con `MediaRecorder`
- sube el audio al VPS por `POST /api/turn`
- STT con Whisper local del VPS
- backend real OpenClaw mediante sesión dedicada `agent:main:runtime-openclaw-web`
- TTS Microsoft en el VPS
- devuelve MP3 al navegador para reproducirlo

## Arranque

```bash
cd /data/.openclaw/workspace
npm run start:web
```

Servidor local del VPS:

- `http://127.0.0.1:4173`

## Acceso recomendado desde portátil

Usar túnel SSH para abrirlo como `localhost`, así el navegador permite micrófono sin publicar nada:

```bash
ssh -L 4173:127.0.0.1:4173 <tu-vps>
```

Luego abrir en el portátil:

- `http://localhost:4173`

## Endpoints

- `GET /` → UI mínima
- `GET /health` → smoke check
- `POST /api/turn` → audio binario (`audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`)
- `POST /api/reset` → limpia UI local del navegador

## Notas

- pensado para fase 1, no manos libres continuo
- modo actual: push-to-talk
- útil para validar conversación real sin depender de audio hardware en el VPS
