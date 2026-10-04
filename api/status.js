export default async function handler(req, res) {
  // Configuración de encabezados CORS y Cache
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');

  const SERVER_IP = '159.89.51.54';

  try {
    // Consulta a la API pública de Steam para verificar el servidor ATS
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const response = await fetch(
      `https://api.steampowered.com/ISteamApps/GetServersAtAddress/v0001/?addr=${SERVER_IP}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Steam API HTTP ${response.status}`);
    }

    const data = await response.json();
    const servers = data?.response?.servers || [];
    const serverInfo = servers.find(s => s.addr.includes(SERVER_IP)) || servers[0];

    if (serverInfo) {
      return res.status(200).json({
        online: true,
        name: serverInfo.name || "ECUA SERVER +593",
        players: serverInfo.players || 0,
        maxPlayers: serverInfo.max_players || 0,
        version: serverInfo.version || "1.50.x",
        uptime: Math.floor(process.uptime()),
        ip: SERVER_IP
      });
    }

    // Servidor no encontrado en Steam o sin respuesta directa
    return res.status(200).json({
      online: false,
      name: "ECUA SERVER +593",
      players: 0,
      maxPlayers: 0,
      version: "—",
      uptime: Math.floor(process.uptime()),
      ip: SERVER_IP,
      message: "Servidor fuera de línea"
    });

  } catch (error) {
    // Captura cualquier fallo para EVITAR enviar un HTTP 500 al frontend
    return res.status(200).json({
      online: false,
      name: "ECUA SERVER +593",
      players: 0,
      maxPlayers: 0,
      version: "—",
      uptime: Math.floor(process.uptime()),
      ip: SERVER_IP,
      message: "No se pudo consultar el servidor",
      error: error.message
    });
  }
}
