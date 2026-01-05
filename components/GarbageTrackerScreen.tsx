
import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
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

const GarbageTrackerScreen: React.FC<GarbageTrackerScreenProps> = ({ onBack }) => {
  const mapContainerId = "garbage-map-container";
  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({}); // Store markers by ID
  const userMarkerRef = useRef<any>(null);
  
  // State
  const [trucks, setTrucks] = useState<GarbageTruck[]>([]);
  const [userPos, setUserPos] = useState<{lat: number, lng: number} | null>(null);
  const [selectedTruck, setSelectedTruck] = useState<GarbageTruck | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- 1. Real-time Database Listener ---
  useEffect(() => {
    // Listen to trucks collection
    const q = query(collection(db, "garbage_trucks")); // Add 'where("active", "==", true)' if needed
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedTrucks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GarbageTruck));
        setTrucks(fetchedTrucks);
        setIsLoading(false);
        
        // If we have a selected truck, update its data
        if (selectedTruck) {
            const updated = fetchedTrucks.find(t => t.id === selectedTruck.id);
            if (updated) setSelectedTruck(updated);
        } else if (fetchedTrucks.length > 0) {
            // Auto select first truck if none selected
            setSelectedTruck(fetchedTrucks[0]);
        }
    }, (error) => {
        console.error("GPS Tracker Error:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, []); // Run once on mount

  // --- 2. Get User Location ---
  useEffect(() => {
      if (navigator.geolocation) {
          const watchId = navigator.geolocation.watchPosition(
              (pos) => {
                  setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              },
              (err) => console.warn("GPS Error", err),
              { enableHighAccuracy: true }
          );
          return () => navigator.geolocation.clearWatch(watchId);
      }
  }, []);

  // --- 3. Map Initialization & Updates ---
  useEffect(() => {
      if (!window.L) return;

      // Initialize Map
      if (!mapRef.current) {
          const defaultCenter = userPos ? [userPos.lat, userPos.lng] : [-11.8070, -39.3890];
          const map = window.L.map(mapContainerId, { zoomControl: false }).setView(defaultCenter, 15);
          
          // CHANGED TO OPENSTREETMAP STANDARD
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19,
              attribution: '&copy; OpenStreetMap'
          }).addTo(map);
          
          mapRef.current = map;
      }

      const map = mapRef.current;

      // Update User Marker
      if (userPos) {
          if (userMarkerRef.current) {
              userMarkerRef.current.setLatLng([userPos.lat, userPos.lng]);
          } else {
              const userIcon = window.L.divIcon({
                  className: 'user-marker-icon',
                  html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md pulse-ring"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
              });
              userMarkerRef.current = window.L.marker([userPos.lat, userPos.lng], { icon: userIcon }).addTo(map);
          }
      }

      // Update Truck Markers
      trucks.forEach(truck => {
          // Icon based on status
          const isMoving = truck.status === 'Em Rota';
          const truckHtml = `
            <div class="relative w-12 h-12 flex items-center justify-center transition-all duration-500">
                ${isMoving ? '<div class="absolute inset-0 bg-green-500 rounded-full opacity-30 animate-ping"></div>' : ''}
                <div class="relative z-10 ${isMoving ? 'bg-green-600' : 'bg-gray-600'} text-white p-2 rounded-full shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform">
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
              // Update position with smooth animation (Leaflet handles basics, for true interpolation we'd need more code)
              markersRef.current[truck.id].setLatLng([truck.lat, truck.lng]);
              markersRef.current[truck.id].setIcon(truckIcon);
          } else {
              // Create new marker
              const marker = window.L.marker([truck.lat, truck.lng], { icon: truckIcon }).addTo(map);
              marker.on('click', () => {
                  setSelectedTruck(truck);
                  map.flyTo([truck.lat, truck.lng], 16);
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

  }, [trucks, userPos]);

  const handleCenterTruck = () => {
      if (mapRef.current && selectedTruck) {
          mapRef.current.flyTo([selectedTruck.lat, selectedTruck.lng], 17);
      }
  };

  const formatLastUpdate = (timestamp: any) => {
      if (!timestamp) return 'Desconhecido';
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
