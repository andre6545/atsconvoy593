export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const atsRes = await fetch('http://198.199.67.5/status', {
            headers: { 'User-Agent': 'ATSHubProxy/1.0' },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!atsRes.ok) {
            return res.status(200).json({
                serverRunning: false,
                error: 'Servidor ATS no disponible',
                connectedPlayers: []
            });
        }

        const atsData = await atsRes.json();
        const rawPlayers = atsData.connectedPlayers || atsData.players || [];

        const players = rawPlayers.map((p, idx) => ({
            client_id: p.client_id || p.id || `${idx + 1}`,
            username: p.username || p.name || 'Conductor',
            // Captura los segundos de conexión reportados por el servidor ATS
            connect_time: p.connect_time || p.connected_for || p.time_online || p.connectedTime || 0,
            avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'
        }));

        return res.status(200).json({
            serverRunning: atsData.serverRunning !== undefined ? atsData.serverRunning : true,
            serverName: atsData.serverName || '[ES] ECUADOR SERVER +593',
            sessionID: atsData.sessionID || atsData.sessionId || 'N/D',
            slots: atsData.slots || atsData.maxPlayers || 32,
            game_version: atsData.game_version || atsData.version || '1.58.x',
            apiUptime: atsData.apiUptime || atsData.uptime || 0,
            connectedPlayers: players
        });

    } catch (err) {
        return res.status(200).json({
            serverRunning: false,
            error: err.message,
            connectedPlayers: []
        });
    }
}
