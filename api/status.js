export default async function handler(req, res) {
    // Si frontend y API están en el mismo dominio, CORS no es necesario.
    // Se mantiene para permitir consultas desde un dominio autorizado.
    const allowedOrigin = process.env.ALLOWED_ORIGIN;

    if (allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Vary', 'Origin');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Cache-Control', 'no-store, max-age=0');

    // Preflight CORS
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // Solo permitimos GET
    if (req.method !== 'GET') {
        return res.status(405).json({
            status: 'api_error',
            error: 'Método no permitido'
        });
    }

    // Puedes definir esta URL como variable de entorno:
    // ATS_STATUS_URL=http://198.199.67.5/status
    const ATS_STATUS_URL =
        process.env.ATS_STATUS_URL || 'http://198.199.67.5/status';

    const timeoutMs = 6000;
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        const atsRes = await fetch(ATS_STATUS_URL, {
            method: 'GET',
            headers: {
                'User-Agent': 'ATSHubProxy/2.0',
                'Accept': 'application/json'
            },
            signal: controller.signal,
            cache: 'no-store'
        });

        // El endpoint ATS respondió, pero con error HTTP.
        if (!atsRes.ok) {
            return res.status(200).json({
                status: 'offline',
                serverRunning: false,
                error: 'Servidor ATS no disponible',
                connectedPlayers: []
            });
        }

        let atsData;

        // Intentamos interpretar la respuesta como JSON.
        try {
            atsData = await atsRes.json();
        } catch {
            return res.status(502).json({
                status: 'api_error',
                serverRunning: false,
                error: 'El servidor ATS devolvió una respuesta no válida',
                connectedPlayers: []
            });
        }

        // Validación básica de la respuesta.
        if (!atsData || typeof atsData !== 'object') {
            return res.status(502).json({
                status: 'api_error',
                serverRunning: false,
                error: 'Respuesta inválida del servidor ATS',
                connectedPlayers: []
            });
        }

        /*
         * Compatibilidad con diferentes nombres de propiedad:
         *
         * connectedPlayers
         * players
         */
        const rawPlayers = Array.isArray(atsData.connectedPlayers)
            ? atsData.connectedPlayers
            : Array.isArray(atsData.players)
                ? atsData.players
                : [];

        /*
         * Normalizamos los jugadores para que el frontend
         * siempre reciba la misma estructura.
         */
        const players = rawPlayers.map((p, idx) => {
            const player = p && typeof p === 'object' ? p : {};

            return {
                client_id:
                    player.client_id ??
                    player.id ??
                    String(idx + 1),

                username:
                    player.username ??
                    player.name ??
                    'Conductor',

                /*
                 * Actualmente el endpoint ATS no proporciona
                 * necesariamente un avatar individual.
                 *
                 * Se utiliza un avatar genérico hasta disponer
                 * de SteamID/avatar real.
                 */
                avatar:
                    'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'
            };
        });

        /*
         * Si el servidor ATS proporciona explícitamente
         * serverRunning, respetamos ese valor.
         *
         * Si no lo proporciona, asumimos que la respuesta
         * válida del endpoint significa que el servidor está
         * disponible.
         */
        const serverRunning =
            typeof atsData.serverRunning === 'boolean'
                ? atsData.serverRunning
                : true;

        const slots =
            atsData.slots ??
            atsData.maxPlayers ??
            32;

        const apiUptime =
            atsData.apiUptime ??
            atsData.uptime ??
            0;

        /*
         * Respuesta normalizada para el frontend.
         */
        return res.status(200).json({
            status: serverRunning ? 'online' : 'offline',

            serverRunning,

            serverName:
                atsData.serverName ??
                '[ES] ECUADOR SERVER +593',

            sessionID:
                atsData.sessionID ??
                atsData.sessionId ??
                'N/D',

            slots,

            game_version:
                atsData.game_version ??
                atsData.version ??
                '1.58.x',

            apiUptime,

            connectedPlayers: players
        });

    } catch (err) {

        const isTimeout = err?.name === 'AbortError';

        /*
         * El mensaje detallado solamente queda en los logs
         * del servidor y no se expone al navegador.
         */
        console.error('[ATS STATUS]', {
            type: isTimeout
                ? 'timeout'
                : 'request_error',

            message: err?.message
        });

        /*
         * 504 = el servidor ATS tardó demasiado.
         * 502 = la API no pudo comunicarse correctamente
         *       con el servidor ATS.
         */
        return res.status(isTimeout ? 504 : 502).json({
            status: 'api_error',

            serverRunning: false,

            error: isTimeout
                ? 'Tiempo de espera agotado al consultar el servidor ATS'
                : 'No se pudo contactar con el servidor ATS',

            connectedPlayers: []
        });

    } finally {

        // Siempre limpiamos el timeout, incluso si fetch() falla.
        clearTimeout(timeoutId);
    }
}
