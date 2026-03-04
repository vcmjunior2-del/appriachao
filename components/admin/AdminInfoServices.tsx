
import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, deleteDoc, setDoc, addDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { InfoServiceDefinition } from '../../types';

interface AdminInfoServicesProps {
    viewMode: 'INFO_OVERVIEW' | 'INFO_CATALOG' | 'INFO_NEW_FOLDER' | 'INFO_NEW_DOC';
}

const AdminInfoServices: React.FC<AdminInfoServicesProps> = ({ viewMode }) => {
    const { currentUser } = useAuth();
    
    // Internal state mapped from props
    const [internalView, setInternalView] = useState<'OVERVIEW' | 'LIST' | 'FORM'>('OVERVIEW');
    
    const [infoServicesList, setInfoServicesList] = useState<InfoServiceDefinition[]>([]);
    
    // --- Folder Navigation State ---
    const [currentParentId, setCurrentParentId] = useState<string | null>(null);
    const [folderHistory, setFolderHistory] = useState<InfoServiceDefinition[]>([]);
    
    // Form & Upload State
    const defaultService: InfoServiceDefinition = {
        title: '', description: '', icon: 'article', colorTheme: 'blue', 
        actionType: 'LINK_WEB', actionConfig: '', active: true, 
        isFolder: false, parentId: null
    };
    
    const [formData, setFormData] = useState<InfoServiceDefinition>(defaultService);
    const [isSaving, setIsSaving] = useState(false);
    
    // Image Upload State
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Delete Modal State
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Mock Stats State
    const [stats, setStats] = useState({
        totalItems: 0,
        folders: 0,
        activeLinks: 0,
        trackers: 0
    });

    // --- Sync Prop with Internal State ---
    useEffect(() => {
        if (viewMode === 'INFO_NEW_FOLDER') {
            handleNew(true); 
        } else if (viewMode === 'INFO_NEW_DOC') {
            handleNew(false);
        } else if (viewMode === 'INFO_CATALOG') {
            setInternalView('LIST');
            // Reset navigation when entering catalog from menu, optional
            // setCurrentParentId(null); 
            // setFolderHistory([]);
        } else {
            setInternalView('OVERVIEW');
        }
    }, [viewMode]);

    useEffect(() => {
        // AUTH GUARD
        if (!currentUser || (currentUser.email !== 'administracao@riachaodojacuipe.ba.gov.br' && !currentUser.isAnonymous)) return;

        const unsub = onSnapshot(collection(db, "info_services"), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as InfoServiceDefinition));
            setInfoServicesList(data);
            
            setStats({
                totalItems: data.length,
                folders: data.filter(i => i.isFolder).length,
                activeLinks: data.filter(i => !i.isFolder && i.active).length,
                trackers: data.filter(i => i.actionType === 'TRACKER_BANNER').length
            });
        }, (error) => console.log("AdminInfoServices restricted"));
        return () => unsub();
    }, [currentUser]);

    // --- Navigation Logic ---
    const handleEnterFolder = (folder: InfoServiceDefinition) => {
        setFolderHistory([...folderHistory, folder]);
        setCurrentParentId(folder.id!);
    };

    const handleNavigateBack = () => {
        const newHistory = [...folderHistory];
        newHistory.pop(); // Remove current folder
        setFolderHistory(newHistory);
        
        const parentFolder = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
        setCurrentParentId(parentFolder ? parentFolder.id! : null);
    };

    const getCurrentFolderName = () => {
        if (currentParentId && folderHistory.length > 0) {
            return folderHistory[folderHistory.length - 1].title;
        }
        return 'Raiz';
    };

    // --- Filtering Logic ---
    const displayedServices = infoServicesList.filter(s => {
        // If root, show items with no parentId OR parentId is null/empty string
        if (!currentParentId) return !s.parentId;
        // If folder selected, show children
        return s.parentId === currentParentId;
    });

    // --- Actions ---

    const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIconFile(file);
            setIconPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!formData.title) return alert("O título é obrigatório.");
        setIsSaving(true);
        try {
            let finalIcon = formData.icon;

            // Upload Icon if selected
            if (iconFile) {
                const storageRef = ref(storage, `service_icons/${Date.now()}_${iconFile.name}`);
                await uploadBytes(storageRef, iconFile);
                finalIcon = await getDownloadURL(storageRef);
            }

            // Logic cleanup
            const payload = { ...formData, icon: finalIcon };
            if (payload.isFolder) {
                payload.actionType = 'INTERNAL_ROUTE';
                // If user didn't upload custom icon and icon is default 'article', switch to 'folder'
                if (!payload.icon.includes('http') && payload.icon === 'article') {
                    payload.icon = 'folder';
                }
            }
            if (payload.parentId === '') payload.parentId = null;

            if (payload.id) await setDoc(doc(db, "info_services", payload.id), payload, { merge: true });
            else { const { id, ...data } = payload; await addDoc(collection(db, "info_services"), data); }
            
            setInternalView('LIST');
            // Stay in the current folder after save if possible, or reset form
            setFormData(defaultService);
            setIconFile(null);
            setIconPreview(null);
            alert("Salvo com sucesso!");
        } catch (error) { 
            console.error(error);
            alert("Erro ao salvar serviço."); 
        } finally { setIsSaving(false); }
    };

    const handleEdit = (service: InfoServiceDefinition) => { 
        setFormData(service); 
        setIconFile(null);
        if (service.icon && service.icon.startsWith('http')) {
            setIconPreview(service.icon);
        } else {
            setIconPreview(null);
        }
        setInternalView('FORM'); 
    };
    
    // --- Delete Logic ---
    const handleDeleteClick = (id: string) => {
        if (!id) return;
        
        // Check if folder has children before deleting
        const children = infoServicesList.filter(s => s.parentId === id);
        if (children.length > 0) {
            alert(`Não é possível excluir esta pasta pois ela contém ${children.length} itens. Exclua ou mova os itens primeiro.`);
            return;
        }

        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, "info_services", deleteId));
            setDeleteId(null);
        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert("Erro ao excluir do banco de dados.");
        } finally {
            setIsDeleting(false);
        }
    };
    
    const handleNew = (isFolder: boolean) => { 
        setFormData({
            ...defaultService,
            isFolder: isFolder,
            icon: isFolder ? 'folder' : 'article',
            parentId: currentParentId // Auto-set parent if inside a folder
        }); 
        setIconFile(null);
        setIconPreview(null);
        setInternalView('FORM'); 
    };

    const isUrl = (str: string) => str && (str.includes('http') || str.includes('data:'));

    // --- Helper: Preview Colors (Updated with 'none') ---
    const getColorPreview = (theme: string) => {
        const colors: any = {
            blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-200' },
            green: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-200' },
            red: { bg: 'bg-red-50', icon: 'text-red-600', border: 'border-red-200' },
            yellow: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-200' },
            purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-200' },
            orange: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-200' },
            gray: { bg: 'bg-slate-50', icon: 'text-slate-600', border: 'border-slate-200' },
            none: { bg: 'bg-white', icon: 'text-slate-700', border: 'border-slate-200' } // New Neutral
        };
        return colors[theme] || colors.gray;
    };

    // Derived Title based on form state
    const formTitle = formData.id 
        ? (formData.isFolder ? 'Editar Pasta' : 'Editar Documento') 
        : (formData.isFolder ? 'Nova Pasta' : 'Novo Documento');

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12 relative">
            
            {/* Header & Title */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6">
                <div className="flex items-center gap-4">
                    {internalView === 'FORM' && (
                        <button onClick={() => setInternalView('LIST')} className="size-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
                        </button>
                    )}
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">
                            {internalView === 'OVERVIEW' ? 'Portal de Serviços' : 
                             internalView === 'LIST' ? 'Catálogo Completo' : 
                             formTitle}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            {internalView === 'OVERVIEW' ? 'Visão geral do portal do cidadão.' : 
                             internalView === 'LIST' ? 'Gerencie todos os itens do portal.' : 
                             formData.isFolder ? 'Crie um grupo para organizar serviços.' : 'Adicione um novo serviço ou link útil.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* --- VIEW: OVERVIEW --- */}
            {internalView === 'OVERVIEW' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Total de Itens</p>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stats.totalItems}</h3>
                            </div>
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><span className="material-symbols-outlined">grid_view</span></div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Pastas (Categorias)</p>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stats.folders}</h3>
                            </div>
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><span className="material-symbols-outlined">folder</span></div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Links Ativos</p>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stats.activeLinks}</h3>
                            </div>
                            <div className="p-3 bg-green-50 text-green-600 rounded-xl"><span className="material-symbols-outlined">link</span></div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Trackers (Banners)</p>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stats.trackers}</h3>
                            </div>
                            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><span className="material-symbols-outlined">local_shipping</span></div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- VIEW: LIST (CATALOG) --- */}
            {internalView === 'LIST' && (
                <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                    
                    {/* Breadcrumbs Navigation */}
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#1e293b] p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                        {currentParentId ? (
                            <button 
                                onClick={handleNavigateBack}
                                className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm">arrow_back</span>
                                Voltar
                            </button>
                        ) : (
                            <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">home</span>
                                Raiz
                            </div>
                        )}
                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {currentParentId && <span className="material-symbols-outlined text-amber-500 text-lg">folder_open</span>}
                            {getCurrentFolderName()}
                        </span>
                        
                        {/* Context Action: Create inside current folder */}
                        <div className="ml-auto flex gap-2">
                            <button 
                                onClick={() => handleNew(true)} 
                                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white/50 transition-colors"
                                title="Criar Pasta aqui"
                            >
                                <span className="material-symbols-outlined text-sm text-amber-500">create_new_folder</span>
                                <span className="hidden md:inline">Nova Pasta</span>
                            </button>
                            <button 
                                onClick={() => handleNew(false)} 
                                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white/50 transition-colors"
                                title="Criar Documento aqui"
                            >
                                <span className="material-symbols-outlined text-sm text-blue-500">note_add</span>
                                <span className="hidden md:inline">Novo Doc</span>
                            </button>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayedServices.map((service) => {
                            const colors = getColorPreview(service.colorTheme);
                            const isTracker = service.actionType === 'TRACKER_BANNER';
                            const iconIsImg = isUrl(service.icon);

                            return (
                                <div key={service.id} className={`group bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col ${isTracker ? 'border-l-4 border-l-emerald-500' : ''}`}>
                                    {!service.active && <div className="absolute top-0 right-0 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">INATIVO</div>}
                                    
                                    {/* Main Click Area: Enters folder if folder, otherwise does nothing (edit button handles edits) */}
                                    <div 
                                        className={`flex-1 ${service.isFolder ? 'cursor-pointer' : ''}`}
                                        onClick={() => service.isFolder && handleEnterFolder(service)}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${colors.bg} dark:bg-slate-800 ${colors.icon} overflow-hidden border ${colors.border} dark:border-slate-700`}>
                                                    {iconIsImg ? (
                                                        <img src={service.icon} className="w-full h-full object-contain p-2" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-3xl">{service.icon}</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-bold text-slate-900 dark:text-white leading-tight truncate pr-2 group-hover:text-primary transition-colors">{service.title}</h3>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {service.isFolder && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">folder</span> PASTA</span>}
                                                        {isTracker && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">BANNER</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 min-h-[2.5rem] mb-4 leading-relaxed">{service.description}</p>
                                    </div>
                                    
                                    <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-auto">
                                        {service.isFolder && (
                                            <button onClick={() => handleEnterFolder(service)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold text-white bg-slate-800 hover:bg-black transition-colors shadow-sm">
                                                <span className="material-symbols-outlined text-base">open_in_new</span> Abrir
                                            </button>
                                        )}
                                        <button onClick={() => handleEdit(service)} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${service.isFolder ? 'px-4 bg-slate-100 dark:bg-slate-800' : 'flex-1 bg-slate-100 dark:bg-slate-800'}`}>
                                            <span className="material-symbols-outlined text-base">edit</span> {service.isFolder ? '' : 'Editar'}
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteClick(service.id!)} 
                                            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                                            title="Excluir"
                                        >
                                            <span className="material-symbols-outlined text-base">delete</span>
                                            <span className="hidden sm:inline">Excluir</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {displayedServices.length === 0 && (
                            <div className="col-span-3 text-center py-20 text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">folder_open</span>
                                <p>Esta pasta está vazia.</p>
                                <button onClick={() => handleNew(false)} className="mt-4 text-primary font-bold text-sm hover:underline">Criar primeiro item aqui</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- VIEW: FORM (NEW/EDIT) --- */}
            {internalView === 'FORM' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-8 duration-500">
                    <div className="lg:col-span-2 space-y-6">
                        {formData.id && (
                            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-sm">category</span> Tipo de Item</h3>
                                <div className="flex gap-4">
                                    <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${!formData.isFolder ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                        <div className="flex items-center gap-3">
                                            <input type="radio" checked={!formData.isFolder} onChange={() => setFormData({...formData, isFolder: false})} className="sr-only" />
                                            <span className={`material-symbols-outlined ${!formData.isFolder ? 'text-primary' : 'text-slate-400'}`}>article</span>
                                            <div>
                                                <p className={`font-bold text-sm ${!formData.isFolder ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>Documento / Serviço</p>
                                            </div>
                                        </div>
                                    </label>
                                    <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.isFolder ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                        <div className="flex items-center gap-3">
                                            <input type="radio" checked={formData.isFolder} onChange={() => setFormData({...formData, isFolder: true})} className="sr-only" />
                                            <span className={`material-symbols-outlined ${formData.isFolder ? 'text-primary' : 'text-slate-400'}`}>folder</span>
                                            <div>
                                                <p className={`font-bold text-sm ${formData.isFolder ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>Pasta (Grupo)</p>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Basic Info */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-sm">edit</span> Informações Gerais</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Título</label>
                                    <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none" placeholder={formData.isFolder ? "Ex: Transparência" : "Ex: 2ª Via do IPTU"} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Descrição Curta</label>
                                    <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none resize-none" placeholder="Descrição breve para o usuário..." rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Dentro da Pasta (Pai)</label>
                                    <select 
                                        value={formData.parentId || ''} 
                                        onChange={(e) => setFormData({...formData, parentId: e.target.value || null})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                                    >
                                        <option value="">(Raiz / Sem Pai)</option>
                                        {infoServicesList.filter(s => s.isFolder && s.id !== formData.id).map(f => (
                                            <option key={f.id} value={f.id!}>📁 {f.title}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1">Selecione "Raiz" para aparecer na tela inicial de Serviços.</p>
                                </div>
                            </div>
                        </div>

                        {/* Configuration (Only if NOT a folder) */}
                        {!formData.isFolder && (
                            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-sm">link</span> Destino / Ação</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Tipo de Ação</label>
                                        <select className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none" value={formData.actionType} onChange={e => setFormData({...formData, actionType: e.target.value as any})}>
                                            <option value="LINK_WEB">Link Externo (Web)</option>
                                            <option value="TRACKER_BANNER">Banner: Rota do Lixo</option>
                                            <option value="INTERNAL_FORM">Formulário Interno</option>
                                            <option value="STATIC_PAGE">Página Estática</option>
                                        </select>
                                    </div>
                                    {formData.actionType === 'LINK_WEB' && (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">URL do Site</label>
                                            <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono text-sm" placeholder="https://..." value={formData.actionConfig} onChange={e => setFormData({...formData, actionConfig: e.target.value})} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-sm">palette</span> Aparência</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Cor do Tema</label>
                                    <div className="flex flex-wrap gap-3">
                                        {[
                                            { id: 'none', color: '#e2e8f0' }, // Default
                                            { id: 'blue', color: '#3b82f6' },
                                            { id: 'green', color: '#10b981' },
                                            { id: 'red', color: '#ef4444' },
                                            { id: 'yellow', color: '#f59e0b' },
                                            { id: 'purple', color: '#a855f7' },
                                            { id: 'orange', color: '#f97316' },
                                            { id: 'gray', color: '#64748b' }
                                        ].map((item) => (
                                            <button key={item.id} onClick={() => setFormData({...formData, colorTheme: item.id as any})} className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ring-2 ring-offset-2 dark:ring-offset-slate-900 ${formData.colorTheme === item.id ? 'ring-slate-400 scale-110' : 'ring-transparent'}`} style={{ backgroundColor: item.color }} title={item.id === 'none' ? 'Padrão (Sem cor)' : item.id}>
                                                {item.id === 'none' && <span className="material-symbols-outlined text-slate-500 text-[16px] flex items-center justify-center h-full">block</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Visuals */}
                    <div className="space-y-6">
                        
                        {/* Icon Upload */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">image</span> Ícone do Card
                            </h3>
                            
                            <div className="flex flex-col items-center">
                                <div 
                                    className="relative w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center cursor-pointer group overflow-hidden"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {iconPreview ? (
                                        <img src={iconPreview} alt="Ícone" className="w-full h-full object-contain p-4" />
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2">cloud_upload</span>
                                            <span className="text-xs font-bold uppercase">Enviar Ícone</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white text-xs font-bold uppercase tracking-wider">Alterar</span>
                                    </div>
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleIconChange} className="hidden" accept="image/*" />
                                
                                <p className="text-xs text-slate-400 text-center mt-3">Recomendado: PNG Transparente.</p>

                                {!iconPreview && (
                                    <div className="w-full mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Ou use ícone do Google Fonts</label>
                                        <div className="flex gap-2">
                                            <input 
                                                value={isUrl(formData.icon) ? '' : formData.icon} 
                                                onChange={(e) => setFormData({...formData, icon: e.target.value})} 
                                                placeholder="Ex: article" 
                                                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none"
                                            />
                                            <a href="https://fonts.google.com/icons" target="_blank" rel="noreferrer" className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 hover:text-primary"><span className="material-symbols-outlined">open_in_new</span></a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Preview Box */}
                        <div className="bg-slate-100 dark:bg-[#0f172a] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-center">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Pré-visualização</p>
                            
                            <div className={`relative flex flex-col items-start p-4 rounded-2xl bg-white dark:bg-[#1a2230] border ${getColorPreview(formData.colorTheme).border} dark:border-slate-700 shadow-md h-auto min-h-[140px] text-left w-full max-w-[280px] mx-auto`}>
                                <div className="flex justify-between w-full items-start mb-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${getColorPreview(formData.colorTheme).bg} dark:bg-slate-800 ${getColorPreview(formData.colorTheme).icon} shadow-inner overflow-hidden border border-slate-100 dark:border-slate-700`}>
                                        {iconPreview ? (
                                            <img src={iconPreview} className="w-full h-full object-contain p-2" />
                                        ) : (
                                            <span className="material-symbols-outlined text-2xl">{formData.icon || (formData.isFolder ? 'folder' : 'article')}</span>
                                        )}
                                    </div>
                                    <span className="material-symbols-outlined text-gray-300 text-sm">
                                        {formData.isFolder ? 'chevron_right' : 'open_in_new'}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight mb-1 line-clamp-2">{formData.title || (formData.isFolder ? 'Nome da Pasta' : 'Título do Serviço')}</h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{formData.description || 'Descrição breve...'}</p>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between px-4">
                                <span className="text-xs font-bold text-slate-500">Ativo?</span>
                                <input type="checkbox" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="scale-125" />
                            </div>
                        </div>

                        <button onClick={handleSave} disabled={isSaving} className="w-full py-4 rounded-xl text-sm font-bold bg-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                            {isSaving ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <span className="material-symbols-outlined text-lg">check</span>} Salvar Alterações
                        </button>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700 relative">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-500 mb-4 border border-red-200 dark:border-red-900/50">
                                <span className="material-symbols-outlined text-3xl">delete_forever</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Excluir Item?</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                Esta ação <strong>não pode ser desfeita</strong>. O item será removido permanentemente do catálogo de serviços.
                            </p>
                        </div>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteId(null)}
                                disabled={isDeleting}
                                className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-colors flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                ) : (
                                    <>
                                        <span>Confirmar</span>
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

export default AdminInfoServices;
