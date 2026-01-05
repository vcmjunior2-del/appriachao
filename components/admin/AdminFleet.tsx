
import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { GarbageTruck } from '../../types';

const AdminFleet: React.FC = () => {
    const { currentUser } = useAuth();
    const [trucks, setTrucks] = useState<GarbageTruck[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [showHelp, setShowHelp] = useState(false); // Modal de ajuda
    const [simulationActive, setSimulationActive] = useState<{[key: string]: boolean}>({});
    const simulationIntervals = useRef<{[key: string]: any}>({});

    // Estado local estendido para incluir o tipo de dispositivo (apenas visual por enquanto)
    const [deviceType, setDeviceType] = useState('mobile'); 

    const [formData, setFormData] = useState<GarbageTruck>({
        id: '', plate: '', status: 'Parado', lat: -11.8069, lng: -39.3856, speed: 0, lastUpdate: null, routeDescription: ''
    });

    useEffect(() => {
        if (!currentUser) return;
        const unsub = onSnapshot(collection(db, "garbage_trucks"), (snap) => {
            setTrucks(snap.docs.map(d => ({ id: d.id, ...d.data() } as GarbageTruck)));
        });
        return () => {
            unsub();
            // Cleanup simulations
            Object.values(simulationIntervals.current).forEach(clearInterval);
        };
    }, [currentUser]);

    const handleSave = async () => {
        if (!formData.plate) return alert("Placa/ID obrigatório");
        try {
            const id = formData.id || `truck_${Date.now()}`;
            // Salvamos o deviceType como parte do objeto (se precisar estender o tipo depois)
            const data = { ...formData, id, lastUpdate: serverTimestamp(), deviceType };
            await setDoc(doc(db, "garbage_trucks", id), data, { merge: true });
            setIsEditing(false);
            setFormData({ id: '', plate: '', status: 'Parado', lat: -11.8069, lng: -39.3856, speed: 0, lastUpdate: null, routeDescription: '' });
        } catch (e) { alert("Erro ao salvar"); }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Remover este veículo?")) await deleteDoc(doc(db, "garbage_trucks", id));
    };

    // --- SIMULAÇÃO DE GPS (Escreve no Firestore) ---
    const toggleSimulation = (truck: GarbageTruck) => {
        if (simulationActive[truck.id]) {
            // Stop
            clearInterval(simulationIntervals.current[truck.id]);
            delete simulationIntervals.current[truck.id];
            setSimulationActive(prev => ({...prev, [truck.id]: false}));
            // Update status to stopped
            updateDoc(doc(db, "garbage_trucks", truck.id), { status: 'Parado', speed: 0 });
        } else {
            // Start
            setSimulationActive(prev => ({...prev, [truck.id]: true}));
            
            let currentLat = truck.lat || -11.8069;
            let currentLng = truck.lng || -39.3856;
            let angle = Math.random() * Math.PI * 2;

            simulationIntervals.current[truck.id] = setInterval(async () => {
                // Random movement logic
                angle += (Math.random() - 0.5) * 0.5; // Slight turn
                const speed = 20 + Math.random() * 20; // 20-40 km/h
                const dist = (speed / 3600) * 0.05; // Distance in 5 seconds
                
                const dLat = (dist / 111) * Math.cos(angle); 
                const dLng = (dist / 111) * Math.sin(angle);

                currentLat += dLat;
                currentLng += dLng;

                await updateDoc(doc(db, "garbage_trucks", truck.id), {
                    lat: currentLat,
                    lng: currentLng,
                    speed: Math.round(speed),
                    status: 'Em Rota',
                    lastUpdate: serverTimestamp()
                });
            }, 3000); 
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">Gestão de Frota (GPS)</h2>
                    <p className="text-slate-500 dark:text-slate-400">Cadastre veículos e monitore a localização em tempo real.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowHelp(true)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold p-2.5 rounded-xl transition-colors" title="Hardware Compatível">
                        <span className="material-symbols-outlined">help</span>
                    </button>
                    <button onClick={() => { setIsEditing(true); setFormData({ id: '', plate: '', status: 'Parado', lat: -11.8069, lng: -39.3856, speed: 0, lastUpdate: null, routeDescription: '' }); }} className="bg-primary hover:bg-blue-600 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg flex items-center gap-2">
                        <span className="material-symbols-outlined">add</span> Novo Veículo
                    </button>
                </div>
            </div>

            {/* Hardware Help Modal */}
            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowHelp(false)}>
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-6 shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-200 relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                        
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">sensors</span> Hardware Compatível
                        </h3>
                        
                        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl">
                                <p className="font-bold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">cancel</span> SmartTags / AirTags</p>
                                <p>Tags Bluetooth <strong>não funcionam</strong> para rastreamento de frota em tempo real, pois não possuem GPS próprio nem conexão de dados constante.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/50">
                                    <p className="font-bold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">smartphone</span> App Android</p>
                                    <p className="text-xs">Use um celular no painel com nosso app de motorista (GPS do celular).</p>
                                </div>
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/50">
                                    <p className="font-bold text-green-600 dark:text-green-400 mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">router</span> Rastreador GPS</p>
                                    <p className="text-xs">Dispositivos dedicados (ex: TK905, Teltonika) com chip de dados.</p>
                                </div>
                            </div>
                            
                            <p className="text-xs text-slate-400 mt-2">
                                * O sistema atual utiliza coordenadas GPS (Lat/Lng) atualizadas a cada 5-30 segundos.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {isEditing && (
                <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
                    <h3 className="font-bold mb-4 text-slate-900 dark:text-white">Dados do Veículo</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value})} placeholder="Placa / Identificador (ex: CAM-04)" className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        <input value={formData.routeDescription} onChange={e => setFormData({...formData, routeDescription: e.target.value})} placeholder="Descrição da Rota (ex: Centro - Bairro Novo)" className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        
                        {/* Seletor de Tipo de Hardware (Visual) */}
                        <div className="relative">
                            <select 
                                value={deviceType} 
                                onChange={(e) => setDeviceType(e.target.value)}
                                className="w-full p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-white appearance-none"
                            >
                                <option value="mobile">Celular (App Motorista)</option>
                                <option value="gps">Rastreador Dedicado</option>
                                <option value="simulation">Apenas Simulação</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                        </div>

                        <div className="flex gap-2">
                            <input type="number" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} placeholder="Lat Inicial" className="p-3 border rounded-xl w-full dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                            <input type="number" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} placeholder="Lng Inicial" className="p-3 border rounded-xl w-full dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button onClick={handleSave} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold">Salvar</button>
                        <button onClick={() => setIsEditing(false)} className="bg-slate-200 text-slate-700 px-6 py-2 rounded-xl font-bold">Cancelar</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trucks.map(truck => (
                    <div key={truck.id} className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                        {simulationActive[truck.id] && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl animate-pulse">SIMULANDO GPS</div>}
                        
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                <span className="material-symbols-outlined text-3xl">local_shipping</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">{truck.plate}</h3>
                                <p className="text-xs text-slate-500">{truck.routeDescription}</p>
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
                                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${simulationActive[truck.id] ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}
                            >
                                <span className="material-symbols-outlined text-base">{simulationActive[truck.id] ? 'stop' : 'play_arrow'}</span>
                                {simulationActive[truck.id] ? 'Parar Simulação' : 'Simular Rota'}
                            </button>
                            <button onClick={() => handleDelete(truck.id)} className="w-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                                <span className="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                        <p className="text-[10px] text-center text-slate-400 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            ID do Rastreador: {truck.id.slice(0,8)}...
                        </p>
                    </div>
                ))}
                {trucks.length === 0 && (
                    <div className="col-span-full py-10 text-center text-slate-500">Nenhum veículo cadastrado.</div>
                )}
            </div>
        </div>
    );
};

export default AdminFleet;
