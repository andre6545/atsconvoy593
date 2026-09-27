export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-access-token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const TRUCKY_VTC_ID = "49477";
    const TRUCKY_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJjb21wYW55X2lkIjo0OTQ3N30.kduk-J7AxFB-DJz0HraAe2QXlPKRtQlQVbMzC1o-kZU";

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        // 1. Petición principal e INDEPENDIENTE al servidor ATS
        let atsData = null;
        try {
            const atsRes = await fetch('http://198.199.67.5/status', {
                headers: { 'User-Agent': 'ATSHubProxy/7.0' },
                signal: controller.signal
            });
            if (atsRes.ok) {
                atsData = await atsRes.json();
            }
        } catch (e) {
            console.error("Error consultando servidor ATS:", e);
        }

        clearTimeout(timeoutId);

        // Si el servidor ATS no responde, retornamos offline inmediatamente sin bloquearnos
        if (!atsData) {
            return res.status(200).json({
                serverRunning: false,
                error: 'No se pudo conectar al servidor ATS',
                connectedPlayers: []
            });
        }

        // 2. Consulta opcional a Trucky en segundo plano (no frena la respuesta del servidor)
        let truckyMembers = [];
        try {
            const truckyController = new AbortController();
            const tTimeout = setTimeout(() => truckyController.abort(), 3000);

            const truckyRes = await fetch(`https://e.truckyapp.com/api/v2/vtc/${TRUCKY_VTC_ID}/members`, {
                headers: {
                    'User-Agent': 'ATS-Ecuador-593',
                    'x-access-token': TRUCKY_TOKEN,
                    'Accept': 'application/json'
                },
                signal: truckyController.signal
            });
            clearTimeout(tTimeout);

            if (truckyRes.ok) {
                const tJson = await truckyRes.json();
                truckyMembers = tJson.data || tJson.response || (Array.isArray(tJson) ? tJson : []);
            }
        } catch (e) {
            // Si Trucky falla, continuamos sin interrumpir el estado del servidor
            console.warn("Trucky API fuera de servicio o lento:", e.message);
        }

        // 3. Procesar lista de jugadores reales devueltos por el servidor
        const rawPlayers = atsData.connectedPlayers || atsData.players || [];
        
        const enrichedPlayers = rawPlayers.map((p, idx) => {
            const rawName = p.username || p.name || 'Conductor';
            const cleanName = rawName.trim().toLowerCase();

            // Buscar coincidencia en Trucky
            const match = truckyMembers.find(m => {
                const uName = (m.username || m.steam_username || m.driver_name || m.name || '').trim().toLowerCase();
                return uName && (uName.includes(cleanName) || cleanName.includes(uName));
            });

            const truckName = match?.telemetry?.truck?.name || match?.telemetry?.truck || match?.current_truck || match?.truck || null;
            const cityName = match?.telemetry?.location?.city || match?.telemetry?.city || match?.current_city || match?.city || null;
            const avatarUrl = match?.steam_profile?.avatar || match?.avatar || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';

            return {
                client_id: p.client_id || p.id || `${idx + 1}`,
                username: rawName,
                truck: truckName ? truckName : 'Kenworth T680',
                city: cityName ? cityName : 'Ruta 593 (Ecuador)',
                avatar: avatarUrl
            };
        });

        return res.status(200).json({
            serverRunning: atsData.serverRunning !== undefined ? atsData.serverRunning : true,
            serverName: atsData.serverName || '[ES] ECUADOR SERVER +593',
            sessionID: atsData.sessionID || atsData.sessionId || 'N/D',
            slots: atsData.slots || atsData.maxPlayers || 32,
            game_version: atsData.game_version || atsData.version || '1.50.x',
            apiUptime: atsData.apiUptime || atsData.uptime || 0,
            connectedPlayers: enrichedPlayers
        });

    } catch (err) {
        return res.status(200).json({
            serverRunning: false,
            error: err.message,
            connectedPlayers: []
        });
    }
}
