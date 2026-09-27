export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Credenciales de Trucky VTC Hub del usuario
    const TRUCKY_VTC_ID = "49477";
    const TRUCKY_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJjb21wYW55X2lkIjo0OTQ3N30.kduk-J7AxFB-DJz0HraAe2QXlPKRtQlQVbMzC1o-kZU";

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        // 1. Petición al servidor dedicado ATS (IP Directa)
        const atsPromise = fetch('http://198.199.67.5/status', {
            headers: { 'User-Agent': 'ATSHubProxy/4.0' },
            signal: controller.signal
        }).catch(() => null);

        // 2. Petición autenticada a la API de Trucky VTC Hub
        const truckyPromise = fetch(`https://api.truckyapp.com/v2/vtc/${TRUCKY_VTC_ID}/members`, {
            headers: {
                'User-Agent': 'ATSHubProxy/4.0',
                'Authorization': `Bearer ${TRUCKY_TOKEN}`,
                'Accept': 'application/json'
            },
            signal: controller.signal
        }).catch(() => null);

        const [atsRes, truckyRes] = await Promise.all([atsPromise, truckyPromise]);
        clearTimeout(timeoutId);

        let atsData = { serverRunning: false, connectedPlayers: [] };
        if (atsRes && atsRes.ok) {
            atsData = await atsRes.json();
        }

        let truckyMembers = [];
        if (truckyRes && truckyRes.ok) {
            const tJson = await truckyRes.json();
            truckyMembers = tJson.response || tJson.data || [];
        }

        // 3. Cruzar la lista de jugadores conectados al servidor con la telemetría de Trucky
        const rawPlayers = atsData.connectedPlayers || atsData.players || [];
        const enrichedPlayers = rawPlayers.map((p, idx) => {
            const name = p.username || p.name || 'Conductor';

            // Buscar al jugador en el registro de la VTC de Trucky
            const match = truckyMembers.find(m => 
                (m.username && m.username.toLowerCase() === name.toLowerCase()) ||
                (m.steamName && m.steamName.toLowerCase() === name.toLowerCase()) ||
                (m.driverName && m.driverName.toLowerCase() === name.toLowerCase())
            );

            return {
                client_id: p.client_id || p.id || `${idx + 1}`,
                username: name,
                truck: match?.telemetry?.truck || match?.currentTruck || match?.truck || 'Kenworth T680',
                city: match?.telemetry?.city || match?.currentCity || match?.city || 'En Ruta (Ruta 593)',
                avatar: match?.avatar || match?.steamAvatar || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'
            };
        });

        return res.status(200).json({
            serverRunning: atsData.serverRunning !== undefined ? atsData.serverRunning : true,
            serverName: atsData.serverName || '[ES] ECUADOR SERVER +593',
            sessionID: atsData.sessionID || '85568392936670275',
            slots: atsData.slots || 32,
            game_version: atsData.game_version || '1.58.0.140s',
            apiUptime: atsData.apiUptime || 0,
            connectedPlayers: enrichedPlayers
        });

    } catch (err) {
        return res.status(500).json({
            serverRunning: false,
            error: 'Error al consultar servidores de telemetría',
            details: err.message
        });
    }
}
