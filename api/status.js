export default async function handler(req, res) {
    // Configurar cabeceras CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // Timeout de 6 segundos

        const response = await fetch('http://198.199.67.5/status', {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VercelProxy/1.0',
                'Accept': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return res.status(response.status).json({
                error: `El servidor respondió con código HTTP: ${response.status}`,
                online: false
            });
        }

        const textData = await response.text();
        
        try {
            const jsonData = JSON.parse(textData);
            return res.status(200).json(jsonData);
        } catch (jsonError) {
            return res.status(500).json({
                error: 'El servidor respondió pero el formato no es JSON válido.',
                raw: textData.substring(0, 150),
                online: false
            });
        }

    } catch (error) {
        return res.status(500).json({
            error: 'No se pudo establecer conexión con el servidor ATS (198.199.67.5).',
            details: error.message,
            online: false
        });
    }
}
