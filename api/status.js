export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const TRUCKY_VTC_ID = "49477";
    const TRUCKY_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJjb21wYW55X2lkIjo0OTQ3N30.kduk-J7AxFB-DJz0HraAe2QXlPKRtQlQVbMzC1o-kZU";

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        // 1. Servidor Dedicado ATS
        const atsPromise = fetch('http://198.199.67.5/status', {
            headers: { 'User-Agent': 'ATSHubProxy/5.0' },
            signal: controller.signal
        }).catch(() => null);

        // 2. Telemetría de Miembros en Trucky Hub
        const truckyPromise = fetch(`https://api.truckyapp.com/v2/vtc/${TRUCKY_VTC_ID}/members`, {
            headers: {
                'User-Agent': 'ATSHubProxy/5.0',
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
            truckyMembers = tJson.response || tJson.data || (Array.isArray(tJson) ? tJson : []);
        }

        const rawPlayers = atsData.connectedPlayers || atsData.players || [];
        
        // Mapeo exacto de los datos provenientes de Trucky
        const enrichedPlayers = rawPlayers.map((p, idx) => {
            const name = p.username || p.name || '';

            // Búsqueda del miembro en Trucky por nombre o Steam ID
            const match = truckyMembers.find(m => {
                const mName = m.username || m.steamName || m.driverName || m.name || '';
                return mName.toLowerCase() === name.toLowerCase();
            });

            // Extracción exacta de las propiedades de Trucky Telemetry
            const truckName = match?.telemetry?.truck?.name || match?.telemetry?.truck || match?.currentTruck || match?.truck || null;
            const cityName = match?.telemetry?.navigation?.destination?.city || match?.telemetry?.location?.city || match?.telemetry?.city || match?.currentCity || match?.city || null;
            const avatarUrl = match?.avatar || match?.steamAvatar || match?.user?.avatar || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';

            return {
                client_id: p.client_id || p.id || `${idx + 1}`,
                username: name || 'Conductor',
                truck: truckName ? truckName : 'Sin datos de camión',
                city: cityName ? cityName : 'Sin ubicación GPS',
                avatar: avatarUrl
            };
        });

        return res.status(200).json({
            serverRunning: atsData.serverRunning !== undefined ? atsData.serverRunning : true,
            serverName: atsData.serverName || '[ES] ECUADOR SERVER +593',
            sessionID: atsData.sessionID || 'N/D',
            slots: atsData.slots || 32,
            game_version: atsData.game_version || '--',
            apiUptime: atsData.apiUptime || 0,
            connectedPlayers: enrichedPlayers
        });

    } catch (err) {
        return res.status(500).json({
            serverRunning: false,
            error: 'Error al consultar la telemetría del servidor',
            details: err.message
        });
    }
}
