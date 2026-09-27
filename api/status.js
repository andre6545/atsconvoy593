// api/status.js
import { evaluateAtsState } from './lib/stateStore.js';
import { sendDiscordWebhook } from './lib/discord.js';

export default async function handler(req, res) {
    const ATS_STATUS_URL = process.env.ATS_STATUS_URL;

    if (!ATS_STATUS_URL) {
        return res.status(500).json({ 
            serverRunning: false, 
            error: 'Configuración incompleta: ATS_STATUS_URL no definida' 
        });
    }

    const startTime = Date.now();
    let isOnline = false;
    let latency = 0;
    let errorMessage = null;
    let atsData = {};

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(ATS_STATUS_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        latency = Date.now() - startTime;

        if (response.ok) {
            isOnline = true;
            // Intentamos parsear la respuesta completa que envía el backend/API del servidor ATS
            try {
                atsData = await response.json();
            } catch (jsonErr) {
                // Si la respuesta no era JSON pero respondió OK
                atsData = {};
            }
        } else {
            errorMessage = `HTTP Status ${response.status}`;
        }
    } catch (err) {
        latency = Date.now() - startTime;
        errorMessage = err.name === 'AbortError' 
            ? 'Timeout al consultar el servidor ATS' 
            : err.message;
    }

    // 1. Evaluación del estado para Discord (asíncrono, no bloqueante)
    const event = evaluateAtsState(isOnline, latency, errorMessage);
    if (event) {
        sendDiscordWebhook(event).catch(err => {
            console.error('[DISCORD_ASYNC_ERROR]', err);
        });
    }

    // 2. Unificamos la respuesta: mantenemos las propiedades que lee el frontend
    // combinando los datos originales devueltos por la API de ATS con los del proxy
    const finalResponse = {
        ...atsData, // Reenvía id, players, version, uptime, etc.
        serverRunning: isOnline,
        latency: latency,
        error: errorMessage,
        timestamp: new Date().toISOString()
    };

    return res.status(200).json(finalResponse);
}
