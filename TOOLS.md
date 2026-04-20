---
summary: "Local operational notes for this OpenClaw environment"
read_when:
  - Every session
---

# TOOLS.md - Local Notes

## Configuración y secretos

- Config principal de OpenClaw: `/data/.openclaw/openclaw.json`
- Config de auth de agente: `/data/.openclaw/agents/main/agent/auth-profiles.json`
- Config de modelos de agente: `/data/.openclaw/agents/main/agent/models.json`
- Backup local pre-update: `/data/.openclaw/openclaw.json.pre-update.bak`
- Backups de config de OpenClaw:
  - `/data/.openclaw/openclaw.json.bak`
  - `/data/.openclaw/openclaw.json.bak.*`
- `.env` canónico: `/data/.openclaw/.env`

Regla:
- Documentar ubicación y propósito, no pegar secretos completos en este archivo.

## Workspace y repo

- Workspace principal: `/data/.openclaw/workspace`
- Repo git local: `/data/.openclaw/workspace/.git`
- Remote GitHub: `git@github.com:JaviKia/openclaw-workspace.git`
- Rama principal: `main`

## CLI y utilidades

- OpenClaw CLI en PATH: `/usr/local/bin/openclaw`
- OpenClaw CLI bueno/actual: `/data/.npm-global/bin/openclaw`
- Git: `/usr/bin/git`
- Homebrew: `/data/linuxbrew/.linuxbrew/bin/brew`
- `ffmpeg`: `/data/linuxbrew/.linuxbrew/bin/ffmpeg`
- `ffprobe`: `/data/linuxbrew/.linuxbrew/bin/ffprobe`
- `whisper-cli`: `/data/linuxbrew/.linuxbrew/bin/whisper-cli`
- `whisper` (Python CLI): no instalado

## Modelos locales

- Whisper model dir: `/data/.openclaw/models/whisper`
- Modelo activo: `/data/.openclaw/models/whisper/ggml-base.bin`

## Logs y rutas operativas

- Logs de OpenClaw: `/data/.openclaw/logs`
- Media entrante: `/data/.openclaw/media/inbound`
- Estado/offset de Telegram:
  - `/data/.openclaw/telegram/update-offset-default.json`
  - `/data/.openclaw/credentials/telegram-pairing.json`
  - `/data/.openclaw/credentials/telegram-default-allowFrom.json`

## Mensajería

- Plataforma principal: Telegram
- Bot actual: `@KelexKiaBot`
- Chat privado principal: `telegram:7947445599`
- Usuario principal: `Javier Martinez (@javi2203)`
- Política DM actual: pairing

## SSH

- Clave GitHub de este VPS:
  - privada: `~/.ssh/id_ed25519_github_openclaw`
  - pública: `~/.ssh/id_ed25519_github_openclaw.pub`
- Host configurado: `github.com`
- Regla: usar SSH para push a GitHub, no tokens embebidos en comandos.

## Reglas operativas del entorno

- Para cambios persistentes en workspace, hacer commit en git.
- Para mensajería, preferir herramientas nativas de OpenClaw antes que shell/curl.
- Para Telegram, el canal principal de trabajo es DM.
- Para voz:
  - transcripción local activa con `whisper-cpp`
  - modelo actual `ggml-base.bin`
  - auto-TTS activado en modo `inbound`
  - proveedor TTS configurado: `microsoft`
  - voz preferida actual: `en-US-BrianMultilingualNeural`
- Antes de dar una config por cerrada, verificar con logs, diff o prueba real.
- En cada ejecución, antes de seguir trabajando, comprobar el contexto actual. Si supera ~50%, compactar primero.

## Flujo de compactación manual

- Helper local: `/data/.openclaw/workspace/scripts/session-tools/compact-session.mjs`
- Doc rápida: `/data/.openclaw/workspace/docs/session-compaction.md`
- Regla: usar el binario bueno `/data/.npm-global/bin/openclaw`, no el de `/usr/local/bin/openclaw`, para llamar a `sessions.compact`.
- Comandos rápidos:
  - `npm run compact:main`
  - `npm run compact:runtime:e2e`
  - `npm run compact:web`
- Flujo esperado por defecto:
  1. Ejecutar `session_status` y mirar `% de contexto`
  2. Si `> ~50%`, correr `npm run compact:main` antes de cualquier trabajo adicional
  3. Después seguir con la tarea normal

## Stack y runtime

- Runtime principal: OpenClaw `main`
- Modelo por defecto: `openai-codex/gpt-5.4`
- Gateway local: `ws://127.0.0.1:18789`
- Browser control local: `http://127.0.0.1:18791/`

## Pendientes útiles

- Decidir si habrá `.env` canónico para secretos del entorno
- Si la UI deja de ser local, configurar `gateway.trustedProxies`
- Valorar respuesta por voz, no solo entrada por voz
