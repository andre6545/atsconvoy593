const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================================
// CONFIGURACIÓN DE PARÁMETROS Y DISCORD WEBHOOK
// =========================================================================
const TARGET_SERVER_STATUS_URL = 'http://159.89.51.54/status';
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1553640168496300032/owFo2YK9W7Y94qpN4h6hF-Peox2E8QNxhdAAS1XD3B4-YIUGPpLp-DNFnfp5wIUeOj-v'; // 👈 Reemplazar con URL real

const MONITOR_INTERVAL_MS = 30 * 1000; // Monitoreo en segundo plano cada 30s
const REQUEST_TIMEOUT_MS = 5000;        // Timeout de 5s
const CACHE_TTL_MS = 8 * 1000;           // Caché de 8s para proteger el servidor de destino
const MAX_FAILED_ATTEMPTS = 2;          // Debe fallar 2 veces seguidas para notificar caída (Anti-Spam)

// Estados globales y caché en memoria
let lastServerStatus = null; // true: ONLINE, false: OFFLINE
let consecutiveFailures = 0;
let isCheckingStatus = false;

let cachedData = null;
let lastCacheTime = 0;

// Historial en servidor (Últimas 20 lecturas)
const playerHistory = [];
const MAX_HISTORY_POINTS = 20;

// Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

// =========================================================================
// ENVÍO DE NOTIFICACIONES A DISCORD
// =========================================================================
async function sendDiscordAlert(isOnline, reason = '') {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes('TU_WEBHOOK_AQUI')) return;

  const embedColor = isOnline ? 0x39d17f : 0xff6472;
  const title = isOnline 
    ? '🟢 ECUA SERVER +593 · ¡Servidor Restablecido!' 
    : '🔴 ECUA SERVER +593 · ¡Servidor Caído!';
  
  const description = isOnline 
    ? 'El servidor dedicado de **American Truck Simulator** vuelve a estar activo.' 
    : 'Atención: Se ha confirmado la falta de respuesta del servidor tras varias comprobaciones.';

  const payload = {
    username: 'ECUA SERVER Monitor',
    avatar_url: 'https://cdn-icons-png.flaticon.com/512/1995/1995515.png',
    embeds: [
      {
        title: title,
        description: description,
        color: embedColor,
        fields: [
          { name: '🖥️ Servidor', value: '`159.89.51.54`', inline: true },
          { name: '🎮 Juego', value: 'American Truck Simulator', inline: true },
          { name: 'ℹ️ Detalle', value: reason || (isOnline ? 'Conexión restaurada' : 'Sin respuesta'), inline: false }
        ],
        footer: { text: 'Sistema de Alertas Automático · ECUA SERVER +593' },
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`[Discord Alert] Notificación enviada: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
  } catch (error) {
    console.error('[Discord Alert] Error enviando webhook:', error.message);
  }
}

// =========================================================================
// MONITOREO MANTENIDO EN SEGUNDO PLANO Y CACHÉ
// =========================================================================
async function fetchRemoteStatus() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(TARGET_SERVER_STATUS_URL, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' }
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    
    const data = await response.json();
    
    // Adjuntar el historial global servido directamente desde la memoria
    const playerCount = Array.isArray(data.connectedPlayers) ? data.connectedPlayers.length : 0;
    recordHistoryPoint(playerCount);
    
    data.serverHistory = playerHistory;
    return { success: true, data };
  } catch (err) {
    clearTimeout(timeout);
    const isTimeout = err.name === 'AbortError';
    return { 
      success: false, 
      error: isTimeout ? 'Tiempo de espera agotado (>5s)' : err.message 
    };
  }
}

function recordHistoryPoint(count) {
  const time = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  
  // Evitar duplicados seguidos exactos en el mismo minuto
  if (playerHistory.length > 0 && playerHistory[playerHistory.length - 1].time === time) {
    playerHistory[playerHistory.length - 1].count = count;
    return;
  }

  if (playerHistory.length >= MAX_HISTORY_POINTS) playerHistory.shift();
  playerHistory.push({ time, count });
}

async function checkServerStatus() {
  if (isCheckingStatus) return;
  isCheckingStatus = true;

  const result = await fetchRemoteStatus();

  if (result.success) {
    consecutiveFailures = 0;
    cachedData = result.data;
    lastCacheTime = Date.now();

    const currentStatus = result.data.serverRunning === true;

    // Notificar recuperación si antes estaba caído
    if (lastServerStatus === false && currentStatus === true) {
      await sendDiscordAlert(true, `Servidor activo con ${result.data.connectedPlayers?.length || 0} jugadores.`);
    }
    lastServerStatus = currentStatus;
  } else {
    consecutiveFailures++;
    console.warn(`[Monitor] Fallo de conexión (${consecutiveFailures}/${MAX_FAILED_ATTEMPTS}): ${result.error}`);

    // Solo notificar a Discord si se supera el umbral de fallos consecutivos
    if (consecutiveFailures >= MAX_FAILED_ATTEMPTS && lastServerStatus !== false) {
      lastServerStatus = false;
      await sendDiscordAlert(false, `Causa: ${result.error}`);
    }
  }

  isCheckingStatus = false;
}

// =========================================================================
// RUTAS DE LA API
// =========================================================================
app.get('/api/status', async (req, res) => {
  const now = Date.now();

  // Entregar desde caché si el dato es reciente (menor a 8 segundos)
  if (cachedData && (now - lastCacheTime) < CACHE_TTL_MS) {
    return res.json({ ...cachedData, cached: true });
  }

  const result = await fetchRemoteStatus();

  if (result.success) {
    cachedData = result.data;
    lastCacheTime = now;
    consecutiveFailures = 0;
    lastServerStatus = result.data.serverRunning === true;
    return res.json({ ...result.data, cached: false });
  } else {
    return res.status(504).json({
      error: 'No se pudo conectar con el servidor ATS remoto.',
      details: result.error,
      serverRunning: false,
      serverHistory: playerHistory
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================================================================
// INICIO DEL SERVIDOR
// =========================================================================
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 ECUA SERVER Proxy activo en http://localhost:${PORT}`);
  console.log(`📡 Monitoreando ATS y alimentando caché cada ${MONITOR_INTERVAL_MS / 1000}s`);
  console.log(`=======================================================`);

  checkServerStatus();
  setInterval(checkServerStatus, MONITOR_INTERVAL_MS);
});
