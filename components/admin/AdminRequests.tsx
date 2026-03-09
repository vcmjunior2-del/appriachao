
import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { RequestItem, Secretariat } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

// Import Child Components
import AdminRequestsMap from './AdminRequestsMap';
import AdminRequestsList from './AdminRequestsList';
import AdminRequestsKanban from './AdminRequestsKanban';
import AdminRequestsStats from './AdminRequestsStats';
import AdminRequestsDetails from './AdminRequestsDetails';

interface AdminRequestsProps {
    initialView: 'REQ_DASHBOARD' | 'REQ_LIST' | 'REQ_MAP' | 'REQ_KANBAN';
}

interface MapNotification {
    show: boolean;
    type: 'add' | 'update' | 'delete';
    title: string;
    message: string;
}

// Extend RequestItem to support animation states
interface RequestItemWithMeta extends RequestItem {
    isGhost?: boolean;
    isFading?: boolean;
}

const AdminRequests: React.FC<AdminRequestsProps> = ({ initialView }) => {
    const { currentUser } = useAuth();
    
    // --- Global Data State ---
    const [requests, setRequests] = useState<RequestItem[]>([]);
    const [secretariats, setSecretariats] = useState<Secretariat[]>([]);
    const [ghostRequests, setGhostRequests] = useState<RequestItemWithMeta[]>([]);
    
    // State specifically for Map Animation
    const [flyToTarget, setFlyToTarget] = useState<{lat: number, lng: number, timestamp: number} | null>(null);
    
    const isFirstLoad = useRef(true);

    // --- UI State ---
    const [view, setView] = useState(initialView);
    const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
    const [notification, setNotification] = useState<MapNotification | null>(null);
    const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setView(initialView);
        setSelectedRequest(null); // Reset selection on main view change
    }, [initialView]);

    // --- Notifications Logic ---
    const triggerNotification = (type: 'add' | 'update' | 'delete', title: string, message: string) => {
        if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
        setNotification({ show: true, type, title, message });
        notificationTimerRef.current = setTimeout(() => {
            setNotification(prev => prev ? { ...prev, show: false } : null);
        }, 8000);
    };

    // --- Data Fetching & Real-time Listeners ---
    useEffect(() => {
        // Guard: Strictly allow only the Admin Email to fetch all requests.
        if (!currentUser || (currentUser.email !== 'administracao@riachaodojacuipe.ba.gov.br' && !currentUser.isAnonymous)) return;

        const unsubReqs = onSnapshot(
            query(collection(db, "requests"), orderBy('date', 'desc')), 
            (snap) => {
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as RequestItem));
                
                // Real-time detection for Notifications & Ghosts & FlyTo
                if (!isFirstLoad.current) {
                    snap.docChanges().forEach((change) => {
                        const reqData = { id: change.doc.id, ...change.doc.data() } as RequestItem;
                        
                        if (change.type === "added") {
                            triggerNotification('add', 'Nova Ocorrência!', `${reqData.title} - Enviada por: ${reqData.userName || 'Cidadão'}`);
                            
                            // Trigger Map FlyTo if location exists
                            if (reqData.location) {
                                console.log("New request with location, flying to:", reqData.location);
                                setFlyToTarget({ ...reqData.location, timestamp: Date.now() });
                            }

                        } else if (change.type === "modified") {
                            const lastHistory = reqData.history && reqData.history.length > 0 
                                ? reqData.history[reqData.history.length - 1] 
                                : null;
                            const author = lastHistory?.author || 'Sistema';
                            const action = lastHistory?.title || `Status: ${reqData.status}`;
                            triggerNotification('update', 'Atualização', `${action} realizada por ${author}`);
                        } else if (change.type === "removed") {
                            triggerNotification('delete', 'Ocorrência Excluída', `Registro #${reqData.id.slice(0,4).toUpperCase()} removido do sistema.`);
                            
                            // Ghost Logic for Map Deletion Animation
                            if (reqData.location) {
                                // Also FlyTo the deletion spot so admin sees it disappearing
                                setFlyToTarget({ ...reqData.location, timestamp: Date.now() });

                                setGhostRequests(prev => [...prev, { ...reqData, isGhost: true }]);
                                setTimeout(() => {
                                    setGhostRequests(prev => prev.map(r => r.id === reqData.id ? { ...r, isFading: true } : r));
                                }, 4000);
                                setTimeout(() => {
                                    setGhostRequests(prev => prev.filter(r => r.id !== reqData.id));
                                }, 4500);
                            }
                        }
                    });
                } else {
                    isFirstLoad.current = false;
                }
                setRequests(data);
            },
            (error) => {
                if (error.code !== 'permission-denied') {
                    console.error("Requests Listener Error:", error);
                }
            }
        );
        
        const unsubSecs = onSnapshot(collection(db, "secretariats"), 
            (snap) => setSecretariats(snap.docs.map(d => ({ id: d.id, ...d.data() } as Secretariat))),
            (error) => console.log("AdminRequests Secretariats restricted")
        );
        
        return () => { unsubReqs(); unsubSecs(); if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current); };
    }, [currentUser]);

    // --- Action Handlers ---
    const handleUpdateStatus = async (id: string, newStatus: string, note: string) => {
        try {
            const reqRef = doc(db, "requests", id);
            // Style logic matching previous implementation
            let colorClass = 'text-gray-600'; let bgClass = 'bg-gray-100';
            if (newStatus === 'Aberto') { colorClass = 'text-blue-600'; bgClass = 'bg-blue-100'; }
            else if (newStatus === 'Em Análise') { colorClass = 'text-amber-600'; bgClass = 'bg-amber-100'; }
            else if (newStatus === 'Agendado') { colorClass = 'text-purple-600'; bgClass = 'bg-purple-100'; }
            else if (newStatus === 'Concluído') { colorClass = 'text-green-600'; bgClass = 'bg-green-100'; }
            else if (newStatus === 'Rejeitado') { colorClass = 'text-red-600'; bgClass = 'bg-red-100'; }

            const adminName = currentUser?.displayName || 'Administrador';
            const historyItem = {
                date: new Date(),
                status: newStatus,
                title: `Status atualizado para ${newStatus}`,
                description: note || 'Atualização administrativa.',
                author: `${adminName} (Administração)`
            };

            const currentReq = requests.find(r => r.id === id);
            const history = currentReq?.history ? [...currentReq.history, historyItem] : [historyItem];

            await updateDoc(reqRef, { 
                status: newStatus, 
                statusColor: colorClass, 
                statusBg: bgClass, 
                history 
            });
            alert("Atualizado!");
            setSelectedRequest(prev => prev ? { ...prev, status: newStatus as any, history } : null);
        } catch (e) { console.error(e); alert("Erro ao atualizar."); }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Excluir permanentemente?")) {
            try {
                await deleteDoc(doc(db, "requests", id));
                setSelectedRequest(null);
            } catch (e) { alert("Erro ao excluir."); }
        }
    };

    const handleTransfer = async (id: string, targetSecretariat: string) => {
        try {
            const secName = secretariats.find(s => s.id === targetSecretariat)?.name || 'Outro';
            const adminName = currentUser?.displayName || 'Admin';
            const historyItem = {
                date: new Date(),
                status: 'Em Análise', // Usually reset status or keep
                title: `Tramitado para ${secName}`,
                description: 'Transferência de setor.',
                author: `${adminName} (Administração)`
            };
            const currentReq = requests.find(r => r.id === id);
            const history = currentReq?.history ? [...currentReq.history, historyItem] : [historyItem];

            await updateDoc(doc(db, "requests", id), { department: targetSecretariat, history });
            alert("Transferido!");
        } catch (e) { alert("Erro ao transferir."); }
    };

    // --- RENDER ---
    return (
        <div className="relative w-full h-full">
            {/* Global Notification Toast */}
            {notification && notification.show && (
                <div className="fixed top-24 right-8 z-[1000] animate-in slide-in-from-top-4 fade-in duration-500 pointer-events-auto">
                    <div className={`
                        bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl border p-4 w-80 flex items-start gap-4 ring-2 
                        ${notification.type === 'delete' ? 'border-red-100 dark:border-red-900/30 ring-red-500/20' : 
                          notification.type === 'update' ? 'border-blue-100 dark:border-blue-900/30 ring-blue-500/20' : 
                          'border-green-100 dark:border-green-900/30 ring-green-500/20'}
                    `}>
                        <div className={`p-2 rounded-full shrink-0 animate-bounce ${notification.type === 'delete' ? 'bg-red-100 text-red-600' : notification.type === 'update' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                            <span className="material-symbols-outlined">{notification.type === 'delete' ? 'delete' : notification.type === 'update' ? 'edit_note' : 'add_alert'}</span>
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{notification.title}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">{notification.message}</p>
                            <button onClick={() => setNotification(null)} className="mt-2 text-xs font-bold hover:underline">Dispensar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Switcher */}
            {selectedRequest ? (
                <AdminRequestsDetails 
                    request={selectedRequest} 
                    secretariats={secretariats}
                    onClose={() => setSelectedRequest(null)}
                    onDelete={handleDelete}
                    onUpdateStatus={handleUpdateStatus}
                    onTransfer={handleTransfer}
                />
            ) : (
                <>
                    {/* PERSISTENT MAP: Always mounted, just toggled via CSS */}
                    <div className={view === 'REQ_MAP' ? 'block h-full w-full' : 'hidden'}>
                        <AdminRequestsMap 
                            requests={requests} 
                            ghostRequests={ghostRequests} 
                            onSelectRequest={setSelectedRequest}
                            isVisible={view === 'REQ_MAP'}
                            flyToTarget={flyToTarget}
                        />
                    </div>

                    {/* CONDITIONAL VIEWS: Unmount when not active (lightweight) */}
                    {view === 'REQ_DASHBOARD' && (
                        <AdminRequestsStats requests={requests} secretariats={secretariats} />
                    )}
                    
                    {view === 'REQ_LIST' && (
                        <AdminRequestsList 
                            requests={requests} 
                            secretariats={secretariats}
                            onSelectRequest={setSelectedRequest}
                        />
                    )}
                    
                    {view === 'REQ_KANBAN' && (
                        <AdminRequestsKanban 
                            requests={requests} 
                            onSelectRequest={setSelectedRequest} 
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default AdminRequests;
