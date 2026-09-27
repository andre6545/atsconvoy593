// js/alert-manager.js
const alertManager = {
    lastState: 'UNKNOWN',
    
    onOffline(details) {
        if (this.lastState === 'OFFLINE') return;
        this.lastState = 'OFFLINE';
        this.notify('🔴 ATS OFFLINE', `El servidor dejó de responder. Motivo: ${details.error || 'Desconocido'}`);
    },

    onTimeout(details) {
        if (this.lastState === 'TIMEOUT') return;
        this.lastState = 'TIMEOUT';
        this.notify('⚫ TIMEOUT', `La solicitud al servidor ATS superó el tiempo límite (${MONITOR_CONFIG.timeout}ms).`);
    },

    onRecovery(durationText) {
        if (this.lastState === 'ONLINE') return;
        this.lastState = 'ONLINE';
        this.notify('🟢 ATS RECUPERADO', `El servidor está en línea nuevamente. Duración del incidente: ${durationText}`);
    },

    onHighLatency(latency) {
        this.notify('🟠 LATENCIA ELEVADA', `La latencia actual del servidor es de ${latency}ms.`);
    },

    notify(title, message) {
        console.log(`[ALERT] ${title}: ${message}`);
        if (typeof showToast === 'function') {
            showToast(`${title} - ${message}`);
        }
        // Preparado para integraciones externas futuras (Discord Webhooks, Telegram API, Web Push)
    }
};
