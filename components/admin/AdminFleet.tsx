
import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { GarbageTruck } from '../../types';

// Fallback initial route if nothing saved
const DEFAULT_ROUTE = [
    { lat: -11.8069, lng: -39.3856 },
    { lat: -11.8062, lng: -39.3865 }
];

const AdminFleet: React.FC = () => {
    const { currentUser } = useAuth();
    const [trucks, setTrucks] = useState<GarbageTruck[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    
    // Mapa & Rota
    const mapContainerId = "admin-fleet-map";
    const mapRef = useRef<any>(null);
    const markersRef = useRef<{[key: string]: any}>({});
    const routePolylineRef = useRef<any>(null);
    
    // Route Editing State
    const [isRouteMode, setIsRouteMode] = useState(false);
    const [routePoints, setRoutePoints] = useState<{lat: number, lng: number}[]>([]);
    const [savedRoute, setSavedRoute] = useState<{lat: number, lng: number}[]>([]);

    // Controle de Simulação
    const [simulationActive, setSimulationActive] = useState<{[key: string]: boolean}>({});
    const simulationIntervals = useRef<{[key: string]: any}>({});
    const truckMovementState = useRef<{[key: string]: { currentLat: number, currentLng: number, targetIndex: number }}>({});

    const [formData, setFormData] = useState<GarbageTruck>({
        id: '', plate: '', status: 'Parado', lat: -11.8069, lng: -39.3856, speed: 0, lastUpdate: null, routeDescription: ''
    });

    // 1. Load Trucks & Route Data
    useEffect(() => {
        if (!currentUser) return;
        
        // Trucks
        const unsub = onSnapshot(collection(db, "garbage_trucks"), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as GarbageTruck));
            setTrucks(data);
            updateMapMarkers(data);
        }, (error) => console.warn("AdminFleet Trucks restricted:", error));

        // Load Saved Route
        const loadRoute = async () => {
            const docRef = doc(db, "app_config", "garbage_route");
            const snap = await getDoc(docRef);
            if (snap.exists() && snap.data().points) {
                setSavedRoute(snap.data().points);
                setRoutePoints(snap.data().points); // Init edit state with saved
            } else {
                setRoutePoints(DEFAULT_ROUTE);
                setSavedRoute(DEFAULT_ROUTE);
            }
        };
        loadRoute();

        return () => {
            unsub();
            Object.values(simulationIntervals.current).forEach(clearInterval);
        };
    }, [currentUser]);

    // 2. Initialize Map
    useEffect(() => {
        if (!window.L) return;
        
        setTimeout(() => {
            const container = document.getElementById(mapContainerId);
            if (!container) return;

            if (!mapRef.current) {
                const map = window.L.map(mapContainerId, { zoomControl: false });
                
                // Remove Leaflet Prefix
                if (map.attributionControl) {
                  map.attributionControl.setPrefix(false);
                }

                map.setView([-11.8069, -39.3856], 15);
                
                window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; OpenStreetMap'
                }).addTo(map);

                // Map Click Listener for Route Editing
                map.on('click', (e: any) => {
                    if (document.body.getAttribute('data-route-mode') === 'true') {
                        setRoutePoints(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
                    }
                });

                mapRef.current = map;
            } else {
                mapRef.current.invalidateSize();
            }
        }, 500);
    }, []);

    // 3. Update Route Drawing (Polyline)
    useEffect(() => {
        if (!mapRef.current || !window.L) return;
        
        // Update DOM attribute for click handler check
        document.body.setAttribute('data-route-mode', isRouteMode ? 'true' : 'false');

        const points = isRouteMode ? routePoints : savedRoute;

        if (routePolylineRef.current) {
            routePolylineRef.current.setLatLngs(points);
            routePolylineRef.current.setStyle({ 
                color: isRouteMode ? '#f59e0b' : '#3b82f6', // Amber when editing, Blue when saved
                dashArray: isRouteMode ? '5, 10' : null 
            });
        } else {
            routePolylineRef.current = window.L.polyline(points, { 
                color: '#3b82f6', 
                weight: 4, 
                opacity: 0.6 
            }).addTo(mapRef.current);
        }

        // Draw circles for points when editing
        // Clear previous circles
        mapRef.current.eachLayer((layer: any) => {
            if (layer instanceof window.L.CircleMarker) mapRef.current.removeLayer(layer);
        });

        if (isRouteMode) {
            points.forEach(p => {
                window.L.circleMarker([p.lat, p.lng], {
                    radius: 4, color: '#f59e0b', fillOpacity: 1
                }).addTo(mapRef.current);
            });
        }

    }, [routePoints, savedRoute, isRouteMode]);

    // 4. Update Truck Markers
    const updateMapMarkers = (currentTrucks: GarbageTruck[]) => {
        if (!mapRef.current || !window.L) return;

        currentTrucks.forEach(truck => {
            const isSimulating = simulationActive[truck.id] || truck.status === 'Em Rota';
            
            const iconHtml = `
                <div class="relative flex items-center justify-center w-10 h-10">
                    <div class="absolute inset-0 bg-white rounded-full shadow-md border-2 ${isSimulating ? 'border-green-500 animate-pulse' : 'border-slate-400'}"></div>
                    <span class="material-symbols-outlined relative z-10 text-xl ${isSimulating ? 'text-green-600' : 'text-slate-500'}">local_shipping</span>
                </div>
            `;

            const icon = window.L.divIcon({
                className: 'custom-truck-icon',
                html: iconHtml,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            if (markersRef.current[truck.id]) {
                markersRef.current[truck.id].setLatLng([truck.lat, truck.lng]);
                markersRef.current[truck.id].setIcon(icon);
            } else {
                const marker = window.L.marker([truck.lat, truck.lng], { icon }).addTo(mapRef.current);
                marker.bindPopup(`<b>${truck.plate}</b><br>${truck.status}`);
                markersRef.current[truck.id] = marker;
            }
        });
    };

    // --- ACTIONS ---

    const handleSave = async () => {
        if (!formData.plate) return alert("Placa/ID obrigatório");
        try {
            const id = formData.id || `truck_${Date.now()}`;
            const data = { ...formData, id, lastUpdate: serverTimestamp() };
            await setDoc(doc(db, "garbage_trucks", id), data, { merge: true });
            setIsEditing(false);
            setFormData({ id: '', plate: '', status: 'Parado', lat: -11.8069, lng: -39.3856, speed: 0, lastUpdate: null, routeDescription: '' });
        } catch (e) { alert("Erro ao salvar"); }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Remover este veículo?")) {
            if (simulationIntervals.current[id]) clearInterval(simulationIntervals.current[id]);
            if (markersRef.current[id]) {
                mapRef.current.removeLayer(markersRef.current[id]);
                delete markersRef.current[id];
            }
            await deleteDoc(doc(db, "garbage_trucks", id));
        }
    };

    const handleSaveRoute = async () => {
        if (routePoints.length < 2) return alert("A rota precisa de pelo menos 2 pontos.");
        try {
            await setDoc(doc(db, "app_config", "garbage_route"), { points: routePoints });
            setSavedRoute(routePoints);
            setIsRouteMode(false);
            alert("Rota salva! Os caminhões seguirão este novo trajeto.");
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar rota.");
        }
    };

    // --- LÓGICA DE SIMULAÇÃO (GPS) ---
    const toggleSimulation = (truck: GarbageTruck) => {
        const isActive = simulationActive[truck.id];

        if (isActive) {
            // STOP
            if (simulationIntervals.current[truck.id]) {
                clearInterval(simulationIntervals.current[truck.id]);
                delete simulationIntervals.current[truck.id];
            }
            setSimulationActive(prev => ({...prev, [truck.id]: false}));
            updateDoc(doc(db, "garbage_trucks", truck.id), { status: 'Parado', speed: 0 });
        } else {
            // START - Use Saved Route
            const routeToUse = savedRoute.length > 1 ? savedRoute : DEFAULT_ROUTE;
            
            setSimulationActive(prev => ({...prev, [truck.id]: true}));
            
            // Find closest point to start
            let closestIndex = 0;
            let minDist = Infinity;
            const tLat = truck.lat || routeToUse[0].lat;
            const tLng = truck.lng || routeToUse[0].lng;

            routeToUse.forEach((p, i) => {
                const d = Math.sqrt(Math.pow(p.lat - tLat, 2) + Math.pow(p.lng - tLng, 2));
                if (d < minDist) { minDist = d; closestIndex = i; }
            });

            truckMovementState.current[truck.id] = {
                currentLat: tLat,
                currentLng: tLng,
                targetIndex: (closestIndex + 1) % routeToUse.length
            };

            // Run Loop
            simulationIntervals.current[truck.id] = setInterval(async () => {
                const state = truckMovementState.current[truck.id];
                const target = routeToUse[state.targetIndex];
                
                // Calculate Vector
                const dLat = target.lat - state.currentLat;
                const dLng = target.lng - state.currentLng;
                const dist = Math.sqrt(dLat * dLat + dLng * dLng);
                
                // Speed
                const speed = 0.0003; 

                if (dist < speed || dist === 0) {
                    state.currentLat = target.lat;
                    state.currentLng = target.lng;
                    state.targetIndex = (state.targetIndex + 1) % routeToUse.length;
                } else {
                    const ratio = speed / dist;
                    state.currentLat += dLat * ratio;
                    state.currentLng += dLng * ratio;
                }

                // Update DB
                await updateDoc(doc(db, "garbage_trucks", truck.id), {
                    lat: state.currentLat,
                    lng: state.currentLng,
                    speed: Math.round(30 + Math.random() * 10),
                    status: 'Em Rota',
                    lastUpdate: serverTimestamp()
                });

            }, 2000); 
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">Gestão de Frota</h2>
                    <p className="text-slate-500 dark:text-slate-400">Monitore, cadastre a rota e simule o trajeto dos veículos.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setIsEditing(true); setFormData({ id: '', plate: '', status: 'Parado', lat: -11.8069, lng: -39.3856, speed: 0, lastUpdate: null, routeDescription: '' }); }} className="bg-primary hover:bg-blue-600 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg flex items-center gap-2">
                        <span className="material-symbols-outlined">add</span> Novo Veículo
                    </button>
                </div>
            </div>

            {/* Map Area with Controls */}
            <div className="relative w-full h-80 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner shrink-0 group">
                <div id={mapContainerId} className="w-full h-full z-0"></div>
                
                {/* Route Controls */}
                <div className="absolute top-4 left-4 z-[400] flex gap-2">
                    {!isRouteMode ? (
                        <button onClick={() => setIsRouteMode(true)} className="bg-white text-slate-700 px-3 py-1.5 rounded-lg shadow-md text-xs font-bold flex items-center gap-1 border border-slate-200 hover:bg-slate-50">
                            <span className="material-symbols-outlined text-sm">edit_road</span>
                            Editar Rota
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={handleSaveRoute} className="bg-green-600 text-white px-3 py-1.5 rounded-lg shadow-md text-xs font-bold hover:bg-green-700">
                                Salvar Rota
                            </button>
                            <button onClick={() => setRoutePoints([])} className="bg-white text-red-600 px-3 py-1.5 rounded-lg shadow-md text-xs font-bold border border-red-200 hover:bg-red-50">
                                Limpar
                            </button>
                            <button onClick={() => { setIsRouteMode(false); setRoutePoints(savedRoute); }} className="bg-white text-slate-600 px-3 py-1.5 rounded-lg shadow-md text-xs font-bold border border-slate-200">
                                Cancelar
                            </button>
                        </div>
                    )}
                </div>

                {isRouteMode && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-xs font-bold backdrop-blur-sm z-[400]">
                        Clique no mapa para desenhar a rua por onde o caminhão passa.
                    </div>
                )}
            </div>

            {/* Editing Form */}
            {isEditing && (
                <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in slide-in-from-top-4">
                    <h3 className="font-bold mb-4 text-slate-900 dark:text-white">Dados do Veículo</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value})} placeholder="Placa / Identificador" className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        <input value={formData.routeDescription} onChange={e => setFormData({...formData, routeDescription: e.target.value})} placeholder="Descrição da Rota" className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button onClick={handleSave} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold">Salvar</button>
                        <button onClick={() => setIsEditing(false)} className="bg-slate-200 text-slate-700 px-6 py-2 rounded-xl font-bold">Cancelar</button>
                    </div>
                </div>
            )}

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
                {trucks.map(truck => (
                    <div key={truck.id} className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                        {simulationActive[truck.id] && <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl animate-pulse">EM MOVIMENTO</div>}
                        
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                <span className="material-symbols-outlined text-2xl">local_shipping</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">{truck.plate}</h3>
                                <p className="text-xs text-slate-500">{truck.routeDescription || 'Sem rota definida'}</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                                <span className="block text-slate-400 font-bold uppercase">Status</span>
                                <span className={`${truck.status === 'Em Rota' ? 'text-green-600' : 'text-slate-600'} font-bold`}>{truck.status}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                                <span className="block text-slate-400 font-bold uppercase">Velocidade</span>
                                <span className="font-bold dark:text-white">{truck.speed} km/h</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                onClick={() => toggleSimulation(truck)}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${simulationActive[truck.id] ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}
                            >
                                <span className="material-symbols-outlined text-base">{simulationActive[truck.id] ? 'stop' : 'play_arrow'}</span>
                                {simulationActive[truck.id] ? 'Parar Simulação' : 'Iniciar Rota'}
                            </button>
                            <button onClick={() => handleDelete(truck.id)} className="w-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                                <span className="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    </div>
                ))}
                {trucks.length === 0 && (
                    <div className="col-span-full py-10 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                        Nenhum veículo cadastrado.
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminFleet;
