// api/status.js
import fetch from 'node-fetch';

// Historial en memoria para seguimiento de estado y tendencia de jugadores
let globalHistory = [];
let lastServerOnlineState = null;

export default async function handler(req, res) {
  // Encabezados CORS
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

  const TARGET_API_URL = 'http://159.89.51.54:3000/api/status';
  const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

  try {
    const response = await fetch(TARGET_API_URL, { timeout: 5000 });
    
    if (!response.ok) {
      throw new Error(`El servidor VPS respondió con estado ${response.status}`);
    }

    const data = await response.json();
    const isOnline = data.serverRunning === true;
    const currentCount = data.playersCount ?? (Array.isArray(data.connectedPlayers) ? data.connectedPlayers.length : 0);

    // Registro de historial para la gráfica en vivo (máximo 15 registros)
    const nowStr = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    globalHistory.push({ time: nowStr, count: currentCount });
    if (globalHistory.length > 15) globalHistory.shift();

    // NOTIFICACIÓN AUTOMÁTICA A DISCORD
    if (DISCORD_WEBHOOK && lastServerOnlineState !== null && lastServerOnlineState !== isOnline) {
      sendDiscordAlert(DISCORD_WEBHOOK, isOnline, data.serverName, currentCount, data.maxPlayers);
    }
    lastServerOnlineState = isOnline;

    // Retorna la data unificada para el frontend
    res.status(200).json({
      ...data,
      history: globalHistory
    });

  } catch (error) {
    console.error('Error proxying request:', error.message);

    // Si falla la conexión con el VPS y cambió el estado, notifica la caída
    if (DISCORD_WEBHOOK && lastServerOnlineState === true) {
      sendDiscordAlert(DISCORD_WEBHOOK, false, 'ECUA SERVER +593', 0, 0);
      lastServerOnlineState = false;
    }

    res.status(500).json({
      serverRunning: false,
      error: true,
      message: error.message,
      serverName: 'ECUA SERVER +593',
      playersCount: 0,
      maxPlayers: 0,
      connectedPlayers: [],
      history: globalHistory
    });
  }
}

// Función auxiliar para enviar alertas de Discord
async function sendDiscordAlert(webhookUrl, isOnline, serverName, playersCount, maxPlayers) {
  try {
    const embed = {
      title: isOnline ? '🟢 ¡Servidor EN LÍNEA!' : '🔴 ¡Servidor FUERA DE LÍNEA!',
      description: isOnline 
        ? `El servidor **${serverName || 'ECUA SERVER +593'}** ya está operativo en American Truck Simulator.`
        : `El servidor **${serverName || 'ECUA SERVER +593'}** no está respondiendo o se ha apagado.`,
      color: isOnline ? 3789183 : 16737394, // Verde / Rojo en formato Decimal
      fields: [
        { name: 'Jugadores', value: `${playersCount} / ${maxPlayers || '—'}`, inline: true },
        { name: 'IP Conexión', value: '`159.89.51.54`', inline: true }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'ECUA SERVER +593 · Bot de Alertas' }
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (err) {
    console.error('Error enviando webhook a Discord:', err.message);
  }
}
