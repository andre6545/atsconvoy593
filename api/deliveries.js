// Almacén temporal en memoria para las últimas cargas
let recentDeliveries = [];

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 1. Cuando tu bot/plugin de ATS o Discord envía datos
    if (req.method === 'POST') {
        try {
            const body = req.body || {};
            let driver = 'Conductor ECU';
            let cargo = 'Carga Pesada';
            let origin = 'Ecuador';
            let destination = 'Destino';
            let status = 'completed';

            // Detectar embeds de Discord (Trucky / Virtual Trucking Company)
            if (body.embeds && body.embeds.length > 0) {
                const embed = body.embeds[0];
                cargo = embed.title || cargo;
                
                if (embed.fields) {
                    embed.fields.forEach(field => {
                        const name = (field.name || '').toLowerCase();
                        if (name.includes('driver') || name.includes('conductor')) driver = field.value;
                        if (name.includes('cargo') || name.includes('carga')) cargo = field.value;
                        if (name.includes('from') || name.includes('origen')) origin = field.value;
                        if (name.includes('to') || name.includes('destino')) destination = field.value;
                    });
                }
            } else if (body.content) {
                cargo = body.content;
            }

            const newJob = {
                id: Date.now(),
                driver: body.driver || driver,
                cargo: body.cargo || cargo,
                origin: body.origin || origin,
                destination: body.destination || destination,
                status: body.status || status,
                timestamp: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
            };

            // Guardar en la lista (máximo 10 cargas recientes)
            recentDeliveries.unshift(newJob);
            if (recentDeliveries.length > 10) recentDeliveries.pop();

            return res.status(200).json({ success: true, message: 'Carga registrada correctamente' });
        } catch (e) {
            return res.status(400).json({ error: 'Error procesando payload de carga' });
        }
    }

    // 2. Cuando tu página web pide las cargas para mostrarlas en pantalla
    if (req.method === 'GET') {
        return res.status(200).json(recentDeliveries);
    }
}
