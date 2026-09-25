export default async function handler(req, res) {
  // Cabeceras CORS universales
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
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const apiResponse = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ATS-Dashboard-VercelProxy'
      }
    });

    clearTimeout(timeoutId);

    if (!apiResponse.ok) {
      throw new Error(`El servidor respondió con HTTP ${apiResponse.status}`);
    }

    const data = await apiResponse.json();

    // Devolver los datos exactos recibidos desde la IP 198.199.67.5
    res.status(200).json(data);
  } catch (error) {
    // Si la IP está inalcanzable, devolver estructura limpia en lugar de crash
    res.status(200).json({
      serverRunning: false,
      serverName: "Servidor Fuera de Línea",
      slots: 32,
      connectedPlayers: [],
      error: error.message || "No se pudo conectar con 198.199.67.5"
    });
  }
}