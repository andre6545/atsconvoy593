// js/monitor-config.js
const MONITOR_CONFIG = {
    refreshInterval: 10000, // 10 segundos por defecto
    timeout: 8000,
    latency: {
        normal: 300,
        warning: 1000
    },
    history: {
        enabled: true,
        maxEntries: 1000,
        retentionDays: 30
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MONITOR_CONFIG;
}
