export default async function handler(req, res) {
  // Permitir peticiones desde cualquier origen (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');

  const SERVER_IP = '159.89.51.54';
  const SERVER_PORT = 27015; // Puerto de consulta por defecto de ATS / Steam

  try {
    // Intento de consulta a la API de consulta de servidores Steam/ATS
    const response = await fetch(`https://api.steampowered.com/ISteamApps/GetServersAtAddress/v0001/?addr=${SERVER_IP}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const serverList = data?.response?.servers || [];
    const serverInfo = serverList.find(s => s.addr.includes(SERVER_IP)) || serverList[0];

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
    } else {
      // Si el servidor no responde o no está en el listado de Steam
      return res.status(200).json({
        online: false,
        name: "ECUA SERVER +593",
        players: 0,
        maxPlayers: 0,
        version: "—",
        uptime: Math.floor(process.uptime()),
        ip: SERVER_IP,
        message: "Servidor fuera de línea o no alcanzable"
      });
    }
  } catch (error) {
    // Si la API externa falla, devolvemos un 200 con estado offline en lugar de crashear con HTTP 500
    return res.status(200).json({
      online: false,
      name: "ECUA SERVER +593",
      players: 0,
      maxPlayers: 0,
      version: "—",
      uptime: 0,
      ip: SERVER_IP,
      error: error.message
    });
  }
}
