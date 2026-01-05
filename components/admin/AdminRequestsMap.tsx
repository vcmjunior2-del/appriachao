
import React, { useEffect, useRef, useState } from 'react';
import { RequestItem } from '../../types';

// Types extension for Ghosts
interface RequestItemWithMeta extends RequestItem {
    isGhost?: boolean;
    isFading?: boolean;
}

interface AdminRequestsMapProps {
    requests: RequestItem[];
    ghostRequests: RequestItemWithMeta[]; // Receive ghosts from parent
    onSelectRequest: (req: RequestItem) => void;
    isVisible?: boolean;
    flyToTarget?: { lat: number; lng: number; timestamp: number } | null;
}

const AdminRequestsMap: React.FC<AdminRequestsMapProps> = ({ requests, ghostRequests, onSelectRequest, isVisible, flyToTarget }) => {
    const mapRef = useRef<any>(null);
    const resetViewTimeoutRef = useRef<any>(null); // Ref to hold the return timeout
    const [mapStatusFilter, setMapStatusFilter] = useState('Todos');
    const [isExpanded, setIsExpanded] = useState(false);

    const DEFAULT_CENTER = [-11.8070, -39.3890]; 
    const DEFAULT_ZOOM = 15;

    const isUrl = (str?: string) => str ? (str.includes('http') || str.includes('data:')) : false;

    const getMapPinColor = (status: string) => {
        switch (status) {
            case 'Aberto': return { bg: '#3b82f6' }; 
            case 'Em Análise': return { bg: '#f59e0b' }; 
            case 'Agendado': return { bg: '#a855f7' }; 
            case 'Concluído': return { bg: '#22c55e' }; 
            case 'Rejeitado': return { bg: '#ef4444' }; 
            default: return { bg: '#64748b' };
        }
    };

    // --- Initialize Map ---
    useEffect(() => {
        if (!window.L) return;

        if (!mapRef.current) {
            const map = window.L.map('general-map-container', { zoomControl: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
            
            // CHANGED TO OPENSTREETMAP STANDARD
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap'
            }).addTo(map);
            
            mapRef.current = map;
        } else {
            mapRef.current.invalidateSize();
        }

        // Cleanup on unmount
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            if (resetViewTimeoutRef.current) {
                clearTimeout(resetViewTimeoutRef.current);
            }
        };
    }, []); // Run once on mount

    // --- Handle Resize ---
    useEffect(() => {
        if (mapRef.current) {
            setTimeout(() => {
                mapRef.current.invalidateSize();
            }, 300);
        }
    }, [isExpanded, isVisible]);

    // --- Handle FlyTo Animation with Auto Return ---
    useEffect(() => {
        if (mapRef.current && flyToTarget) {
            // Cancel any pending return animation if a new one comes in
            if (resetViewTimeoutRef.current) {
                clearTimeout(resetViewTimeoutRef.current);
            }

            console.log("Flying to target:", flyToTarget);
            
            // 1. Fly to the specific location
            mapRef.current.flyTo([flyToTarget.lat, flyToTarget.lng], 18, {
                animate: true,
                duration: 2 // seconds
            });

            // 2. Schedule return to default view
            resetViewTimeoutRef.current = setTimeout(() => {
                if (mapRef.current) {
                    mapRef.current.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, {
                        animate: true,
                        duration: 2
                    });
                }
            }, 6000); // Wait 6 seconds (2s travel + 4s viewing) before returning
        }
    }, [flyToTarget]);

    // --- Update Markers ---
    useEffect(() => {
        if (!mapRef.current || !window.L) return;
        const map = mapRef.current;

        // Clear existing markers
        map.eachLayer((layer: any) => {
            if (layer instanceof window.L.Marker) {
                map.removeLayer(layer);
            }
        });

        // Merge real and ghost requests
        const itemsToRender = [...requests, ...ghostRequests];

        itemsToRender.forEach(req => {
            if (req.location) {
                if (mapStatusFilter !== 'Todos' && req.status !== mapStatusFilter && !req.isGhost) return;
                
                const colors = getMapPinColor(req.status);
                const iconIsImg = isUrl(req.icon);
                const animationClass = req.isFading ? 'marker-fade-out' : '';

                const iconHtml = `
                <div class="${animationClass}" style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
                    <div style="
                        background-color: ${iconIsImg ? '#ffffff' : colors.bg};
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        border: ${iconIsImg ? `4px solid ${colors.bg}` : '2px solid #ffffff'};
                        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: ${iconIsImg ? colors.bg : '#ffffff'};
                        z-index: 2;
                        overflow: hidden;
                    ">
                        ${iconIsImg 
                            ? `<img src="${req.icon}" style="width: 70%; height: 70%; object-fit: contain;" />`
                            : `<span class="material-symbols-outlined" style="font-size: 20px; color: #ffffff; font-variation-settings: 'FILL' 1;">${req.icon || 'location_on'}</span>`
                        }
                    </div>
                    <div style="
                        position: absolute;
                        bottom: 0px;
                        width: 0; 
                        height: 0; 
                        border-left: 6px solid transparent;
                        border-right: 6px solid transparent;
                        border-top: 8px solid ${colors.bg};
                        z-index: 1;
                    "></div>
                </div>`;

                const icon = window.L.divIcon({
                    className: 'custom-map-pin',
                    html: iconHtml,
                    iconSize: [48, 48],
                    iconAnchor: [24, 48],
                    popupAnchor: [0, -48]
                });

                const marker = window.L.marker([req.location.lat, req.location.lng], { icon }).addTo(map);

                if (!req.isGhost) {
                    const popupContent = `
                        <div class="font-display" style="width: 200px;">
                            <h3 class="font-bold text-slate-800 text-sm mb-1 truncate">${req.title}</h3>
                            <button id="btn-details-${req.id}" class="w-full text-center text-xs font-bold text-blue-600 bg-blue-50 py-1.5 rounded mt-1">Ver Detalhes</button>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    marker.on('popupopen', () => {
                        setTimeout(() => {
                            const btn = document.getElementById(`btn-details-${req.id}`);
                            if(btn) btn.onclick = () => onSelectRequest(req);
                        }, 50);
                    });
                }
            }
        });

    }, [requests, ghostRequests, mapStatusFilter]);

    return (
        <div className={`flex flex-col bg-background-light dark:bg-background-dark transition-all duration-300 ${isExpanded ? 'fixed inset-0 z-[100]' : 'h-full w-full relative min-h-[500px]'}`}>
            <style>{`
                @keyframes markerFadeOut {
                    0% { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(0); }
                }
                .marker-fade-out {
                    animation: markerFadeOut 0.5s forwards ease-out;
                }
            `}</style>

            {/* Map Element */}
            <div id="general-map-container" className="w-full h-full z-0 rounded-2xl overflow-hidden shadow-inner bg-slate-200 dark:bg-slate-800"></div>

            {/* Real-time Badge */}
            <div className="absolute top-4 left-4 z-[500] pointer-events-none">
                <div className="bg-white/90 dark:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-green-200 dark:border-green-900/50 flex items-center gap-2 pointer-events-auto">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </span>
                    <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Tempo Real</span>
                </div>
            </div>

            {/* Filters */}
            <div className="absolute top-4 left-0 right-0 z-[500] flex justify-center items-start px-4 pointer-events-none">
                <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md px-2 py-2 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 pointer-events-auto flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[60vw]">
                    {['Todos', 'Aberto', 'Em Análise', 'Agendado', 'Concluído'].map((f) => {
                        const isActive = mapStatusFilter === f;
                        const color = f === 'Todos' ? 'bg-slate-900' : f === 'Aberto' ? 'bg-blue-500' : f === 'Em Análise' ? 'bg-amber-500' : f === 'Agendado' ? 'bg-purple-500' : 'bg-green-500';
                        return (
                            <button 
                                key={f} 
                                onClick={() => setMapStatusFilter(f)} 
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all
                                    ${isActive ? `${color} text-white shadow-md` : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}
                                `}
                            >
                                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : color}`}></div>
                                {f}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Expand Button */}
            <div className="absolute top-4 right-4 z-[500] pointer-events-none">
                <button onClick={() => setIsExpanded(!isExpanded)} className="bg-white/95 dark:bg-slate-800/95 p-2.5 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 pointer-events-auto text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <span className="material-symbols-outlined text-xl">{isExpanded ? 'close_fullscreen' : 'open_in_full'}</span>
                </button>
            </div>
        </div>
    );
};

export default AdminRequestsMap;
