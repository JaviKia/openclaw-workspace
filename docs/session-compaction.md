# Session compaction helper

Para no depender de que la compactación manual esté o no expuesta como herramienta de chat, el workspace incluye un wrapper local que llama al gateway RPC `sessions.compact` con el binario bueno de OpenClaw.

## Uso

```bash
cd /data/.openclaw/workspace
node scripts/session-tools/compact-session.mjs agent:main:main
```

Con recorte bruto de transcript en vez de compacción completa:

```bash
node scripts/session-tools/compact-session.mjs agent:main:runtime-openclaw-e2e --max-lines 200
```

## Scripts rápidos

```bash
npm run compact:main
npm run compact:runtime:e2e
npm run compact:web
```

## Notas

- Usa `/data/.npm-global/bin/openclaw` por defecto, no el binario viejo de `/usr/local/bin/openclaw`.
- Si hay gateway remoto o token, respeta `OPENCLAW_GATEWAY_URL` y `OPENCLAW_GATEWAY_TOKEN`.
- Para la sesión principal, esto permite forzar compactación manual antes de seguir trabajando cuando el contexto ya se ha disparado.
