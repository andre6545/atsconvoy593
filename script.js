async function refreshData() {
    const refreshIcon = document.getElementById('refresh-icon');
    refreshIcon.classList.add('fa-spin');

    const globalDot = document.getElementById('global-dot');
    const globalStatusText = document.getElementById('global-status-text');
    const playersContainer = document.getElementById('players-container');
    const playersCountBadge = document.getElementById('players-count-badge');

    try {
        // Llamada limpia y directa a la API Serverless interna de Vercel (Sin bloqueos CORS)
        const response = await fetch('/api/telemetry');
        if (!response.ok) throw new Error("Fallo en la respuesta del servidor interno.");
        
        const data = await response.json();
        
        let drivers = [];
        if (Array.isArray(data)) {
            drivers = data;
        } else if (data && typeof data === 'object') {
            drivers = data.response || data.drivers || data.members || data.data || [];
        }

        globalDot.className = "w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse";
        globalStatusText.textContent = "ENLACE ACTIVO";
        playersCountBadge.textContent = `${drivers.length} UNIDADES ACTIVAS`;

        if (drivers.length > 0) {
            playersContainer.className = "grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1";
            playersContainer.innerHTML = drivers.map(d => {
                const name = d.name || d.username || d.steamName || 'Operador VTC';
                const truck = d.truck || d.vehicleName || d.truck_name || 'Kenworth W900';
                
                // 1. Velocidad
                const speed = Math.round(d.speed !== undefined ? d.speed : (d.truck_speed !== undefined ? d.truck_speed : 0));
                const isStopped = speed === 0;

                // 2. Número de marcha / cambio
                const gear = d.gear !== undefined ? d.gear : (d.truck_gear !== undefined ? d.truck_gear : 'N');

                // 3. Tiempo en ruta
                const timeInRoute = d.time_in_route || d.routeTime || d.driving_time || d.time || '0h 00m';

                // 4. Distancia del destino / llegada
                const distance = d.distance_to_destination !== undefined ? `${d.distance_to_destination} km` : (d.remaining_distance !== undefined ? `${d.remaining_distance} km` : (d.distance ? `${d.distance} km` : 'N/D'));

                // 5. Nombre de la carga / trabajo
                const cargo = d.cargo || d.job_cargo || d.cargoName || d.job?.cargo || 'Mercancía General';

                // 6. Ubicación aproximada / ciudad
                const location = d.location || d.city || d.current_city || d.currentLocation || 'En tránsito';

                return `
                    <div class="bg-black border border-neutral-800 p-5 space-y-4 hover:border-red-600 transition">
                        <div class="flex items-center justify-between border-b border-neutral-900 pb-3">
                            <div class="flex items-center space-x-3 truncate">
                                <div class="w-8 h-8 bg-neutral-900 border border-red-600 flex items-center justify-center text-red-500 font-bold shrink-0">
                                    <i class="fa-solid fa-user-astronaut text-xs"></i>
                                </div>
                                <div class="truncate">
                                    <h4 class="text-xs font-bold text-white font-oxanium truncate">${name}</h4>
                                    <p class="text-[10px] text-neutral-400 truncate">${truck}</p>
                                </div>
                            </div>
                            <span class="text-[9px] ${isStopped ? 'bg-yellow-600/10 text-yellow-500 border-yellow-600/30' : 'bg-red-600/10 text-red-500 border-red-600/30'} px-2 py-0.5 border uppercase">
                                ${isStopped ? 'DETENIDO ⏸️' : 'EN MARCHA 🟢'}
                            </span>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div class="bg-neutral-950 border border-neutral-900 p-3 flex items-center justify-between">
                                <div>
                                    <div class="flex items-baseline space-x-1">
                                        <span class="text-xl font-bold text-white">${speed}</span>
                                        <span class="text-[9px] text-red-500">KM/H</span>
                                    </div>
                                    <span class="text-[9px] text-neutral-500 uppercase">1. Velocidad</span>
                                </div>
                                <div class="text-right">
                                    <span class="text-lg font-bold text-neutral-200">${gear}</span>
                                    <span class="text-[9px] text-neutral-500 block uppercase">2. Marcha</span>
                                </div>
                            </div>

                            <div class="bg-neutral-950 border border-neutral-900 p-3 flex flex-col justify-center">
                                <span class="text-[9px] uppercase text-red-500">5. Carga / Trabajo</span>
                                <span class="text-xs font-bold text-white truncate mt-1" title="${cargo}">${cargo}</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2 text-xs">
                            <div class="flex justify-between bg-neutral-950 px-3 py-1.5 border border-neutral-900">
                                <span class="text-neutral-500 text-[10px]">3. T. Ruta:</span>
                                <span class="text-neutral-200">${timeInRoute}</span>
                            </div>
                            <div class="flex justify-between bg-neutral-950 px-3 py-1.5 border border-neutral-900">
                                <span class="text-neutral-500 text-[10px]">4. Restante:</span>
                                <span class="text-white">${distance}</span>
                            </div>
                        </div>

                        <div class="bg-neutral-950 border border-neutral-900 p-2.5 flex items-center space-x-3 text-xs">
                            <div class="text-red-500 shrink-0"><i class="fa-solid fa-location-crosshairs"></i></div>
                            <div class="truncate">
                                <span class="text-[9px] uppercase text-neutral-500 block">6. Ubicación / Ciudad Actual</span>
                                <span class="font-semibold text-slate-300 truncate block">${location}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            playersContainer.innerHTML = `
                <div class="col-span-full border border-dashed border-neutral-800 p-12 text-center text-neutral-500 text-xs">
                    <i class="fa-solid fa-satellite text-2xl text-red-600 mb-2"></i>
                    <p>Enlace exitoso con Vercel, pero no hay usuarios conectados transmitiendo telemetría en Trucky ahora mismo.</p>
                </div>`;
        }

    } catch (error) {
        console.error("Error al sincronizar:", error);
        globalDot.className = "w-2.5 h-2.5 bg-red-600 rounded-full animate-ping";
        globalStatusText.textContent = "ERROR DE CONEXIÓN";
        playersContainer.innerHTML = `
            <div class="col-span-full border border-dashed border-red-800 p-12 text-center text-red-400 text-xs">
                <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
                <p>Error al invocar la función serverless de Vercel.</p>
            </div>`;
    } finally {
        refreshIcon.classList.remove('fa-spin');
    }
}

refreshData();
setInterval(refreshData, 5000);
