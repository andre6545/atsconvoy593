// js/diagnostics.js
const diagnostics = {
    async runFullCheck() {
        const results = {
            frontend: true,
            api: false,
            ats: false,
            httpStatus: 'N/A',
            jsonValid: false,
            latency: 'N/A'
        };

        const startTime = Date.now();
        try {
            const res = await fetch('/api/status', { cache: 'no-store' });
            results.latency = `${Date.now() - startTime} ms`;
            results.httpStatus = res.status;

            if (res.ok) {
                results.api = true;
                const data = await res.json();
                results.jsonValid = true;
                if (data.serverRunning) {
                    results.ats = true;
                }
            }
        } catch (e) {
            results.httpStatus = 'Error de Red';
        }

        return results;
    }
};
