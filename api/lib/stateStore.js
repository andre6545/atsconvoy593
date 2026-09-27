// api/lib/stateStore.js

// Estado persistido en memoria de la instancia serverless
let globalState = {
    isOnline: null,             // null (inicio), true, false
    offlineSince: null,         // Timestamp cuando cayó
    lastHighLatencyAlert: 0     // Timestamp de la última alerta de latencia
};

const HIGH_LATENCY_THRESHOLD = parseInt(process.env.DISCORD_HIGH_LATENCY_MS || '1000', 10);
const ALERT_COOLDOWN_MS = parseInt(process.env.DISCORD_ALERT_COOLDOWN_SECONDS || '300', 10) * 1000;

/**
 * Procesa el estado actual del servidor ATS y determina si debe emitir un evento
 */
export function evaluateAtsState(currentOnlineStatus, latency, errorMessage = null) {
    const now = Date.now();
    let eventToDispatch = null;

    // 1. Detección de Caída (ONLINE -> OFFLINE / TIMEOUT)
    if (!currentOnlineStatus) {
        if (globalState.isOnline === true || globalState.isOnline === null) {
            // Solo notificamos si el estado previo era conocido como ONLINE
            if (globalState.isOnline === true) {
                globalState.offlineSince = now;
                
                const isTimeout = errorMessage && errorMessage.toLowerCase().includes('timeout');
                eventToDispatch = {
                    type: isTimeout ? 'ATS_TIMEOUT' : 'ATS_OFFLINE',
                    error: errorMessage,
                    timestamp: now
                };
            }
            globalState.isOnline = false;
        }
        // Si ya estaba OFFLINE, NO se vuelve a enviar (Anti-Spam)
    } 
    // 2. Detección de Recuperación (OFFLINE -> ONLINE)
    else {
        if (globalState.isOnline === false) {
            const downtimeMs = globalState.offlineSince ? (now - globalState.offlineSince) : 0;
            
            eventToDispatch = {
                type: 'ATS_RECOVERED',
                latency,
                downtimeFormatted: formatDowntime(downtimeMs),
                timestamp: now
            };

            globalState.isOnline = true;
            globalState.offlineSince = null;
        } else if (globalState.isOnline === null) {
            // Primera ejecución y el servidor está ONLINE: No se envía evento de restauración
            globalState.isOnline = true;
        }

        // 3. Detección de Alta Latencia con Cooldown (solo si está ONLINE)
        if (latency && latency > HIGH_LATENCY_THRESHOLD) {
            if (now - globalState.lastHighLatencyAlert > ALERT_COOLDOWN_MS) {
                globalState.lastHighLatencyAlert = now;
                eventToDispatch = {
                    type: 'ATS_HIGH_LATENCY',
                    latency,
                    threshold: HIGH_LATENCY_THRESHOLD,
                    timestamp: now
                };
            }
        }
    }

    return eventToDispatch;
}

/**
 * Formatea milisegundos en texto legible (ej: "4m 18s")
 */
function formatDowntime(ms) {
    if (!ms) return "N/A";
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
}
