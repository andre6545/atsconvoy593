export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const targetUrl = 'http://198.199.67.5/status';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de margen para tu VPS

    const apiResponse = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ATS-Dashboard-VercelProxy'
      }
    });

    clearTimeout(timeoutId);

    if (!apiResponse.ok) {
      throw new Error(`Servidor remoto respondió con HTTP ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    
    // Normalizar datos de jugadores para asegurar compatibilidad absoluta con cualquier formato de array
    if (!data.connectedPlayers && data.players) {
      data.connectedPlayers = data.players;
    } else if (!data.connectedPlayers) {
      data.connectedPlayers = [];
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(502).json({
      serverRunning: false,
      serverName: "[ES] ECUADOR SERVER +593",
      slots: 32,
      connectedPlayers: [{ username: "santiagooWTF", client_id: "67" }],
      game: "American Truck Simulator",
      game_version: "1.58.0.140s",
      error: error.message
    });
  }
}
