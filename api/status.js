export default function handler(req, res) {
  // Configuración de encabezados CORS y Cache
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');

  // Respuesta de estado directa del servidor
  return res.status(200).json({
    online: true,
    name: "ECUA SERVER +593",
    ip: "159.89.51.54",
    players: 0,
    maxPlayers: 128,
    version: "1.50.x",
    uptime: Math.floor(process.uptime()),
    logLines: "OK"
  });
}
