// api/status.js
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const ATS_STATUS_URL = process.env.ATS_STATUS_URL;

export default async function handler(req, res) {
    // Manejo de CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    if (!ATS_STATUS_URL) {
        return res.status(500).json({ 
            serverRunning: false, 
            error: 'Configuración incompleta: ATS_STATUS_URL no definida' 
        });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const startTime = Date.now();

    try {
        const response = await fetch(ATS_STATUS_URL, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'ATS-Monitor-Server/2.0',
                'Accept': 'application/json'
            },
            cache: 'no-store'
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        if (!response.ok) {
            return res.status(502).json({
                serverRunning: false,
                httpCode: response.status,
                responseTime,
                error: `El servidor remoto respondió con estado ${response.status}`
            });
        }

        const data = await response.json();

        // Mantenemos intactos los campos requeridos por el frontend existente
        return res.status(200).json({
            serverRunning: data.serverRunning ?? true,
            serverName: data.serverName || data.name || 'ATS ECUADOR SERVER',
            sessionID: data.sessionID || data.id || 'N/D',
            connectedPlayers: Array.isArray(data.connectedPlayers) ? data.connectedPlayers : (Array.isArray(data.players) ? data.players : []),
            slots: data.slots || data.maxPlayers || 32,
            game_version: data.game_version || data.version || '1.51.x',
            apiUptime: data.apiUptime || data.uptime || 0,
            responseTime: responseTime,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        const isTimeout = err.name === 'AbortError';
        return res.status(504).json({
            serverRunning: false,
            isTimeout,
            responseTime,
            error: isTimeout ? 'Tiempo de espera agotado al conectar con ATS' : 'Error de red o conexión rechazada'
        });
    }
}
