const TRUCKY_API_URL = 'https://e.truckyapp.com/api/v1/vtc/49477/telemetry';
const TRUCKY_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJjb21wYW55X2lkIjo0OTQ3N30.kduk-J7AxFB-DJz0HraAe2QXlPKRtQlQVbMzC1o-kZU';

async function refreshData() {
    const refreshIcon = document.getElementById('refresh-icon');
    refreshIcon.classList.add('fa-spin');

    const globalDot = document.getElementById('global-dot');
    const globalStatusText = document.getElementById('global-status-text');
    const playersListContainer = document.getElementById('players-list-container');
    const playersCountBadge = document.getElementById('players-count-badge');
    const rawJsonView = document.getElementById('raw-json-view');

    try {
        // Usamos un proxy directo para evitar bloqueos del navegador
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(TRUCKY_API_URL)}`;
        
        const response = await fetch(proxyUrl, {
            headers: {
                'x-access-token': TRUCKY_TOKEN,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();
        
        // Mostrar el JSON crudo del endpoint tal cual llega
        rawJsonView.textContent = JSON.stringify(data, null, 2);

        globalDot.className = "w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse";
        globalStatusText.textContent = "CONECTADO";

        // Extraer la lista de usuarios
        let drivers = [];
        if (Array.isArray(data)) {
            drivers = data;
        } else if (data && typeof data === 'object') {
            drivers = data.response || data.drivers || data.members || data.data || [];
        }

        playersCountBadge.textContent = `${drivers.length} USUARIOS`;

        if (drivers.length > 0) {
            playersListContainer.innerHTML = drivers.map(d => {
                const name = d.name || d.username || d.steamName || d.displayName || 'Usuario VTC';
                const steamId = d.steamId || d.steam_id || d.id || '';
                const steamProfileUrl = steamId ? `https://steamcommunity.com/profiles/${steamId}` : `https://steamcommunity.com/search/results/?text=${encodeURIComponent(name)}`;
                const avatar = d.avatar || d.avatarUrl || 'https://via.placeholder.com/40';

                return `
                    <div class="bg-black border border-neutral-800 p-4 flex items-center justify-between hover:border-red-600 transition">
                        <div class="flex items-center space-x-3 truncate">
                            <img src="${avatar}" alt="Avatar" class="w-9 h-9 border border-neutral-700 object-cover shrink-0" onerror="this.src='https://via.placeholder.com/40'">
                            <div class="truncate">
                                <h4 class="text-xs font-bold text-white font-oxanium truncate">${name}</h4>
                                <p class="text-[10px] text-neutral-400 truncate">SteamID: ${steamId || 'No disponible'}</p>
                            </div>
                        </div>
                        <a href="${steamProfileUrl}" target="_blank" class="bg-neutral-900 hover:bg-red-600 text-neutral-300 hover:text-white px-3 py-1.5 text-xs border border-neutral-800 transition flex items-center space-x-1.5 shrink-0">
                            <i class="fa-brands fa-steam"></i>
                            <span>Steam</span>
                        </a>
                    </div>
                `;
            }).join('');
        } else {
            playersListContainer.innerHTML = `
                <div class="col-span-full border border-dashed border-neutral-800 p-8 text-center text-neutral-500 text-xs">
                    <p>La API respondió correctamente, pero el listado de usuarios está vacío en este momento.</p>
                </div>`;
        }

    } catch (error) {
        console.error("Error:", error);
        globalDot.className = "w-2.5 h-2.5 bg-red-600 rounded-full animate-ping";
        globalStatusText.textContent = "ERROR";
        rawJsonView.textContent = `Error al obtener datos: ${error.message}`;
        playersListContainer.innerHTML = `
            <div class="col-span-full border border-dashed border-red-800 p-8 text-center text-red-400 text-xs">
                <p>No se pudo conectar con el endpoint de Trucky. Revisa la consola.</p>
            </div>`;
    } finally {
        refreshIcon.classList.remove('fa-spin');
    }
}

refreshData();
setInterval(refreshData, 10000);
