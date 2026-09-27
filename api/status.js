// api/status.js - Monitoreo ATS + Historial de Eventos Global Persistente

// Inicialización de la memoria global del servidor si no existe
if (!global.atsMonitorState) {
    global.atsMonitorState = {
        eventHistory: [
            {
                time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
                message: 'Sistema de monitoreo iniciado.',
                type: 'system'
            }
        ],
        previousPlayers: new Set(),
        startTime: Date.now()
    };
}

const MAX_EVENTS = 20;

// Registrar evento en la memoria del servidor
function recordEvent(message, type = 'system') {
    const time = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    global.atsMonitorState.eventHistory.unshift({ time, message, type });
    
    // Mantener límite de eventos
    if (global.atsMonitorState.eventHistory.length > MAX_EVENTS) {
        global.atsMonitorState.eventHistory.pop();
    }
}

export default async function handler(req, res) {
    try {
        // ------------------------------------------------------------------------
        // AQUÍ OBTIENES LOS DATOS REALES DE TU SERVIDOR ATS (LOGS / RCON / CONFIG)
        // ------------------------------------------------------------------------
        const serverRunning = true;
        const serverName = "ATS ECUADOR SERVER (+593)";
        const sessionID = "109775240987123456"; // Sustituir por la lectura real de tu Session ID
        const gameVersion = "1.50.x";
        const slots = 32;

        // Lista de jugadores actualmente en línea
        const connectedPlayers = [
            // { username: "EcuadorTrucker", client_id: "1", avatar: "..." }
        ];

        // ------------------------------------------------------------------------
        // DETECCIÓN AUTOMÁTICA EN TIEMPO REAL (ENTRADAS / SALIDAS)
        // ------------------------------------------------------------------------
        const currentNames = new Set(connectedPlayers.map(p => p.username || 'Conductor'));

        // Registrar quién ingresó
        for (let name of currentNames) {
            if (!global.atsMonitorState.previousPlayers.has(name)) {
                recordEvent(`🚛 <strong>${name}</strong> se ha unido al convoy.`, 'join');
            }
        }

        // Registrar quién se desconectó
        for (let name of global.atsMonitorState.previousPlayers) {
            if (!currentNames.has(name)) {
                recordEvent(`👋 <strong>${name}</strong> se desconectó.`, 'leave');
            }
        }

        // Actualizar el estado previo para la siguiente consulta
        global.atsMonitorState.previousPlayers = currentNames;

        // Calcular tiempo de actividad del backend (Uptime)
        const apiUptime = Math.floor((Date.now() - global.atsMonitorState.startTime) / 1000);

        // Respuesta final que recibe el sitio web
        return res.status(200).json({
            serverRunning,
            serverName,
            sessionID,
            game_version: gameVersion,
            slots,
            connectedPlayers,
            apiUptime,
            events: global.atsMonitorState.eventHistory
        });

    } catch (error) {
        return res.status(500).json({
            serverRunning: false,
            error: "Error al consultar el estado del servidor",
            events: global.atsMonitorState ? global.atsMonitorState.eventHistory : []
        });
    }
}
