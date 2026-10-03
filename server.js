const express = require('express');
const path = require('path');

// En Node.js v18+ 'fetch' viene integrado de forma nativa.
// Si estás en Node 16 o anterior, ejecuta: npm install node-fetch@2 y descomenta la siguiente línea:
// const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================================
// CONFIGURACIÓN DE PARÁMETROS Y DISCORD WEBHOOK
// =========================================================================
const TARGET_SERVER_STATUS_URL = 'http://159.89.51.54/status';
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1553640168496300032/owFo2YK9W7Y94qpN4h6hF-Peox2E8QNxhdAAS1XD3B4-YIUGPpLp-DNFnfp5wIUeOj-v'; // 👈 Coloca aquí tu Webhook

const MONITOR_INTERVAL_MS = 30 * 1000; // Monitoreo cada 30 segundos
const REQUEST_TIMEOUT_MS = 5000;        // Timeout de 5s para consultar el servidor ATS

// Control de estado del servidor
let lastServerStatus = null; // null: inicio, true: ONLINE, false: OFFLINE
let isCheckingStatus = false;

// Middleware para servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para configurar encabezados CORS y evitar la caché en las respuestas de API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});

// =========================================================================
// NOTIFICACIONES VÍA DISCORD WEBHOOK
// =========================================================================
/**
 * Envía una alerta formateada a Discord cuando el estado cambia.
 * @param {boolean} isOnline - Estado actual detectado
 * @param {string} reason - Descripción del cambio de estado
 */
async function sendDiscordAlert(isOnline, reason = '') {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes('TU_WEBHOOK_AQUI')) {
    console.warn('[Discord Alert] Webhook no configurado. Omitiendo envío.');
    return;
  }

  const embedColor = isOnline ? 0x39d17f : 0xff6472; // Verde / Rojo Hex en decimal
  const title = isOnline 
    ? '🟢 ECUA SERVER +593 · ¡Servidor Restablecido!' 
    : '🔴 ECUA SERVER +593 · ¡Servidor Caído!';
  
  const description = isOnline 
    ? 'El servidor dedicado de **American Truck Simulator** vuelve a estar activo y respondiendo.' 
    : 'Atención: Se ha detectado que el servidor dedicado dejó de responder a la API.';

  const payload = {
    username: 'ECUA SERVER Monitor',
    avatar_url: 'https://cdn-icons-png.flaticon.com/512/1995/1995515.png',
    embeds: [
      {
        title: title,
        description: description,
        color: embedColor,
        fields: [
          {
            name: '🖥️ Servidor',
            value: '`159.89.51.54`',
            inline: true
          },
          {
            name: '🎮 Juego',
            value: 'American Truck Simulator',
            inline: true
          },
          {
            name: 'ℹ️ Detalle',
            value: reason || (isOnline ? 'Conexión restaurada' : 'Sin respuesta de la API /status'),
            inline: false
          }
        ],
        footer: {
          text: 'Sistema de Alertas Automático · ECUA SERVER +593'
        },
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log(`[Discord Alert] Alerta enviada con éxito (${isOnline ? 'ONLINE' : 'OFFLINE'}).`);
    } else {
      console.error(`[Discord Alert] Error enviando a Discord. Código HTTP: ${res.status}`);
    }
  } catch (error) {
    console.error('[Discord Alert] Excepción al enviar webhook:', error.message);
  }
}

// =========================================================================
// MONITOREO DE ESTADO EN SEGUNDO PLANO
// =========================================================================
/**
 * Realiza la verificación periódica del servidor ATS para enviar alertas.
 */
async function checkServerStatus() {
  if (isCheckingStatus) return;
  isCheckingStatus = true;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(TARGET_SERVER_STATUS_URL, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' }
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const currentStatus = data.serverRunning === true;

      // Si el servidor estaba caído y volvió a levantarse
      if (lastServerStatus === false && currentStatus === true) {
        await sendDiscordAlert(true, `Servidor activo con ${data.connectedPlayers?.length || 0} jugadores conectados.`);
      }

      lastServerStatus = currentStatus;
    } else {
      // Si la API responde con un error HTTP (500, 404, etc.)
      if (lastServerStatus !== false) {
        await sendDiscordAlert(false, `La API del servidor respondió con código HTTP ${response.status}`);
      }
      lastServerStatus = false;
    }
  } catch (err) {
    // Si la solicitud falla por timeout o error de conexión
    if (lastServerStatus !== false) {
      const reason = err.name === 'AbortError' ? 'Tiempo de espera agotado (Timeout > 5s)' : err.message;
      await sendDiscordAlert(false, `Error de conexión: ${reason}`);
    }
    lastServerStatus = false;
  } finally {
    isCheckingStatus = false;
  }
}

// =========================================================================
// RUTA PROXY /api/status (SOLICITUDES DESDE LA WEB HTML)
// =========================================================================
app.get('/api/status', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(TARGET_SERVER_STATUS_URL, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `El servidor remoto respondió con estado HTTP ${response.status}`,
        serverRunning: false
      });
    }

    const data = await response.json();
    
    // Actualizamos el estado interno cuando la web consulta
    lastServerStatus = data.serverRunning === true;

    return res.json(data);
  } catch (error) {
    console.error('[Proxy Error] Excepción al consultar el servidor:', error.message);
    
    // Actualizamos el estado interno a offline
    lastServerStatus = false;

    return res.status(504).json({
      error: 'No se pudo conectar con el servidor ATS remoto.',
      details: error.name === 'AbortError' ? 'Tiempo de espera agotado' : error.message,
      serverRunning: false
    });
  }
});

// Ruta por defecto para SPA o fallback hacia index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================================================================
// INICIALIZACIÓN DEL SERVIDOR
// =========================================================================
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 ECUA SERVER Proxy activo en http://localhost:${PORT}`);
  console.log(`📡 Consultando servidor ATS en: ${TARGET_SERVER_STATUS_URL}`);
  console.log(`🔔 Monitoreo Discord activo cada ${MONITOR_INTERVAL_MS / 1000}s`);
  console.log(`=======================================================`);

  // Iniciar tarea de monitoreo en segundo plano
  checkServerStatus();
  setInterval(checkServerStatus, MONITOR_INTERVAL_MS);
});
