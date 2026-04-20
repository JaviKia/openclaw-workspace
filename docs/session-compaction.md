# Session compaction helper

Para no depender de que la compactación manual esté o no expuesta como herramienta de chat, el workspace incluye un wrapper local que llama al gateway RPC `sessions.compact` con el binario bueno de OpenClaw.

## Uso

```bash
cd /data/.openclaw/workspace
node scripts/session-tools/compact-session.mjs agent:main:main
```

Si quieres más margen explícito para sesiones pesadas:

```bash
node scripts/session-tools/compact-session.mjs agent:main:main --timeout-ms 600000
```

Si la compactación completa se queda colgada y quieres degradar a recorte bruto de transcript de forma explícita:

```bash
node scripts/session-tools/compact-session.mjs agent:main:main --timeout-ms 600000 --fallback-max-lines 400
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
- Timeout por defecto: `300000` ms. Se puede cambiar con `--timeout-ms` o `OPENCLAW_COMPACT_TIMEOUT_MS`.
- Si hay gateway remoto o token, respeta `OPENCLAW_GATEWAY_URL` y `OPENCLAW_GATEWAY_TOKEN`.
- Si el CLI agota el timeout pero detecta que se creó un checkpoint nuevo, el helper lo trata como éxito para evitar falsos fallos de cliente.
- Si no hay checkpoint nuevo y pasas `--fallback-max-lines N`, el helper reintenta automáticamente en modo recorte bruto de transcript.
- Para la sesión principal, esto permite forzar compactación manual antes de seguir trabajando cuando el contexto ya se ha disparado, con salida de emergencia si la compacción completa tarda demasiado.
