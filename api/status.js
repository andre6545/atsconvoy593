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
    let rawResponseBody = null;
    let parsedData = {};

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        // Hacemos la petición con Headers estándar de lectura JSON
        const response = await fetch(ATS_STATUS_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'ATS-Monitor-Proxy/1.0'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        latency = Date.now() - startTime;

        if (response.ok) {
            isOnline = true;
            // Guardamos el texto crudo para asegurar que no se pierda nada al parsear
            rawResponseBody = await response.text();
            
            try {
                parsedData = JSON.parse(rawResponseBody);
            } catch (e) {
                parsedData = {};
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

    // 1. Evaluación para Discord (ejecución asíncrona)
    const event = evaluateAtsState(isOnline, latency, errorMessage);
    if (event) {
        sendDiscordWebhook(event).catch(err => {
            console.error('[DISCORD_ASYNC_ERROR]', err);
        });
    }

    // 2. Si recibimos un JSON estructurado desde el servidor ATS
    if (isOnline && rawResponseBody) {
        // En caso de que la respuesta del ATS sea un objeto JSON
        if (typeof parsedData === 'object' && parsedData !== null && !Array.isArray(parsedData)) {
            return res.status(200).json({
                ...parsedData,
                // Inyectamos latencia y estado solo si el origen no los incluye o para garantizar fallback
                serverRunning: parsedData.serverRunning ?? isOnline,
                online: parsedData.online ?? isOnline,
                latency: latency,
                error: null
            });
        }

        // Si el origen devuelve texto o formato crudo
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(rawResponseBody);
    }

    // 3. Respuesta en caso de servidor offline o error
    return res.status(200).json({
        serverRunning: false,
        online: false,
        latency: latency || 0,
        error: errorMessage || 'Servidor no disponible',
        timestamp: new Date().toISOString()
    });
}
