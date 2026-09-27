// js/history-manager.js
const historyManager = {
    STORAGE_KEY: 'ats_monitor_history_v1',
    INCIDENTS_KEY: 'ats_monitor_incidents_v1',
    activeIncident: null,

    getHistory() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
        } catch (e) {
            return [];
        }
    },

    getIncidents() {
        try {
            return JSON.parse(localStorage.getItem(this.INCIDENTS_KEY)) || [];
        } catch (e) {
            return [];
        }
    },

    record(data) {
        const history = this.getHistory();
        const entry = {
            timestamp: new Date().toISOString(),
            status: data.serverRunning ? (data.responseTime > MONITOR_CONFIG.latency.warning ? 'HIGH_LATENCY' : 'ONLINE') : (data.isTimeout ? 'TIMEOUT' : 'OFFLINE'),
            latency: data.responseTime || 0,
            players: Array.isArray(data.connectedPlayers) ? data.connectedPlayers.length : 0,
            httpCode: data.httpCode || (data.serverRunning ? 200 : 500)
        };

        history.push(entry);

        // Limpiar registros antiguos según la retención
        if (history.length > MONITOR_CONFIG.history.maxEntries) {
            history.shift();
        }

        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
        } catch (e) {}

        this.processIncident(entry, data.error);
        return entry;
    },

    processIncident(entry, errorMessage) {
        const incidents = this.getIncidents();

        if (entry.status === 'OFFLINE' || entry.status === 'TIMEOUT') {
            if (!this.activeIncident) {
                this.activeIncident = {
                    id: Date.now(),
                    type: entry.status,
                    startTime: entry.timestamp,
                    endTime: null,
                    duration: null,
                    error: errorMessage || entry.status
                };
                incidents.unshift(this.activeIncident);
                if (entry.status === 'TIMEOUT') alertManager.onTimeout(entry);
                else alertManager.onOffline(entry);
            }
        } else if (entry.status === 'ONLINE' || entry.status === 'HIGH_LATENCY') {
            if (this.activeIncident) {
                const start = new Date(this.activeIncident.startTime).getTime();
                const end = new Date(entry.timestamp).getTime();
                const durationSec = Math.floor((end - start) / 1000);

                const mins = Math.floor(durationSec / 60);
                const secs = durationSec % 60;
                const durationText = mins > 0 ? `${mins} min ${secs} s` : `${secs} s`;

                this.activeIncident.endTime = entry.timestamp;
                this.activeIncident.duration = durationText;

                // Actualizar el último incidente en la lista almacenada
                if (incidents.length > 0) {
                    incidents[0] = this.activeIncident;
                }

                alertManager.onRecovery(durationText);
                this.activeIncident = null;
            }
        }

        try {
            localStorage.setItem(this.INCIDENTS_KEY, JSON.stringify(incidents.slice(0, 50)));
        } catch (e) {}
    },

    getMetrics(hours = 24) {
        const history = this.getHistory();
        const cutoff = Date.now() - (hours * 3600 * 1000);
        const filtered = history.filter(h => new Date(h.timestamp).getTime() >= cutoff);

        if (filtered.length === 0) {
            return { uptimePct: 100, minLat: 0, maxLat: 0, avgLat: 0, totalIncidents: 0 };
        }

        const onlineCount = filtered.filter(h => h.status === 'ONLINE' || h.status === 'HIGH_LATENCY').length;
        const uptimePct = ((onlineCount / filtered.length) * 100).toFixed(2);

        const latencies = filtered.map(h => h.latency).filter(l => l > 0);
        const minLat = latencies.length ? Math.min(...latencies) : 0;
        const maxLat = latencies.length ? Math.max(...latencies) : 0;
        const avgLat = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

        return {
            uptimePct,
            minLat,
            maxLat,
            avgLat,
            totalEntries: filtered.length
        };
    }
};
