export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        const response = await fetch('http://198.199.67.5/status', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            signal: AbortSignal.timeout(5000) // Timeout de 5 segundos para que no se quede colgado
        });

        if (!response.ok) {
            return res.status(response.status).json({ 
                error: `El servidor físico respondió con el código HTTP: ${response.status}` 
            });
        }

        const textData = await response.text();
        
        // Intentar convertir a JSON de forma segura
        try {
            const jsonData = JSON.parse(textData);
            return res.status(200).json(jsonData);
        } catch (parseError) {
            return res.status(500).json({ 
                error: 'El servidor respondió, pero no envió un JSON válido.', 
                rawResponse: textData.substring(0, 200) // Muestra los primeros caracteres para ver qué devuelve
            });
        }

    } catch (error) {
        return res.status(500).json({ 
            error: 'Fallo total de red hacia el servidor físico.', 
            details: error.message 
        });
    }
}
