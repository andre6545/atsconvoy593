export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-access-token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const TRUCKY_VTC_ID = "49477";
    const TRUCKY_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJjb21wYW55X2lkIjo0OTQ3N30.kduk-J7AxFB-DJz0HraAe2QXlPKRtQlQVbMzC1o-kZU";

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        // 1. Servidor Dedicado ATS (IP Directa)
        const atsPromise = fetch('http://198.199.67.5/status', {
            headers: { 'User-Agent': 'ATS-Ecuador-593' },
            signal: controller.signal
        }).catch(() => null);

        // 2. Consulta a la API Oficial VTC Hub de Trucky (e.truckyapp.com)
        const truckyPromise = fetch(`https://e.truckyapp.com/api/v2/vtc/${TRUCKY_VTC_ID}/members`, {
            headers: {
                'User-Agent': 'ATS-Ecuador-593',
                'x-access-token': TRUCKY_TOKEN,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
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
            truckyMembers = tJson.data || tJson.response || (Array.isArray(tJson) ? tJson : []);
        }

        const rawPlayers = atsData.connectedPlayers || atsData.players || [];
        
        const enrichedPlayers = rawPlayers.map((p, idx) => {
            const rawName = p.username || p.name || '';
            const cleanName = rawName.trim().toLowerCase();

            // Búsqueda del conductor en el arreglo de miembros de Trucky
            const match = truckyMembers.find(m => {
                const uName = (m.username || m.steam_username || m.driver_name || m.name || '').trim().toLowerCase();
                const sName = (m.steam_profile?.steam_username || '').trim().toLowerCase();
                return uName.includes(cleanName) || cleanName.includes(uName) || (sName && (sName.includes(cleanName) || cleanName.includes(sName)));
            });

            // Mapeo exacto de la telemetría según Trucky VTC Hub
            const truckName = match?.telemetry?.truck?.name || match?.telemetry?.truck || match?.current_truck || match?.truck || match?.truck_name || null;
            const cityName = match?.telemetry?.location?.city || match?.telemetry?.navigation?.destination?.city || match?.telemetry?.city || match?.current_city || match?.city || null;
            const avatarUrl = match?.steam_profile?.avatar || match?.avatar || match?.user?.avatar || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';

            return {
                client_id: p.client_id || p.id || `${idx + 1}`,
                username: rawName || 'Conductor',
                truck: truckName ? truckName : 'Kenworth T680',
                city: cityName ? cityName : 'Ruta 593 (Ecuador)',
                avatar: avatarUrl
            };
        });

        return res.status(200).json({
            serverRunning: atsData.serverRunning !== undefined ? atsData.serverRunning : true,
            serverName: atsData.serverName || 'ATS ECUADOR SERVER',
            sessionID: atsData.sessionID || 'N/D',
            slots: atsData.slots || 32,
            game_version: atsData.game_version || '--',
            apiUptime: atsData.apiUptime || 0,
            connectedPlayers: enrichedPlayers
        });

    } catch (err) {
        return res.status(500).json({
            serverRunning: false,
            error: 'Error al procesar la telemetría del servidor',
            details: err.message
        });
    }
}
