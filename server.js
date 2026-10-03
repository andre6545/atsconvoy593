// server.js - Proxy de ECUA SERVER +593
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ATS_SERVER_URL = 'http://159.89.51.54/status';

app.use(cors());

// Deshabilitar caché para datos en tiempo real
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Endpoint de API Proxy
app.get('/api/status', async (req, res) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(ATS_SERVER_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ECUA-SERVER-WebProxy/1.0'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`El servidor ATS respondió con estado HTTP ${response.status}`);
    }

    const data = await response.json();
    return res.json(data);

  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';

    return res.status(502).json({
      error: true,
      serverRunning: false,
      message: isTimeout 
        ? 'Tiempo de espera agotado al consultar el servidor ATS.' 
        : `Error de conexión: ${error.message}`
    });
  }
});

// Servir archivos estáticos del sitio web (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Redirección por defecto
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[ECUA SERVER Proxy] Servidor ejecutándose en el puerto ${PORT}`);
});
