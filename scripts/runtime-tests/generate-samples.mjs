import { mkdir } from 'node:fs/promises';
import { MicrosoftTtsProvider } from '/data/.openclaw/workspace/dist/tts-runtime/src/index.js';

const outDir = '/data/.openclaw/workspace/fixtures/runtime-audio';
const voice = process.env.OPENCLAW_RUNTIME_TTS_VOICE ?? 'en-US-BrianMultilingualNeural';

const samples = [
  {
    id: 3,
    text: 'Hola Javi. Soy Kelex Kia. Hoy es 19 de abril de 2026. El ticket 4271 tiene prioridad 3. Después de esta pausa, quiero confirmar que el runtime sigue entendiendo nombres propios, números y cambios de ritmo.'
  },
  {
    id: 4,
    text: 'Hola Javi. Soy Kelex Kia. El ticket cuatro mil doscientos setenta y uno sigue abierto. La prioridad es tres. Quiero confirmar que esta frase completa entra bien de principio a fin.'
  },
  {
    id: 5,
    text: 'Hola Javi. Kelex Kia está probando OpenClaw con runtime TTS. Necesito validar nombres propios, siglas y una frase estable sin cortes al final.'
  },
  {
    id: 6,
    text: 'Hola Javi. Esta prueba incluye una pausa breve, una segunda idea y un cierre claro. Si todo va bien, el transcript debería mantener el sentido completo y también la última frase.'
  },
  {
    id: 7,
    text: 'Hola Javi. La reunión es el martes 23 a las 19 y 45. El servidor principal responde por el puerto 18789. Quiero ver si fechas, horas y números técnicos salen limpios.'
  },
  {
    id: 8,
    text: 'Hola Javi. OpenClaw, Whisper y runtime TTS tienen que convivir bien. Esta muestra mezcla producto, herramienta y una frase final corta para comprobar estabilidad.'
  },
  {
    id: 9,
    text: 'Hola Javi. Si intercalo comas, una pausa media y luego otra idea, el sistema no debería perder el hilo. También quiero verificar que la última palabra llegue entera.'
  },
  {
    id: 10,
    text: 'Hola Javi. Soy Kelex Kia y esta es la muestra diez. Quiero validar nombres propios, números, siglas, ritmo y cierre de frase en una sola pasada. Si esto sale limpio, la base del runtime ya será bastante decente.'
  }
];

async function main() {
  await mkdir(outDir, { recursive: true });
  const provider = new MicrosoftTtsProvider({ bus: { publish: async () => {} }, voice });

  for (const sample of samples) {
    const outFile = `${outDir}/sample-${sample.id}-es.mp3`;
    await provider.synthesizeToFile(sample.text, outFile);
    console.log(outFile);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
