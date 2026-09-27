// js/chart-manager.js
const chartManager = {
    renderLatencyChart(canvasId, historyData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        
        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);

        if (!historyData || historyData.length < 2) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '12px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Recopilando suficiente historial para graficar...', width / 2, height / 2);
            return;
        }

        const sliceData = historyData.slice(-30);
        const maxLatency = Math.max(...sliceData.map(d => d.latency || 0), 500);

        const padding = 30;
        const graphWidth = width - (padding * 2);
        const graphHeight = height - (padding * 2);

        // Dibujar Ejes Secundarios
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();

        // Trazar Línea de Latencia
        ctx.beginPath();
        sliceData.forEach((point, index) => {
            const x = padding + (index / (sliceData.length - 1)) * graphWidth;
            const y = (height - padding) - ((point.latency || 0) / maxLatency) * graphHeight;

            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Puntos de estado
        sliceData.forEach((point, index) => {
            const x = padding + (index / (sliceData.length - 1)) * graphWidth;
            const y = (height - padding) - ((point.latency || 0) / maxLatency) * graphHeight;

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            if (point.status === 'ONLINE') ctx.fillStyle = '#10b981';
            else if (point.status === 'HIGH_LATENCY') ctx.fillStyle = '#ffda1a';
            else ctx.fillStyle = '#ed1c24';
            ctx.fill();
        });
    }
};
