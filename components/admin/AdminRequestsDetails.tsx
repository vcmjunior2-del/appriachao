
import React, { useState, useEffect, useRef } from 'react';
import { RequestItem, Secretariat } from '../../types';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'; // Import addDoc
import { db } from '../../firebaseConfig'; // Import db

interface AdminRequestsDetailsProps {
    request: RequestItem;
    secretariats: Secretariat[];
    onClose: () => void;
    onDelete: (id: string) => Promise<void>;
    onUpdateStatus: (id: string, newStatus: string, note: string) => Promise<void>;
    onTransfer: (id: string, targetSecretariat: string) => Promise<void>;
}

const AdminRequestsDetails: React.FC<AdminRequestsDetailsProps> = ({ request, secretariats, onClose, onDelete, onUpdateStatus, onTransfer }) => {
    const [updateStatus, setUpdateStatus] = useState(request.status);
    const [updateNote, setUpdateNote] = useState('');
    const [transferTargetId, setTransferTargetId] = useState(''); // State for transfer dropdown
    
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    
    // UI State
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [isMapExpanded, setIsMapExpanded] = useState(false);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);

    const isUrl = (str?: string) => str ? (str.includes('http') || str.includes('data:')) : false;
    const isImg = isUrl(request.icon);

    const getSecretariatName = (id?: string) => secretariats.find(s => s.id === id)?.name || 'N/A';
    const getSecretariatObject = (id?: string) => secretariats.find(s => s.id === id);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Data não disponível';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const formatDateFull = (timestamp: any) => {
        if (!timestamp) return '';
        let dateObj: Date | null = null;
        if (timestamp.toDate) dateObj = timestamp.toDate();
        else if (timestamp.seconds !== undefined) dateObj = new Date(timestamp.seconds * 1000);
        else if (timestamp instanceof Date) dateObj = timestamp;
    
        if (dateObj) {
            return dateObj.toLocaleDateString('pt-BR', { 
                day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
        }
        return '';
    };

    const handleUpdate = async () => {
        if (!updateNote.trim()) {
            alert("Por favor, adicione uma nota de atualização para notificar o cidadão.");
            return;
        }

        setIsUpdating(true);
        try {
            // 1. Update Status (Parent function)
            await onUpdateStatus(request.id, updateStatus, updateNote);

            // 2. Create Notification for the User
            await addDoc(collection(db, "notifications"), {
                userId: request.userId,
                title: request.title, 
                message: `Status atualizado para: ${updateStatus}. ${updateNote}`,
                type: updateStatus === 'Concluído' ? 'success' : 'update',
                read: false,
                date: serverTimestamp(),
                relatedRequestId: request.id
            });

            setIsUpdating(false);
            setUpdateNote(''); // Clear note
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 5000);
        } catch (error) {
            console.error("Error updating/notifying", error);
            alert("Erro ao atualizar ou enviar notificação.");
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if(confirm("Tem certeza que deseja excluir este registro permanentemente?")) {
            setIsDeleting(true);
            await onDelete(request.id);
            setIsDeleting(false);
        }
    };

    const handleTransfer = async () => {
        if (!transferTargetId) {
            alert("Selecione um departamento de destino.");
            return;
        }
        if (transferTargetId === request.department) {
            alert("A ocorrência já está neste departamento.");
            return;
        }

        setIsTransferring(true);
        try {
            const targetName = getSecretariatName(transferTargetId);
            await onTransfer(request.id, transferTargetId);
            
            // Notify User about Transfer
            await addDoc(collection(db, "notifications"), {
                userId: request.userId,
                title: request.title,
                message: `Solicitação tramitada para: ${targetName}.`,
                type: 'info',
                read: false,
                date: serverTimestamp(),
                relatedRequestId: request.id
            });

            alert(`Processo tramitado com sucesso para: ${targetName}`);
            onClose(); // Close details or refresh
        } catch (error) {
            console.error("Error transferring", error);
            alert("Erro ao tramitar.");
        } finally {
            setIsTransferring(false);
        }
    };

    // --- Helper: Timeline Styles ---
    const getHistoryStyle = (title: string, status: string) => {
        const t = title.toLowerCase();
        const s = status ? status.toLowerCase() : '';
        
        // Creation (Base)
        if (t.includes('recebida') || s === 'recebido') 
            return { 
                icon: 'inbox', 
                bg: 'bg-slate-100 dark:bg-slate-800', 
                text: 'text-slate-600 dark:text-slate-400', 
                border: 'border-slate-200 dark:border-slate-700',
                line: 'bg-slate-200 dark:bg-slate-700'
            };
        
        // Tramitation / Transfer
        if (t.includes('tramitado') || t.includes('transferido')) 
            return { 
                icon: 'move_up', 
                bg: 'bg-purple-100 dark:bg-purple-900/30', 
                text: 'text-purple-600 dark:text-purple-400', 
                border: 'border-purple-200 dark:border-purple-800',
                line: 'bg-purple-200 dark:bg-purple-800'
            };

        // Status Changes
        if (s === 'concluído' || t.includes('concluído')) 
            return { 
                icon: 'check_circle', 
                bg: 'bg-green-100 dark:bg-green-900/30', 
                text: 'text-green-600 dark:text-green-400', 
                border: 'border-green-200 dark:border-green-800',
                line: 'bg-green-200 dark:bg-green-800'
            };
        
        if (s === 'em análise' || t.includes('análise')) 
            return { 
                icon: 'search', 
                bg: 'bg-amber-100 dark:bg-amber-900/30', 
                text: 'text-amber-600 dark:text-amber-400', 
                border: 'border-amber-200 dark:border-amber-800',
                line: 'bg-amber-200 dark:bg-amber-800'
            };
        
        if (s === 'rejeitado' || t.includes('rejeitado')) 
            return { 
                icon: 'cancel', 
                bg: 'bg-red-100 dark:bg-red-900/30', 
                text: 'text-red-600 dark:text-red-400', 
                border: 'border-red-200 dark:border-red-800',
                line: 'bg-red-200 dark:bg-red-800'
            };
            
        if (s === 'agendado' || t.includes('agendado')) 
            return { 
                icon: 'event', 
                bg: 'bg-blue-100 dark:bg-blue-900/30', 
                text: 'text-blue-600 dark:text-blue-400', 
                border: 'border-blue-200 dark:border-blue-800',
                line: 'bg-blue-200 dark:bg-blue-800'
            };

        // Default / Notes
        return { 
            icon: 'edit_note', 
            bg: 'bg-gray-100 dark:bg-gray-800', 
            text: 'text-gray-500 dark:text-gray-400', 
            border: 'border-gray-200 dark:border-gray-700',
            line: 'bg-gray-200 dark:bg-gray-700'
        };
    };

    // --- Map Logic ---
    useEffect(() => {
        if (request.location && window.L) {
            setTimeout(() => {
                if (mapContainerRef.current) {
                    if (mapInstanceRef.current) mapInstanceRef.current.remove();
                    
                    const map = window.L.map(mapContainerRef.current, { zoomControl: false });
                    
                    // Remove Leaflet Prefix
                    if (map.attributionControl) {
                      map.attributionControl.setPrefix(false);
                    }

                    map.setView([request.location!.lat, request.location!.lng], 17);
                    
                    // UPDATED TO OPENSTREETMAP STANDARD
                    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
                        maxZoom: 19,
                        attribution: '&copy; OpenStreetMap' 
                    }).addTo(map);
                    
                    // --- CUSTOM ICON USING SERVICE DATA ---
                    const iconIsImg = isUrl(request.icon);
                    
                    const iconHtml = `
                        <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                            <div class="${request.iconBg || 'bg-white'} ${request.iconColor || 'text-slate-600'}" style="
                                width: 64px; 
                                height: 64px; 
                                border-radius: 16px; 
                                display: flex; 
                                align-items: center; 
                                justify-content: center; 
                                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
                                border: 3px solid white;
                                overflow: hidden;
                            ">
                                ${iconIsImg 
                                    ? `<img src="${request.icon}" style="width: 100%; height: 100%; object-fit: contain; padding: 8px;" />`
                                    : `<span class="material-symbols-outlined" style="font-size: 32px; font-variation-settings: 'FILL' 1;">${request.icon}</span>`
                                }
                            </div>
                            <div style="
                                width: 0; 
                                height: 0; 
                                border-left: 10px solid transparent;
                                border-right: 10px solid transparent;
                                border-top: 12px solid white;
                                margin-top: -1px;
                                filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1));
                            "></div>
                            <div style="
                                position: absolute;
                                bottom: -10px;
                                width: 30px;
                                height: 8px;
                                background: rgba(0,0,0,0.2);
                                border-radius: 50%;
                                filter: blur(3px);
                                z-index: -1;
                            "></div>
                        </div>
                    `;

                    const icon = window.L.divIcon({
                        className: 'custom-req-icon', // Just a marker class
                        html: iconHtml,
                        iconSize: [64, 80], // Width, Height (Box + Pointer)
                        iconAnchor: [32, 78], // Center X, Bottom Y
                    });
                    
                    window.L.marker([request.location!.lat, request.location!.lng], { icon }).addTo(map);
                    mapInstanceRef.current = map;
                }
            }, 300); // Delay for layout shift
        }
    }, [request, isMapExpanded]);

    // --- BUILD HISTORY TIMELINE ---
    let combinedHistory = request.history ? [...request.history] : [];
    const hasCreationEvent = combinedHistory.some(h => h.title === 'Ocorrência Recebida' || h.status === 'Recebido');
    if (!hasCreationEvent) {
        combinedHistory.push({
            status: 'Recebido',
            title: 'Ocorrência Recebida',
            description: `Abertura de protocolo inicial.`,
            author: request.userName || 'Cidadão',
            date: request.date
        });
    }
    const getTime = (dateObj: any) => {
        if (!dateObj) return 0;
        if (dateObj.toDate) return dateObj.toDate().getTime();
        if (dateObj.seconds) return dateObj.seconds * 1000;
        if (dateObj instanceof Date) return dateObj.getTime();
        return 0;
    };
    const sortedHistory = combinedHistory.sort((a, b) => getTime(b.date) - getTime(a.date));

    return (
        <div className="max-w-6xl mx-auto animate-in slide-in-from-right-8 duration-500 pb-12 w-full">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
                </button>
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">Detalhes da Ocorrência</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">ID: #{request.id.slice(0,8).toUpperCase()}</p>
                </div>
                <div className="ml-auto flex gap-3">
                     <button 
                        onClick={handleDelete} 
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-2"
                    >
                        {isDeleting ? (
                            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                        )}
                        Excluir
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Details... */}
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                        <div className="flex items-start gap-4 mb-6">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${isImg ? 'bg-white border border-gray-100' : request.iconBg} ${request.iconColor} overflow-hidden`}>
                                {isImg ? (
                                    <img src={request.icon} className="w-full h-full object-contain p-2" />
                                ) : (
                                    <span className="material-symbols-outlined text-4xl">{request.icon}</span>
                                )}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{request.title}</h3>
                                <div className="flex flex-wrap gap-2 text-sm text-slate-500">
                                    <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
                                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                        {formatDate(request.date)}
                                    </span>
                                    <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
                                        <span className="material-symbols-outlined text-[14px]">person</span>
                                        {request.userName || 'Anônimo'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 mb-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Descrição do Cidadão</h4>
                            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{request.description}</p>
                        </div>

                        {/* Evidence Gallery */}
                        {request.photos && request.photos.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Evidências Anexadas</h4>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                    {request.photos.map((photo, i) => (
                                        <div key={i} onClick={() => setFullScreenImage(photo)} className="aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90 transition-opacity relative group">
                                            <img src={photo} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="material-symbols-outlined text-white">zoom_in</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Location Card - INCREASED HEIGHT */}
                    {request.location && (
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">map</span> Localização da Ocorrência
                                </h4>
                                <button onClick={() => setIsMapExpanded(!isMapExpanded)} className="text-blue-600 text-xs font-bold hover:underline">
                                    {isMapExpanded ? 'Reduzir Mapa' : 'Expandir Mapa'}
                                </button>
                            </div>
                            <div ref={mapContainerRef} className={`w-full transition-all duration-300 ${isMapExpanded ? 'h-[600px]' : 'h-80'} bg-slate-200`}></div>
                            <div className="p-3 bg-white dark:bg-[#1e293b] text-sm text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-700">
                                <span className="font-bold">Endereço:</span> {request.address}
                            </div>
                        </div>
                    )}

                    {/* Timeline History */}
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-6 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                             <span className="material-symbols-outlined text-primary">history</span>
                             Histórico de Tramitação
                        </h3>
                        
                        <div className="relative pl-2">
                            {/* Vertical Line */}
                            <div className="absolute top-2 bottom-6 left-[1.35rem] w-0.5 bg-slate-200 dark:bg-slate-700"></div>

                            <div className="space-y-6">
                                {sortedHistory.map((item, index) => {
                                    const style = getHistoryStyle(item.title, item.status);
                                    return (
                                        <div key={index} className="relative flex gap-4 group">
                                            {/* Icon Dot */}
                                            <div className={`relative z-10 w-11 h-11 rounded-full flex items-center justify-center shrink-0 border-4 border-white dark:border-[#1e293b] shadow-sm ${style.bg} ${style.text}`}>
                                                <span className="material-symbols-outlined text-[20px]">{style.icon}</span>
                                            </div>
                                            
                                            {/* Content */}
                                            <div className={`flex-1 p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/30 ${style.border} transition-colors`}>
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className={`text-sm font-bold ${style.text}`}>{item.title}</h4>
                                                    <span className="text-[10px] font-mono text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700 shrink-0">
                                                        {item.date ? formatDateFull(item.date) : 'Data N/A'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug mb-2">{item.description}</p>
                                                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                                                    <span className="material-symbols-outlined text-[14px] text-slate-400">person</span>
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{item.author || 'Sistema'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Actions */}
                <div className="space-y-6">
                    
                    {/* Status Management - REMOVIDO STICKY PARA FICAR ESTÁTICO */}
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Gestão de Status</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Situação Atual</label>
                                <select 
                                    value={updateStatus} 
                                    onChange={(e) => setUpdateStatus(e.target.value)} 
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary cursor-pointer font-medium"
                                >
                                    <option value="Aberto">Aberto</option>
                                    <option value="Em Análise">Em Análise</option>
                                    <option value="Agendado">Agendado</option>
                                    <option value="Concluído">Concluído</option>
                                    <option value="Rejeitado">Rejeitado</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Nota de Atualização (Pública)</label>
                                <textarea 
                                    value={updateNote} 
                                    onChange={(e) => setUpdateNote(e.target.value)} 
                                    rows={3}
                                    placeholder="Ex: Equipe deslocada para o local... (Obrigatório para o histórico)"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                                ></textarea>
                                <p className="text-[10px] text-primary mt-1 font-medium flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">notifications_active</span>
                                    Esta nota será enviada ao cidadão via notificação.
                                </p>
                            </div>

                            {showSuccess ? (
                                <div className="w-full bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg flex flex-col items-center justify-center gap-1 animate-in zoom-in-95 text-center px-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[24px]">check_circle</span>
                                        <span>Status Atualizado!</span>
                                    </div>
                                    <span className="text-[10px] opacity-90 font-medium">Notificação e nota enviadas ao app.</span>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleUpdate} 
                                    disabled={isUpdating}
                                    className="w-full bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 text-white font-bold py-3 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    {isUpdating ? <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> : <span className="material-symbols-outlined text-[20px]">send</span>}
                                    Confirmar e Notificar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Department Info & Transfer */}
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Responsabilidade</h3>
                        
                        <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-500 shadow-sm border border-slate-100 dark:border-slate-600">
                                <span className="material-symbols-outlined">{getSecretariatObject(request.department)?.icon || 'business'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Setor Atual</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={getSecretariatName(request.department)}>
                                    {getSecretariatName(request.department)}
                                </p>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Tramitar para outro setor</label>
                                <div className="relative">
                                    <select 
                                        value={transferTargetId} 
                                        onChange={(e) => setTransferTargetId(e.target.value)} 
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer"
                                    >
                                        <option value="">Selecione o destino...</option>
                                        {secretariats.map(sec => (
                                            <option key={sec.id} value={sec.id} disabled={sec.id === request.department}>
                                                {sec.name}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">expand_more</span>
                                </div>
                            </div>

                            <button 
                                onClick={handleTransfer}
                                disabled={isTransferring || !transferTargetId}
                                className={`w-full py-2.5 rounded-xl border text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                                    transferTargetId 
                                    ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600 shadow-md' 
                                    : 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed bg-slate-50 dark:bg-slate-800'
                                }`}
                            >
                                {isTransferring ? (
                                    <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                                ) : (
                                    <span className="material-symbols-outlined text-[16px]">move_up</span>
                                )}
                                Confirmar Tramitação
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {/* Image Lightbox */}
            {fullScreenImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setFullScreenImage(null)}>
                    <button className="absolute top-4 right-4 text-white hover:text-gray-300"><span className="material-symbols-outlined text-4xl">close</span></button>
                    <img src={fullScreenImage} className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
};

export default AdminRequestsDetails;
