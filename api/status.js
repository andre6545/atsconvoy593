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

        // 1. Servidor Dedicado ATS (IP Directa)
        const atsPromise = fetch('http://198.199.67.5/status', {
            headers: { 'User-Agent': 'ATSHubProxy/6.0' },
            signal: controller.signal
        }).catch(() => null);

        // 2. Consulta de Miembros en Línea con Telemetría Activa en Trucky Hub
        const truckyOnlinePromise = fetch(`https://api.truckyapp.com/v2/vtc/${TRUCKY_VTC_ID}/members/online`, {
            headers: {
                'User-Agent': 'ATSHubProxy/6.0',
                'Authorization': `Bearer ${TRUCKY_TOKEN}`,
                'Accept': 'application/json'
            },
            signal: controller.signal
        }).catch(() => null);

        // 3. Consulta de lista completa de miembros como respaldo de avatar
        const truckyMembersPromise = fetch(`https://api.truckyapp.com/v2/vtc/${TRUCKY_VTC_ID}/members`, {
            headers: {
                'User-Agent': 'ATSHubProxy/6.0',
                'Authorization': `Bearer ${TRUCKY_TOKEN}`,
                'Accept': 'application/json'
            },
            signal: controller.signal
        }).catch(() => null);

        const [atsRes, truckyOnlineRes, truckyMembersRes] = await Promise.all([
            atsPromise, 
            truckyOnlinePromise, 
            truckyMembersPromise
        ]);
        clearTimeout(timeoutId);

        let atsData = { serverRunning: false, connectedPlayers: [] };
        if (atsRes && atsRes.ok) {
            atsData = await atsRes.json();
        }

        let onlineData = [];
        if (truckyOnlineRes && truckyOnlineRes.ok) {
            const jsonOnline = await truckyOnlineRes.json();
            onlineData = jsonOnline.response || jsonOnline.data || (Array.isArray(jsonOnline) ? jsonOnline : []);
        }

        let allMembersData = [];
        if (truckyMembersRes && truckyMembersRes.ok) {
            const jsonMembers = await truckyMembersRes.json();
            allMembersData = jsonMembers.response || jsonMembers.data || (Array.isArray(jsonMembers) ? jsonMembers : []);
        }

        const rawPlayers = atsData.connectedPlayers || atsData.players || [];
        
        const enrichedPlayers = rawPlayers.map((p, idx) => {
            const name = (p.username || p.name || '').trim();
            const lowerName = name.toLowerCase();

            // Buscar en la lista de usuarios con telemetría activa
            let matchOnline = onlineData.find(m => {
                const u = (m.username || m.steamName || m.driverName || m.name || '').toLowerCase();
                return u.includes(lowerName) || lowerName.includes(u);
            });

            // Buscar en la lista general para extraer perfil de avatar
            let matchMember = allMembersData.find(m => {
                const u = (m.username || m.steamName || m.driverName || m.name || '').toLowerCase();
                return u.includes(lowerName) || lowerName.includes(u);
            });

            // Extracción exacta de Trucky
            const truckName = matchOnline?.telemetry?.truck?.name || 
                              matchOnline?.telemetry?.truck || 
                              matchOnline?.currentTruck || 
                              matchOnline?.truck || 
                              matchMember?.telemetry?.truck || 
                              matchMember?.currentTruck || null;

            const cityName = matchOnline?.telemetry?.navigation?.destination?.city || 
                             matchOnline?.telemetry?.location?.city || 
                             matchOnline?.telemetry?.city || 
                             matchOnline?.currentCity || 
                             matchOnline?.city || 
                             matchMember?.currentCity || null;

            const avatarUrl = matchOnline?.avatar || 
                              matchMember?.avatar || 
                              matchMember?.steamAvatar || 
                              matchMember?.user?.avatar || 
                              'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';

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
            error: 'Error al consultar la telemetría del servidor',
            details: err.message
        });
    }
}
