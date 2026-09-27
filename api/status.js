// api/status.js
import { evaluateAtsState } from './lib/stateStore.js';
import { sendDiscordWebhook } from './lib/discord.js';

export default async function handler(req, res) {
    const ATS_STATUS_URL = process.env.ATS_STATUS_URL;

    // Guardrail: Verificar si la variable de entorno está configurada
    if (!ATS_STATUS_URL) {
        return res.status(500).json({ 
            serverRunning: false, 
            error: 'Configuración incompleta: ATS_STATUS_URL no definida' 
        });
    }

    const startTime = Date.now();
    let isOnline = false;
    let latency = null;
    let errorMessage = null;

    try {
        // Timeout de 5 segundos para no colgar la Serverless Function si el servidor ATS no responde
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(ATS_STATUS_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        latency = Date.now() - startTime;

        if (response.ok) {
            isOnline = true;
        } else {
            errorMessage = `HTTP Status ${response.status}`;
        }
    } catch (err) {
        latency = Date.now() - startTime;
        errorMessage = err.name === 'AbortError' 
            ? 'Timeout al consultar el servidor ATS' 
            : err.message;
    }

    // 1. Evaluamos el estado para detectar si ocurrió un evento (OFFLINE, RECOVERED, TIMEOUT, HIGH_LATENCY)
    const event = evaluateAtsState(isOnline, latency, errorMessage);
    
    // 2. Si hay un evento válido, lo enviamos a Discord de forma asíncrona (sin 'await' para no demorar la respuesta al frontend)
    if (event) {
        sendDiscordWebhook(event).catch(err => {
            console.error('[DISCORD_ASYNC_ERROR] Error en envío en segundo plano:', err);
        });
    }

    // 3. Respuesta estándar al frontend (mantiene exactamente la misma estructura que tu app espera)
    return res.status(200).json({
        serverRunning: isOnline,
        latency: latency || 0,
        error: errorMessage,
        timestamp: new Date().toISOString()
    });
}
