# Despliegue de Voice Web fase 1 en Hostinger

## Situación real

La prueba por túnel SSH al VPS de Hostinger falló porque ese VPS no es el mismo host donde corre el entorno actual de OpenClaw. Allí no existían:

- `/data/.openclaw/workspace`
- `npm`
- la instalación/configuración actual de OpenClaw

Conclusión: para que la web funcione en Hostinger, no basta con copiar el HTML. Hace falta también el backend local que usa:

- OpenClaw CLI/gateway
- Whisper (`whisper-cli` + modelo)
- ffmpeg
- TTS Microsoft vía OpenClaw
- repo del workspace ya compilado

## Ruta recomendada

Preparar primero el host de Hostinger y luego arrancar allí la web.

## Bootstrap base

En el VPS de Hostinger:

```bash
cd /root
curl -fsSL https://raw.githubusercontent.com/JaviKia/openclaw-workspace/main/scripts/deploy/hostinger-voice-web-bootstrap.sh -o hostinger-voice-web-bootstrap.sh
chmod +x hostinger-voice-web-bootstrap.sh
./hostinger-voice-web-bootstrap.sh
```

Alternativa si ya tienes el repo clonado:

```bash
cd /data/.openclaw/workspace
bash scripts/deploy/hostinger-voice-web-bootstrap.sh
```

## Lo que aún hay que tener en Hostinger

### Imprescindible

1. OpenClaw funcionando en ese host
2. Config y estado reales de OpenClaw
3. `ffmpeg`
4. `whisper-cli`
5. modelo de Whisper disponible
6. acceso a la cuenta/modelo del agente

### Variables/rutas a revisar

- `OPENCLAW_RUNTIME_OPENCLAW_BIN`
- `OPENCLAW_RUNTIME_FFMPEG_BIN`
- `OPENCLAW_RUNTIME_WHISPER_BIN`
- `OPENCLAW_RUNTIME_WHISPER_MODEL`
- `OPENCLAW_WEB_HOST`
- `OPENCLAW_WEB_PORT`

## Arranque de la web en Hostinger

```bash
cd /opt/openclaw-workspace
OPENCLAW_WEB_HOST=127.0.0.1 OPENCLAW_WEB_PORT=4173 npm run start:web
```

## Túnel desde el portátil

```bash
ssh -N -L 4173:127.0.0.1:4173 root@<hostinger>
```

## Prueba local desde portátil

```bash
curl http://localhost:4173/health
```

Luego abrir:

- `http://localhost:4173`

## Diagnóstico rápido

### Si el túnel falla con `Connection refused`
No hay proceso escuchando en `127.0.0.1:4173` en el VPS real.

### Si la web arranca pero falla al hablar
Suele faltar uno de estos:

- OpenClaw funcional en ese host
- `whisper-cli`
- modelo Whisper
- ffmpeg
- auth/config del agente

## Recomendación práctica

Antes de pelear con Nginx o systemd, validar primero un arranque manual simple en Hostinger con:

```bash
npm run build
node scripts/web-phase1/server.mjs
```

Si eso responde en `/health`, entonces ya merece la pena automatizar servicio y proxy.
