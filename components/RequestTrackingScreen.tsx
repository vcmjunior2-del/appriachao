
import React, { useEffect, useState, useRef } from 'react';
import { doc, getDoc, onSnapshot, collection, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { RequestItem, RequestHistoryItem, Secretariat } from '../types';
import { useAuth } from '../contexts/AuthContext';

declare global {
  interface Window {
    L: any;
  }
}

interface RequestTrackingScreenProps {
  requestId: string;
  onBack: () => void;
}

const RequestTrackingScreen: React.FC<RequestTrackingScreenProps> = ({ requestId, onBack }) => {
  const { currentUser } = useAuth();
  const [request, setRequest] = useState<RequestItem | null>(null);
  const [secretariats, setSecretariats] = useState<Secretariat[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const mapRef = useRef<any>(null);
  const mapContainerId = `map-view-${requestId}`;

  // --- Helpers ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aberto': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Em Análise': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Agendado': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
      case 'Concluído': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 'Rejeitado': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const formatDateFull = (timestamp: any) => {
    if (!timestamp) return '';
    let dateObj: Date | null = null;
    if (timestamp.toDate) dateObj = timestamp.toDate();
    else if (timestamp.seconds !== undefined) dateObj = new Date(timestamp.seconds * 1000);
    else if (timestamp instanceof Date) dateObj = timestamp;

    if (dateObj) {
        return dateObj.toLocaleDateString('pt-BR', { 
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
    }
    return '';
  };

  const formatDateShort = (timestamp: any) => {
    if (!timestamp) return '';
    let dateObj: Date | null = null;
    if (timestamp.toDate) dateObj = timestamp.toDate();
    else if (timestamp.seconds !== undefined) dateObj = new Date(timestamp.seconds * 1000);
    else if (timestamp instanceof Date) dateObj = timestamp;

    if (dateObj) {
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const hour = dateObj.getHours().toString().padStart(2, '0');
        const min = dateObj.getMinutes().toString().padStart(2, '0');
        return `${day}/${month} - ${hour}:${min}`;
    }
    return '';
  };

  const getSecretariatName = (id?: string) => {
      if (!id) return null;
      const sec = secretariats.find(s => s.id === id);
      return sec ? sec.name : 'Departamento não identificado';
  };

  const isUrl = (str?: string) => str ? (str.includes('http') || str.includes('data:')) : false;

  // --- Actions ---
  const handleConfirmDelete = async () => {
      setIsDeleting(true);
      try {
          // Delete from Firestore
          await deleteDoc(doc(db, "requests", requestId));
          // Success: Navigate back immediately
          onBack(); 
      } catch (error: any) {
          console.error("Error deleting document: ", error);
          let msg = "Não foi possível excluir. Tente novamente.";
          if (error.code === 'permission-denied') {
              msg = "Permissão negada. Apenas o autor ou administrador pode excluir este registro.";
          }
          alert(msg);
          setIsDeleting(false);
          setShowDeleteModal(false);
      }
  };

  // --- Fetch Data ---
  useEffect(() => {
    setLoading(true);
    
    const docRef = doc(db, "requests", requestId);
    const unsubscribeRequest = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setRequest({ id: docSnap.id, ...data } as RequestItem);
        } else {
            console.log("Document removed");
            // If the document is gone (deleted), we don't need to do anything here
            // because onBack() is called after delete action.
        }
        setLoading(false);
    }, (error) => {
        console.warn("Snapshot Error:", error.message);
        setLoading(false);
    });

    const unsubscribeSecretariats = onSnapshot(collection(db, "secretariats"), (snap) => {
        setSecretariats(snap.docs.map(d => ({ id: d.id, ...d.data() } as Secretariat)));
    });

    return () => {
        unsubscribeRequest();
        unsubscribeSecretariats();
    };
  }, [requestId]);

  // --- Map Effect ---
  useEffect(() => {
    if (!loading && request && request.location && window.L) {
       // Small delay to ensure container exists
       const timer = setTimeout(() => {
           const container = document.getElementById(mapContainerId);
           if (!container) return;
           
           if (mapRef.current) {
               mapRef.current.remove();
               mapRef.current = null;
           }

           const map = window.L.map(mapContainerId, {
               zoomControl: false, attributionControl: false, dragging: false,
               scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false
           }).setView([request.location!.lat, request.location!.lng], 16);

           // CHANGED TO OPENSTREETMAP STANDARD
           window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

            const customIcon = window.L.divIcon({
                className: 'custom-map-marker',
                html: `<div style="display:flex;justify-content:center;align-items:center;width:30px;height:30px;background:#135bec;border-radius:50%;color:white;box-shadow:0 4px 6px rgba(0,0,0,0.3);"><span class="material-symbols-outlined" style="font-size:18px;">location_on</span></div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
            });
           window.L.marker([request.location!.lat, request.location!.lng], { icon: customIcon }).addTo(map);
           mapRef.current = map;
       }, 300);
       return () => clearTimeout(timer);
    }
  }, [loading, request, mapContainerId]);

  // --- Timeline Builder ---
  const getTimelineEvents = () => {
      if (!request) return [];
      
      let events: RequestHistoryItem[] = [];
      if (request.history && request.history.length > 0) {
          events = [...request.history].sort((a, b) => {
               const getSeconds = (t: any) => t?.seconds || (t?.toDate ? t.toDate().getTime()/1000 : 0);
               return getSeconds(b.date) - getSeconds(a.date);
          });
      } else {
          events.push({
              status: 'Recebido',
              title: 'Ocorrência Recebida',
              description: `Protocolo gerado #${request.id.slice(0,8).toUpperCase()}`,
              date: request.date
          });
          if (request.status !== 'Aberto') {
              events.unshift({
                 status: request.status,
                 title: `Status alterado para ${request.status}`,
                 description: 'Por Sistema Automático',
                 date: null 
              });
          }
      }
      return events;
  };

  const getEventStyle = (title: string, status: string) => {
    const t = title.toLowerCase();
    const s = status.toLowerCase();
    
    if (t.includes('recebida') || s === 'recebido') return { icon: 'inbox', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' };
    if (t.includes('concluído') || s === 'concluído') return { icon: 'check_circle', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' };
    if (t.includes('análise') || s === 'em análise') return { icon: 'search', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' };
    return { icon: 'edit', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-500 dark:text-blue-400' };
  };

  const renderHighlightedTitle = (title: string) => {
      const parts = title.split(/(Em Análise|Aberto|Concluído|Rejeitado|Agendado)/i);
      return (
          <>
            {parts.map((part, i) => {
                if (['Em Análise', 'Aberto', 'Concluído', 'Rejeitado', 'Agendado'].includes(part)) {
                    let colorClass = 'text-gray-900';
                    if (part === 'Em Análise') colorClass = 'text-amber-500';
                    if (part === 'Concluído') colorClass = 'text-green-500';
                    if (part === 'Rejeitado') colorClass = 'text-red-500';
                    return <span key={i} className={`font-bold ${colorClass}`}>{part}</span>
                }
                return part;
            })}
          </>
      );
  }

  if (loading || !request) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background-light dark:bg-background-dark">
            <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
        </div>
    );
  }

  const timelineEvents = getTimelineEvents();
  const iconIsImg = isUrl(request.icon);
  const secretariatName = getSecretariatName(request.department);
  
  // Logic: Allow deletion if User is Admin OR User is Owner
  const isAdmin = currentUser?.email === 'administracao@riachaodojacuipe.ba.gov.br' || currentUser?.isAnonymous;
  const isOwner = currentUser?.uid === request.userId;
  const canDelete = isAdmin || isOwner;

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display pb-10">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 flex items-center bg-white/90 dark:bg-[#111a22]/90 backdrop-blur-md p-4 border-b border-gray-100 dark:border-gray-800 justify-between">
        <button 
          onClick={onBack}
          className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-800 dark:text-white">arrow_back</span>
        </button>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight text-center">
          Acompanhamento
        </h2>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto pb-6">
        {/* Status Banner */}
        <div className="bg-white dark:bg-card-dark p-6 pb-8 border-b border-gray-100 dark:border-gray-800 rounded-b-[2rem] shadow-sm z-10 relative">
            <div className="flex flex-col items-center text-center gap-3">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-1 overflow-hidden ${request.iconBg || 'bg-blue-50'} ${iconIsImg ? '' : (request.iconColor || 'text-blue-600')}`}>
                    {iconIsImg ? (
                        <img src={request.icon} alt="Icon" className="w-full h-full object-contain p-2" />
                    ) : (
                        <span className="material-symbols-outlined">{request.icon}</span>
                    )}
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight max-w-xs mx-auto">
                    {request.title}
                </h1>
                <div className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 ${getStatusColor(request.status)}`}>
                    <span className="material-symbols-outlined text-[18px]">
                        {request.status === 'Concluído' ? 'check_circle' : 'pending'}
                    </span>
                    {request.status}
                </div>
                <p className="text-xs text-gray-400 font-mono mt-1">ID: #{request.id.slice(0, 8).toUpperCase()}</p>
            </div>
        </div>

        <div className="px-4 py-6 space-y-6">
            
            {/* Description & Details */}
            <section className="bg-white dark:bg-card-dark p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">info</span>
                    Detalhes
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">
                    {request.description || "Sem descrição fornecida."}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
                     <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                        <span>{formatDateFull(request.date)}</span>
                     </div>
                     {secretariatName && (
                         <div className="flex items-center gap-1 flex-1 min-w-0">
                            <span className="material-symbols-outlined text-[16px]">business</span>
                            <span className="truncate">{secretariatName}</span>
                         </div>
                     )}
                </div>
            </section>

             {/* Photos Gallery */}
             {request.photos && request.photos.length > 0 && (
                <section>
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-1">Evidências Anexadas</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                        {request.photos.map((photo, index) => (
                            <div key={index} className="shrink-0 w-32 h-32 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                                <img src={photo} className="w-full h-full object-cover" alt="Evidência" />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Location Map */}
            {request.location && (
                 <section className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[18px]">map</span>
                            Localização
                        </h3>
                    </div>
                    <div className="relative w-full h-40 bg-gray-100 dark:bg-gray-800">
                        <div id={mapContainerId} className="w-full h-full z-0"></div>
                        {/* Overlay to prevent interaction conflicts if needed, but here we just show it */}
                        <div className="absolute inset-0 z-10 bg-transparent"></div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-600 dark:text-gray-400 font-medium truncate">
                        <span className="material-symbols-outlined text-[14px] align-text-bottom mr-1">location_on</span>
                        {request.address}
                    </div>
                 </section>
            )}

            {/* Timeline */}
            <section className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">history</span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Histórico de Tramitação</h3>
                </div>

                <div className="p-5 pt-6 pb-4">
                    <div className="relative">
                        <div className="absolute left-[19px] top-4 bottom-8 w-[2px] bg-slate-100 dark:bg-slate-700"></div>
                        <div className="space-y-8">
                            {timelineEvents.map((event, index) => {
                                const style = getEventStyle(event.title, event.status);
                                return (
                                    <div key={index} className="relative flex gap-4">
                                        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${style.bg} ${style.text} ring-4 ring-white dark:ring-card-dark`}>
                                            <span className="material-symbols-outlined text-[20px]">{style.icon}</span>
                                        </div>
                                        <div className="flex-1 pt-0.5">
                                            <div className="flex justify-between items-start">
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight pr-2">
                                                    {renderHighlightedTitle(event.title)}
                                                </h4>
                                                <span className="text-xs font-medium text-slate-400 shrink-0">
                                                    {event.date ? formatDateShort(event.date) : ''}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                                                {event.description || event.author || 'Atualização do sistema'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="relative flex gap-4">
                                 <div className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-400 ring-4 ring-white dark:ring-card-dark">
                                    <span className="material-symbols-outlined text-[20px]">add</span>
                                </div>
                                <div className="flex-1 pt-2.5">
                                    <p className="text-sm text-slate-400 font-medium">Início do processo</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Cancel/Delete Button */}
            {canDelete && (
                <div className="mt-6 mb-2 px-4">
                    <button 
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full py-3.5 rounded-xl border border-red-100 bg-red-50 text-red-600 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors cursor-pointer active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                        Excluir Solicitação
                    </button>
                    <p className="text-center text-xs text-gray-400 mt-2">
                        Esta ação removerá o registro do sistema.
                    </p>
                </div>
            )}
        </div>
      </main>

      {/* Confirmation Modal - High Z-Index to stay on top of map */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700 relative">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-500 mb-4">
                        <span className="material-symbols-outlined text-3xl">warning</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Cancelar Solicitação?</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                        Esta ação <strong>não pode ser desfeita</strong>. A solicitação será removida permanentemente do sistema da prefeitura.
                    </p>
                </div>
                
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowDeleteModal(false)}
                        disabled={isDeleting}
                        className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Voltar
                    </button>
                    <button 
                        onClick={handleConfirmDelete}
                        disabled={isDeleting}
                        className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-colors flex items-center justify-center gap-2"
                    >
                        {isDeleting ? (
                            <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                        ) : (
                            <>
                                <span>Confirmar</span>
                                <span className="material-symbols-outlined text-lg">delete</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default RequestTrackingScreen;
