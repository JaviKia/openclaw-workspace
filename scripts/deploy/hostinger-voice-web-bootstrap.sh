#!/usr/bin/env bash
set -euo pipefail

WORKDIR="${WORKDIR:-/opt/openclaw-workspace}"
NODE_MAJOR="${NODE_MAJOR:-22}"
OPENCLAW_VERSION="${OPENCLAW_VERSION:-2026.4.15}"
OPENCLAW_BIN_DEFAULT="/data/.npm-global/bin/openclaw"

log() { printf '\n[%s] %s\n' "hostinger-voice-web" "$*"; }
need_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root or with sudo." >&2
    exit 1
  fi
}

install_node() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    log "node already present: $(node -v) / npm $(npm -v)"
    return
  fi
  log "installing Node.js ${NODE_MAJOR}"
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y nodejs
}

install_base_packages() {
  log "installing base packages"
  apt-get update
  apt-get install -y git curl ffmpeg build-essential ca-certificates
}

install_openclaw() {
  if [ -x "${OPENCLAW_BIN_DEFAULT}" ]; then
    log "openclaw already present at ${OPENCLAW_BIN_DEFAULT}"
    return
  fi
  log "installing openclaw ${OPENCLAW_VERSION}"
  npm install -g "openclaw@${OPENCLAW_VERSION}"
}

clone_or_update_repo() {
  mkdir -p "$(dirname "$WORKDIR")"
  if [ -d "$WORKDIR/.git" ]; then
    log "updating existing repo"
    git -C "$WORKDIR" fetch --all --prune
    git -C "$WORKDIR" checkout main
    git -C "$WORKDIR" pull --ff-only
  else
    log "cloning repo into $WORKDIR"
    git clone git@github.com:JaviKia/openclaw-workspace.git "$WORKDIR"
  fi
}

install_workspace_deps() {
  log "installing workspace dependencies"
  cd "$WORKDIR"
  npm install
  npm run build
}

print_next_steps() {
  cat <<EOF

Bootstrap base listo.

Siguientes pasos manuales IMPORTANTES:
1. Copiar o recrear la configuración real de OpenClaw en este host.
   - Hace falta /data/.openclaw o equivalente funcional con auth/modelos/config.
2. Confirmar binarios y rutas reales:
   - openclaw
   - ffmpeg
   - whisper-cli
   - modelo ggml-base.bin (o mejor)
3. Arrancar la web:
   cd $WORKDIR
   OPENCLAW_WEB_HOST=127.0.0.1 OPENCLAW_WEB_PORT=4173 npm run start:web
4. Abrir túnel desde portátil:
   ssh -N -L 4173:127.0.0.1:4173 <usuario>@<hostinger>
5. Probar:
   curl http://localhost:4173/health

Nota honesta: este script prepara Node/OpenClaw/repo, pero la web no funcionará de verdad hasta que OpenClaw y sus modelos/config estén disponibles en este host.
EOF
}

need_root
install_base_packages
install_node
install_openclaw
clone_or_update_repo
install_workspace_deps
print_next_steps
