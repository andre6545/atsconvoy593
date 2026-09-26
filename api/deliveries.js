// Variable global temporal en memoria para almacenar las últimas entregas
let deliveriesHistory = [];

export default async function handler(req, res) {
  // Permitir peticiones desde cualquier origen (CORS)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
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

  // Si se recibe una nueva entrega (Petición POST)
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      
      // Estructurar el objeto de la entrega
      const delivery = {
        id: Date.now(),
        driver: body.driver || body.username || (body.embeds && body.embeds[0]?.author?.name) || 'Conductor Anónimo',
        cargo: body.cargo || body.job || 'Carga General',
        origin: body.origin || body.from || 'Origen N/A',
        destination: body.destination || body.to || 'Destino N/A',
        status: body.status || 'Completada',
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      };

      // Guardar en el historial (máximo 15 registros más recientes)
      deliveriesHistory.unshift(delivery);
      if (deliveriesHistory.length > 15) {
        deliveriesHistory.pop();
      }

      return res.status(200).json({ success: true, message: 'Entrega registrada exitosamente', delivery });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // Si la web consulta el historial de entregas (Petición GET)
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      deliveries: deliveriesHistory
    });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
