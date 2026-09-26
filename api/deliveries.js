// api/deliveries.js

let deliveries = [];

export default async function handler(req, res) {
    // Permitir CORS para consultas desde tu frontend
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'POST') {
        try {
            const body = req.body || {};
            let newDelivery = {};

            // 1. Si es un Embed de Discord / Trucky / Bot
            if (body.embeds && Array.isArray(body.embeds) && body.embeds.length > 0) {
                const embed = body.embeds[0];
                newDelivery = {
                    id: Date.now(),
                    driver: embed.author?.name || embed.title || 'Conductor Desconocido',
                    cargo: 'Carga General',
                    origin: 'Origen N/A',
                    destination: 'Destino N/A',
                    status: 'Completado',
                    description: embed.description || '',
                    timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                };

                // Extraer campos de Discord Fields si existen
                if (embed.fields && Array.isArray(embed.fields)) {
                    embed.fields.forEach(field => {
                        const name = (field.name || '').toLowerCase();
                        const val = field.value || '';
                        if (name.includes('conductor') || name.includes('driver')) newDelivery.driver = val;
                        if (name.includes('carga') || name.includes('cargo')) newDelivery.cargo = val;
                        if (name.includes('origen') || name.includes('from')) newDelivery.origin = val;
                        if (name.includes('destino') || name.includes('to')) newDelivery.destination = val;
                        if (name.includes('estado') || name.includes('status')) newDelivery.status = val;
                    });
                }
            } 
            // 2. Si es un mensaje directo en formato text/content (Prueba sencilla)
            else if (body.content || body.message || typeof body === 'string') {
                const text = body.content || body.message || body;
                newDelivery = {
                    id: Date.now(),
                    driver: 'Sistema / Prueba',
                    cargo: text,
                    origin: 'Webhook',
                    destination: 'Servidor',
                    status: 'Enviado',
                    timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                };
            } 
            // 3. Objeto JSON directo de ATS / VTC Hub
            else {
                newDelivery = {
                    id: Date.now(),
                    driver: body.driver || body.player_name || body.user || 'Conductor',
                    cargo: body.cargo || body.freight || 'Carga Desconocida',
                    origin: body.origin || body.source_city || 'Origen Desconocido',
                    destination: body.destination || body.target_city || 'Destino Desconocido',
                    status: body.status || 'Entregado',
                    timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                };
            }

            // Guardar al inicio de la lista
            deliveries.unshift(newDelivery);

            // Mantener un límite de las últimas 25 entregas
            if (deliveries.length > 25) {
                deliveries = deliveries.slice(0, 25);
            }

            return res.status(200).json({ success: true, message: 'Entrega registrada exitosamente', delivery: newDelivery });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // Consulta GET desde index.html para mostrar la lista
    if (req.method === 'GET') {
        return res.status(200).json({
            success: true,
            deliveries: deliveries
        });
    }

    res.status(455).json({ error: 'Método no soportado' });
}
