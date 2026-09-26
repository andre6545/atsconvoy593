export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const BASE_URL = 'http://198.199.67.5';

    // Función auxiliar para consultar un endpoint con timeout
    async function fetchEndpoint(path) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(`${BASE_URL}${path}`, {
                headers: { 'User-Agent': 'ATSHubProxy/2.0' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    try {
        // Consultar /status, /players, /info o /uptime de forma simultánea
        const [statusData, playersData, infoData, uptimeData] = await Promise.all([
            fetchEndpoint('/status'),
            fetchEndpoint('/players') || fetchEndpoint('/api/players'),
            fetchEndpoint('/info') || fetchEndpoint('/api/info'),
            fetchEndpoint('/uptime')
        ]);

        if (!statusData && !playersData && !infoData) {
            return res.status(500).json({
                online: false,
                error: 'No se pudo conectar con los endpoints de la IP 198.199.67.5'
            });
        }

        // Fusionar todos los datos recibidos
        const rawMerged = {
            ...(infoData || {}),
            ...(statusData || {}),
            ...(uptimeData ? { uptime: uptimeData } : {}),
            players: playersData || (statusData ? statusData.players || statusData.jugadores || statusData.player_list : [])
        };

        // Estandarizar respuesta final
        const formattedData = {
            online: true,
            server_id: rawMerged.id || rawMerged.serverId || rawMerged.server_id || rawMerged.session_id || 'ATS-PUBLIC-US',
            version: rawMerged.version || rawMerged.gameVersion || rawMerged.game_version || '1.53.x',
            max_players: rawMerged.maxPlayers || rawMerged.max_players || rawMerged.slots || 8,
            uptime: rawMerged.uptime || rawMerged.serverUptime || rawMerged.tiempo_activo || null,
            players: Array.isArray(rawMerged.players) ? rawMerged.players : [],
            raw_data: rawMerged // Conservar datos originales para depuración
        };

        return res.status(200).json(formattedData);

    } catch (err) {
        return res.status(500).json({
            online: false,
            error: err.message
        });
    }
}
