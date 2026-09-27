// api/health.js
export default function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method !== 'GET') {
        return res.status(405).json({ status: 'error', message: 'Method not allowed' });
    }

    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
}
