
import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GarbageTruck } from '../types';

declare global {
  interface Window {
    L: any;
  }
}

interface GarbageTrackerScreenProps {
  onBack: () => void;
}

const DEFAULT_ROUTE = [
    { lat: -11.8069, lng: -39.3856 },
    { lat: -11.8062, lng: -39.3865 }
];

const GarbageTrackerScreen: React.FC<GarbageTrackerScreenProps> = ({ onBack }) => {
  const mapContainerId = "garbage-map-container";
  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({}); 
  const userMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const hasFittedBounds = useRef(false);
  
  const [trucks, setTrucks] = useState<GarbageTruck[]>([]);
  const [userPos, setUserPos] = useState<{lat: number, lng: number} | null>(null);
  const [selectedTruck, setSelectedTruck] = useState<GarbageTruck | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [routePoints, setRoutePoints] = useState<{lat: number, lng: number}[]>([]);
  
  // --- 1. Load Route from Admin Config ---
  useEffect(() => {
      const unsub = onSnapshot(doc(db, "app_config", "garbage_route"), (docSnap) => {
          if (docSnap.exists() && docSnap.data().points) {
              setRoutePoints(docSnap.data().points);
          } else {
              setRoutePoints(DEFAULT_ROUTE);
          }
      }, (err) => {
          console.error("Error loading route", err);
          setRoutePoints(DEFAULT_ROUTE);
      });
      return () => unsub();
  }, []);

  // --- 2. Real-time Database Listener ---
  useEffect(() => {
    const q = query(collection(db, "garbage_trucks"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedTrucks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GarbageTruck));
        setTrucks(fetchedTrucks);
        setIsLoading(false);
        
        if (selectedTruck) {
            const updated = fetchedTrucks.find(t => t.id === selectedTruck.id);
            if (updated) setSelectedTruck(updated);
        } else if (fetchedTrucks.length > 0) {
            setSelectedTruck(fetchedTrucks[0]);
        }
    }, (error) => {
        console.error("GPS Tracker Error:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- 3. Get User Location ---
  useEffect(() => {
      if (navigator.geolocation) {
          const watchId = navigator.geolocation.watchPosition(
              (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              (err) => console.warn("GPS Error", err),
              { enableHighAccuracy: true }
          );
          return () => navigator.geolocation.clearWatch(watchId);
      }
  }, []);

  // --- 4. Map Initialization & Updates ---
  useEffect(() => {
      if (!window.L) return;

      // Init Map
      if (!mapRef.current) {
          const defaultCenter = [-11.8070, -39.3890];
          const map = window.L.map(mapContainerId, { zoomControl: false });
          
          // Remove Leaflet Prefix
          if (map.attributionControl) {
            map.attributionControl.setPrefix(false);
          }

          map.setView(defaultCenter, 15);
          
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19,
              attribution: '&copy; OpenStreetMap'
          }).addTo(map);
          
          mapRef.current = map;
      }

      const map = mapRef.current;

      // Draw Route Line (Updates if routePoints change)
      if (routePoints.length > 0) {
          if (routePolylineRef.current) {
              routePolylineRef.current.setLatLngs(routePoints);
          } else {
              routePolylineRef.current = window.L.polyline(routePoints, {
                  color: '#3b82f6', // Blue-500
                  weight: 5,
                  opacity: 0.6,
                  lineCap: 'round',
                  lineJoin: 'round'
              }).addTo(map);
          }

          // Fit bounds to show route if not already done
          if (!hasFittedBounds.current && routePolylineRef.current) {
              try {
                  const bounds = routePolylineRef.current.getBounds();
                  if (bounds.isValid()) {
                      map.fitBounds(bounds, { padding: [50, 50] });
                      hasFittedBounds.current = true;
                  }
              } catch (e) {
                  console.warn("Could not fit bounds yet", e);
              }
          }
      }

      // Update User Marker (Reforçado para alta visibilidade - Bolinha Azul Pulsante)
      if (userPos) {
          if (userMarkerRef.current) {
              userMarkerRef.current.setLatLng([userPos.lat, userPos.lng]);
          } else {
              const userIcon = window.L.divIcon({
                  className: 'user-marker-group',
                  html: `
                    <div class="relative flex flex-col items-center justify-center w-0 h-0 overflow-visible">
                        <!-- Label Bubble -->
                        <div class="absolute -top-12 bg-white/95 backdrop-blur-sm text-blue-700 text-[10px] font-black px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap border-2 border-blue-500 transform transition-transform hover:scale-110 flex flex-col items-center z-50">
                            Você está aqui
                            <div class="absolute -bottom-1.5 w-3 h-3 bg-blue-500 rotate-45"></div>
                        </div>
                        
                        <!-- The Glowing Blue Dot (GPS Style) -->
                        <div class="w-6 h-6 bg-[#135bec] rounded-full border-[4px] border-white shadow-[0_0_15px_rgba(19,91,236,0.6)] z-40 relative flex items-center justify-center">
                            <div class="w-2 h-2 bg-white rounded-full opacity-30 animate-pulse"></div>
                        </div>
                        
                        <!-- Extra Outer Ring for Visibility -->
                        <div class="absolute w-14 h-14 bg-[#135bec] rounded-full opacity-10 -z-20 border border-blue-500/20"></div>
                        
                        <!-- Pulse Ring Animation -->
                        <div class="absolute w-20 h-20 bg-[#135bec] rounded-full opacity-20 animate-ping -z-10"></div>
                    </div>
                  `,
                  iconSize: [0, 0], 
                  iconAnchor: [0, 0] 
              });
              userMarkerRef.current = window.L.marker([userPos.lat, userPos.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
          }
      }

      // Update Truck Markers
      trucks.forEach(truck => {
          const isMoving = truck.status === 'Em Rota';
          const truckHtml = `
            <div class="relative w-12 h-12 flex items-center justify-center transition-all duration-300">
                ${isMoving ? '<div class="absolute inset-0 bg-green-500 rounded-full opacity-30 animate-ping"></div>' : ''}
                <div class="relative z-10 ${isMoving ? 'bg-green-600' : 'bg-slate-700'} text-white p-2 rounded-full shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform">
                    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">local_shipping</span>
                </div>
            </div>
          `;

          const truckIcon = window.L.divIcon({
              className: `truck-marker-${truck.id}`,
              html: truckHtml,
              iconSize: [48, 48],
              iconAnchor: [24, 24]
          });

          if (markersRef.current[truck.id]) {
              markersRef.current[truck.id].setLatLng([truck.lat, truck.lng]);
              markersRef.current[truck.id].setIcon(truckIcon);
          } else {
              const marker = window.L.marker([truck.lat, truck.lng], { icon: truckIcon }).addTo(map);
              marker.on('click', () => {
                  setSelectedTruck(truck);
                  map.flyTo([truck.lat, truck.lng], 17);
              });
              markersRef.current[truck.id] = marker;
          }
      });

      // Cleanup removed trucks
      Object.keys(markersRef.current).forEach(id => {
          if (!trucks.find(t => t.id === id)) {
              map.removeLayer(markersRef.current[id]);
              delete markersRef.current[id];
          }
      });

  }, [trucks, userPos, routePoints]);

  const handleCenterTruck = () => {
      if (mapRef.current && selectedTruck) {
          mapRef.current.flyTo([selectedTruck.lat, selectedTruck.lng], 17);
      }
  };

  const formatLastUpdate = (timestamp: any) => {
      if (!timestamp) return '...';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-slate-100 dark:bg-slate-900 font-display">
      
      {/* Map Layer */}
      <div id={mapContainerId} className="absolute inset-0 z-0"></div>

      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 pt-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-3">
              <button onClick={onBack} className="size-10 flex items-center justify-center rounded-full bg-white/90 dark:bg-slate-800/90 shadow-lg backdrop-blur text-slate-800 dark:text-white transition-transform active:scale-95">
                  <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="flex-1">
                  <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur px-4 py-2 rounded-2xl shadow-lg border border-white/20 flex items-center gap-3">
                      <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-lg text-green-600 dark:text-green-400">
                          <span className="material-symbols-outlined text-[20px]">recycling</span>
                      </div>
                      <div>
                          <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                              {isLoading ? "Buscando sinal..." : `${trucks.length} Caminhões Online`}
                          </h2>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${trucks.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                              Monitoramento GPS
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Bottom Panel */}
      {selectedTruck ? (
          <div className="absolute bottom-0 left-0 right-0 z-10 p-4 pb-8 animate-in slide-in-from-bottom-4">
              <div className="bg-white dark:bg-[#1e293b] rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-5 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                      <div>
                          <h3 className="text-lg font-black text-slate-900 dark:text-white">{selectedTruck.plate}</h3>
                          <p className="text-xs text-slate-500 truncate max-w-[200px]">{selectedTruck.routeDescription || "Rota não definida"}</p>
                      </div>
                      <button 
                        onClick={handleCenterTruck}
                        className="p-3 bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-lg shadow-green-500/30 transition-all active:scale-95"
                      >
                          <span className="material-symbols-outlined">my_location</span>
                      </button>
                  </div>
                  
                  <div className="flex gap-2 text-xs">
                      <div className="flex-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col gap-1">
                          <span className="text-slate-400 uppercase font-bold text-[9px]">Status</span>
                          <span className={`font-bold flex items-center gap-1 ${selectedTruck.status === 'Em Rota' ? 'text-green-600' : 'text-amber-500'}`}>
                              <span className="material-symbols-outlined text-[14px]">
                                  {selectedTruck.status === 'Em Rota' ? 'moving' : 'local_parking'}
                              </span> 
                              {selectedTruck.status}
                          </span>
                      </div>
                      <div className="flex-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col gap-1">
                          <span className="text-slate-400 uppercase font-bold text-[9px]">Velocidade</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{selectedTruck.speed} km/h</span>
                      </div>
                      <div className="flex-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col gap-1">
                          <span className="text-slate-400 uppercase font-bold text-[9px]">Últ. Sinal</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{formatLastUpdate(selectedTruck.lastUpdate)}</span>
                      </div>
                  </div>
              </div>
          </div>
      ) : (
          !isLoading && (
            <div className="absolute bottom-10 left-0 right-0 z-10 text-center px-4 pointer-events-none">
                <div className="inline-block bg-black/60 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full shadow-lg">
                    Nenhum caminhão transmitindo no momento.
                </div>
            </div>
          )
      )}

    </div>
  );
};

export default GarbageTrackerScreen;
