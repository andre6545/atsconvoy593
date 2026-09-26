export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const response = await fetch('http://198.199.67.5/status', {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ATSHubProxy/2.0',
                'Accept': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return res.status(response.status).json({
                online: false,
                error: `Error de servidor HTTP ${response.status}`
            });
        }

        const rawData = await response.text();
        
        try {
            const data = JSON.parse(rawData);
            return res.status(200).json(data);
        } catch (e) {
            return res.status(500).json({
                online: false,
                error: 'La API no devolvió una estructura JSON válida.',
                raw: rawData.substring(0, 100)
            });
        }

    } catch (err) {
        return res.status(500).json({
            online: false,
            error: 'No se pudo conectar con la IP del servidor 198.199.67.5',
            details: err.message
        });
    }
}
