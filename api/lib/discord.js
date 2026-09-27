// api/lib/discord.js

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const PUBLIC_STATUS_URL = process.env.PUBLIC_STATUS_URL || '';

/**
 * Envia un mensaje con formato Embed a Discord
 * @param {Object} event Payload del evento
 */
export async function sendDiscordWebhook(event) {
    if (!DISCORD_WEBHOOK_URL) {
        console.log('[DISCORD] Skipping: DISCORD_WEBHOOK_URL not configured');
        return;
    }

    const embed = buildDiscordEmbed(event);
    if (!embed) return;

    const payload = {
        username: "ATS Monitor Bot",
        avatar_url: "https://i.imgur.com/4M34hi2.png", // Icono genérico para el bot
        embeds: [embed]
    };

    // Controller para cancelar la petición si Discord no responde en 3 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[DISCORD_NOTIFICATION_FAILED] Status: ${response.status}`);
        } else {
            console.log(`[DISCORD_NOTIFICATION_SENT] Event: ${event.type}`);
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error('[DISCORD_NOTIFICATION_TIMEOUT] Request to Discord timed out');
        } else {
            console.error('[DISCORD_NOTIFICATION_ERROR] Failed to dispatch webhook');
        }
    }
}

/**
 * Construye el objeto Embed de Discord según el tipo de evento
 */
function buildDiscordEmbed(event) {
    const timestamp = new Date().toISOString();
    const footer = { text: "VTC Control Center • ATS Monitor" };
    
    let embed = {
        timestamp,
        footer
    };

    if (PUBLIC_STATUS_URL) {
        embed.url = PUBLIC_STATUS_URL;
    }

    switch (event.type) {
        case 'ATS_OFFLINE':
            return {
                ...embed,
                title: "🚨 ATS SERVER OFFLINE",
                color: 15158332, // Rojo (#E74C3C)
                description: "El servidor de American Truck Simulator no está respondiendo a las peticiones.",
                fields: [
                    { name: "Estado", value: "Offline", inline: true },
                    { name: "Hora (UTC)", value: new Date().toUTCString(), inline: true },
                    { name: "Detalles", value: event.error || "Sin respuesta / Error de conexión", inline: false }
                ]
            };

        case 'ATS_RECOVERED':
            return {
                ...embed,
                title: "🟢 ATS SERVER RESTORED",
                color: 3066993, // Verde (#2ECC71)
                description: "El servidor de American Truck Simulator vuelve a estar en línea.",
                fields: [
                    { name: "Estado", value: "Operational", inline: true },
                    { name: "Latencia Actual", value: `${event.latency} ms`, inline: true },
                    { name: "Tiempo de Caída", value: event.downtimeFormatted || "N/A", inline: true }
                ]
            };

        case 'ATS_TIMEOUT':
            return {
                ...embed,
                title: "⏱️ ATS SERVER TIMEOUT",
                color: 15105570, // Naranja (#E67E22)
                description: "La consulta al servidor excedió el tiempo límite de espera.",
                fields: [
                    { name: "Estado", value: "Timeout", inline: true },
                    { name: "Hora (UTC)", value: new Date().toUTCString(), inline: true }
                ]
            };

        case 'ATS_HIGH_LATENCY':
            return {
                ...embed,
                title: "🟡 HIGH ATS LATENCY",
                color: 15844367, // Amarillo (#F1C40F)
                description: "La latencia del servidor ha superado el umbral configurado.",
                fields: [
                    { name: "Latencia Detectada", value: `${event.latency} ms`, inline: true },
                    { name: "Umbral Configurado", value: `${event.threshold} ms`, inline: true },
                    { name: "Hora (UTC)", value: new Date().toUTCString(), inline: true }
                ]
            };

        default:
            return null;
    }
}
