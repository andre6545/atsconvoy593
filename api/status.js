// api/status.js

export default async function handler(req, res) {
    const ATS_STATUS_URL = process.env.ATS_STATUS_URL;

    if (!ATS_STATUS_URL) {
        return res.status(500).json({ 
            serverRunning: false, 
            error: 'Configuración incompleta: ATS_STATUS_URL no definida' 
        });
    }

    const startTime = Date.now();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(ATS_STATUS_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'ATS-Monitor-Proxy/1.0'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;

        if (response.ok) {
            const rawResponseBody = await response.text();
            let parsedData = {};

            try {
                parsedData = JSON.parse(rawResponseBody);
            } catch (e) {
                parsedData = {};
            }

            if (typeof parsedData === 'object' && parsedData !== null && !Array.isArray(parsedData)) {
                return res.status(200).json({
                    ...parsedData,
                    serverRunning: parsedData.serverRunning ?? true,
                    online: parsedData.online ?? true,
                    latency: latency
                });
            }

            res.setHeader('Content-Type', 'application/json');
            return res.status(200).send(rawResponseBody);
        } else {
            return res.status(200).json({
                serverRunning: false,
                online: false,
                latency: latency,
                error: `HTTP Status ${response.status}`
            });
        }
    } catch (err) {
        const latency = Date.now() - startTime;
        const errorMessage = err.name === 'AbortError' 
            ? 'Timeout al consultar el servidor ATS' 
            : err.message;

        return res.status(200).json({
            serverRunning: false,
            online: false,
            latency: latency,
            error: errorMessage
        });
    }
}
