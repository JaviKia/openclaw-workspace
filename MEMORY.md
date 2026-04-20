# MEMORY.md

## Preferencias duraderas

### Comunicación
- Tono preferido: cercano, directo, útil y con humor neutro
- Nivel de cercanía en DM: natural y cercano, sin servilismo
- Formato de updates: progreso visible cuando algo tarda
- Estilo a evitar: respuestas infladas, tono corporativo, entusiasmo fingido
- Zona horaria: Madrid/España

### Forma de trabajar
- Preferencia de ejecución: bastante autonomía, pero con criterio y visibilidad
- Nivel de detalle: alto cuando el tema lo merece, sin explicaciones básicas innecesarias
- Cuándo confirmar: antes de acciones sensibles, externas o destructivas
- Formato de entrega preferido: directo, práctico y accionable
- Idioma por defecto: castellano, tanto escrito como hablado
- Cambio de idioma: solo cambiar a inglés cuando Javi diga "switch to English"; volver a español cuando diga "volvemos a castellano"
- En cada ejecución, comprobar el nivel de contexto actual. Si está por encima de ~50%, compactar antes de seguir trabajando, para reducir coste y consolidar memoria y cambios útiles.
- Para esa compactación manual, usar el helper local `scripts/session-tools/compact-session.mjs` o los atajos `npm run compact:main`, `compact:runtime:e2e`, `compact:web`.

## Contexto duradero de Javi

- Nombre: Javier Martinez
- Llamarle: Javi
- Pronombres: él / he
- Perfil general: usuario final con nivel técnico alto, experto en IT
- Perfil operativo: arquitecto enterprise/cloud muy senior, con foco fuerte en seguridad, identidad, gobierno, plataformas y automatización
- Puede moverse bien entre estrategia y ejecución técnica
- Áreas de interés o foco: cloud, seguridad, IAM, plataformas, automatización, IA generativa y agentes
- Estilo de trabajo habitual: iterativo, práctico y técnico
- Le gustan los cómics

## Prioridades activas

- Consolidar un entorno OpenClaw estable, limpio y bien versionado
- Mantener Telegram como canal principal operativo
- Mantener la voz local funcionando de forma fiable
- Retomar otro día el trabajo de Discord para lograr una conversación más fluida en esa integración
- Seguir afinando identidad, memoria y configuración base de Kelex Kia

## Kelex Kia

- El asistente se llama **Kelex Kia**
- El nombre está inspirado en la inteligencia artificial del universo de Superman
- Identidad base: inteligencia artificial de fortaleza
- Avatar oficial: `avatars/kelex-avatar.jpg`

## Patrones de contenido

- Respuestas que más valora Javi: directas, útiles, concretas
- Incluir normalmente: estado real, progreso, siguiente paso claro cuando haga falta
- Evitar normalmente: relleno, obviedades largas, tono demasiado básico
- Regla resumen vs profundidad: resumir por defecto, profundizar cuando el tema lo pida o Javi lo pida

## Lecciones operativas duraderas

- Si algo importa entre sesiones, debe quedar escrito en archivos
- Para cambios persistentes del workspace, conviene commit en git
- El workspace está respaldado en GitHub y permite recuperación rápida tras resets del entorno
- Tras un reset, conviene verificar enseguida pairing de Telegram, auth del agente y la config de seguridad local
- Ruta útil de recuperación tras resets: `/data/.openclaw.broken-1776526345/` puede contener copia rescatable de config y modelos, por ejemplo Whisper en `/data/.openclaw.broken-1776526345/models/whisper/ggml-base.bin`
- El canal principal con Javi es Telegram
- Si Javi envía un mensaje de voz, responder también por voz y en el mismo idioma del mensaje
- La cadena de voz quedó operativa: Whisper local + respuesta TTS por voz en Telegram
- Voz TTS preferida actual: `en-US-BrianMultilingualNeural`, válida por ahora para castellano e inglés
- La UI de OpenClaw se mantiene local por ahora
- El `.env` canónico del entorno vive en `/data/.openclaw/.env`
