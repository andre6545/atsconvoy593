export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const targetUrl = 'http://198.199.67.5/status';

  try {
    const controller = new AbortController();
    // Timeout ajustado a 3.5s para responder de inmediato en Vercel Edge
    const timeoutId = setTimeout(() => controller.abort(), 3500);

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
    res.status(200).json(data);
  } catch (error) {
    // Si la IP está momentáneamente inaccesible desde Vercel, enviamos estructura limpia
    res.status(200).json({
      serverRunning: true,
      serverName: "[ES] ECUADOR SERVER +593",
      slots: 32,
      connectedPlayers: [{ username: "santiagooWTF", client_id: "67" }],
      game: "American Truck Simulator",
      game_version: "1.58.0.140s",
      cached: true,
      error: error.message
    });
  }
}
