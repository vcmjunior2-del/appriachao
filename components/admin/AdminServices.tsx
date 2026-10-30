
import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, isAdminUser } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { ServiceTypeDefinition, Secretariat, OccurrenceSubject } from '../../types';

const AdminServices: React.FC = () => {
    const { currentUser } = useAuth();
    const [serviceTypes, setServiceTypes] = useState<ServiceTypeDefinition[]>([]);
    const [secretariats, setSecretariats] = useState<Secretariat[]>([]);
    const [subjects, setSubjects] = useState<OccurrenceSubject[]>([]);
    const [isEditingService, setIsEditingService] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState<ServiceTypeDefinition>({
        title: '', secretariatId: '', subjectId: '', description: '', icon: 'assignment', colorTheme: 'blue', requiresLocation: true, requiresPhoto: true, active: true
    });
    
    // Image Upload State
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // AUTH GUARD
        if (!isAdminUser(currentUser)) return;

        const unsubServ = onSnapshot(collection(db, "service_types"), 
            s => setServiceTypes(s.docs.map(d => ({id: d.id, ...d.data()} as ServiceTypeDefinition))),
            error => console.log("AdminServices Types restricted")
        );
        const unsubSec = onSnapshot(collection(db, "secretariats"), 
            s => setSecretariats(s.docs.map(d => ({id: d.id, ...d.data()} as Secretariat))),
            error => console.log("AdminServices Secretariats restricted")
        );
        const unsubSub = onSnapshot(collection(db, "occurrence_subjects"), 
            s => setSubjects(s.docs.map(d => ({id: d.id, ...d.data()} as OccurrenceSubject))),
            error => console.log("AdminServices Subjects restricted")
        );
        return () => { unsubServ(); unsubSec(); unsubSub(); };
    }, [currentUser]);

    const handleNewService = () => {
        setFormData({ title: '', secretariatId: '', subjectId: '', description: '', icon: 'assignment', colorTheme: 'blue', requiresLocation: true, requiresPhoto: true, active: true });
        setIconFile(null);
        setIconPreview(null);
        setIsEditingService(true);
    };

    const handleEditService = (s: ServiceTypeDefinition) => {
        setFormData(s);
        setIconFile(null);
        // Check if icon is a URL (custom image) or text (font)
        if (s.icon.startsWith('http')) {
            setIconPreview(s.icon);
        } else {
            setIconPreview(null);
        }
        setIsEditingService(true);
    };

    const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIconFile(file);
            setIconPreview(URL.createObjectURL(file));
        }
    };

    // Auto-fill Secretariat when Subject is selected
    const handleSubjectChange = (subjectId: string) => {
        const subject = subjects.find(s => s.id === subjectId);
        setFormData(prev => ({
            ...prev,
            subjectId: subjectId,
            secretariatId: subject ? subject.secretariatId : prev.secretariatId
        }));
    };

    const handleSaveService = async () => {
        if (!formData.title) return alert("O título é obrigatório.");
        if (!formData.secretariatId) return alert("Selecione uma secretaria responsável (ou vincule a um Assunto).");
        
        setIsSaving(true);
        try {
            let finalIcon = formData.icon;

            // Upload Icon if a new file was selected
            if (iconFile) {
                const storageRef = ref(storage, `service_icons/${Date.now()}_${iconFile.name}`);
                await uploadBytes(storageRef, iconFile);
                finalIcon = await getDownloadURL(storageRef);
            }

            const dataToSave = { ...formData, icon: finalIcon };

            if (formData.id) {
                await setDoc(doc(db, "service_types", formData.id), dataToSave, { merge: true });
            } else {
                const { id, ...data } = dataToSave;
                await addDoc(collection(db, "service_types"), data);
            }
            
            setIsEditingService(false);
            alert("Ocorrência salva com sucesso!");
        } catch(e) { 
            console.error(e);
            alert("Erro ao salvar ocorrência."); 
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteService = async (id: string) => { if(confirm("Tem certeza que deseja excluir este tipo de ocorrência?")) await deleteDoc(doc(db, "service_types", id)); };
    const getSecretariatName = (id: string) => secretariats.find(s => s.id === id)?.name || 'N/A';
    const getSubjectName = (id?: string) => subjects.find(s => s.id === id)?.title || '-';
    const isUrl = (str: string) => str.includes('http') || str.includes('data:');

    if (isEditingService) {
        return (
            <div className="max-w-4xl mx-auto animate-in slide-in-from-right-8 duration-500 pb-12">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsEditingService(false)} className="size-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
                        </button>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{formData.id ? 'Editar Ocorrência' : 'Nova Ocorrência'}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Configure os detalhes do serviço disponível ao cidadão.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsEditingService(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                        <button onClick={handleSaveService} disabled={isSaving} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                            {isSaving ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <span className="material-symbols-outlined text-lg">check</span>} 
                            Salvar Dados
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Form Data */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Card: Classification */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">category</span> Classificação
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Assunto Principal</label>
                                    <div className="relative">
                                        <select 
                                            value={formData.subjectId || ''} 
                                            onChange={(e) => handleSubjectChange(e.target.value)} 
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none appearance-none transition-all cursor-pointer"
                                        >
                                            <option value="">(Opcional) Selecione o Assunto...</option>
                                            {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Vincular a um Assunto preenche a Secretaria automaticamente.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Secretaria Responsável</label>
                                    <div className="relative">
                                        <select 
                                            value={formData.secretariatId} 
                                            onChange={(e) => setFormData({...formData, secretariatId: e.target.value})} 
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none appearance-none transition-all cursor-pointer"
                                        >
                                            <option value="">Selecione a Secretaria...</option>
                                            {secretariats.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card: Basic Info */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">info</span> Detalhes da Ocorrência
                            </h3>
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Título da Ocorrência</label>
                                    <input 
                                        value={formData.title} 
                                        onChange={(e) => setFormData({...formData, title: e.target.value})} 
                                        placeholder="Ex: Lâmpada Queimada, Buraco na Via..." 
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-slate-400" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Descrição para o Cidadão</label>
                                    <textarea 
                                        value={formData.description} 
                                        onChange={(e) => setFormData({...formData, description: e.target.value})} 
                                        rows={3} 
                                        placeholder="Descreva brevemente o que este serviço resolve..."
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none resize-none transition-all placeholder:text-slate-400"
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Cor do Cartão (Tema)</label>
                                    <div className="flex flex-wrap gap-3">
                                        {['blue', 'green', 'red', 'yellow', 'purple', 'orange', 'gray'].map((color) => (
                                            <button 
                                                key={color} 
                                                onClick={() => setFormData({...formData, colorTheme: color as any})} 
                                                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ring-2 ring-offset-2 dark:ring-offset-slate-900 ${formData.colorTheme === color ? 'ring-slate-400 scale-110' : 'ring-transparent'}`} 
                                                style={{ backgroundColor: color === 'gray' ? '#64748b' : `var(--color-${color}-500, ${color})` }}
                                            >
                                                <div className={`w-full h-full rounded-full ${color === 'blue' ? 'bg-blue-500' : color === 'green' ? 'bg-emerald-500' : color === 'red' ? 'bg-red-500' : color === 'yellow' ? 'bg-amber-500' : color === 'purple' ? 'bg-purple-500' : color === 'orange' ? 'bg-orange-500' : 'bg-slate-500'}`}></div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card: Requirements */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">settings</span> Requisitos de Abertura
                            </h3>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <label className="flex-1 flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                                            <span className="material-symbols-outlined">location_on</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">Exigir Localização</p>
                                            <p className="text-xs text-slate-500">GPS ou Mapa obrigatório</p>
                                        </div>
                                    </div>
                                    <input type="checkbox" checked={formData.requiresLocation} onChange={e => setFormData({...formData, requiresLocation: e.target.checked})} className="w-5 h-5 rounded text-primary focus:ring-primary border-gray-300" />
                                </label>

                                <label className="flex-1 flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-lg">
                                            <span className="material-symbols-outlined">photo_camera</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">Exigir Foto</p>
                                            <p className="text-xs text-slate-500">Anexo de evidência obrigatório</p>
                                        </div>
                                    </div>
                                    <input type="checkbox" checked={formData.requiresPhoto} onChange={e => setFormData({...formData, requiresPhoto: e.target.checked})} className="w-5 h-5 rounded text-primary focus:ring-primary border-gray-300" />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Visuals & Status */}
                    <div className="space-y-6">
                        
                        {/* Icon Upload */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">image</span> Ícone Personalizado
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
                                
                                <p className="text-xs text-slate-400 text-center mt-3 leading-relaxed">
                                    Recomendado: PNG Transparente (512x512).<br/>
                                    Se não enviar, será usado um ícone padrão.
                                </p>

                                {!iconPreview && (
                                    <div className="w-full mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Ou use ícone do Google Fonts</label>
                                        <div className="flex gap-2">
                                            <input 
                                                value={isUrl(formData.icon) ? '' : formData.icon} 
                                                onChange={(e) => setFormData({...formData, icon: e.target.value})} 
                                                placeholder="Ex: lightbulb" 
                                                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none"
                                            />
                                            <a href="https://fonts.google.com/icons" target="_blank" rel="noreferrer" className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 hover:text-primary"><span className="material-symbols-outlined">open_in_new</span></a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Toggle */}
                        <div className="bg-slate-100 dark:bg-[#0f172a] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Ocorrência Ativa?</p>
                                <p className="text-xs text-slate-500">Disponível no app</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                            </label>
                        </div>

                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">Tipos de Ocorrência</h2>
                    <p className="text-slate-500 dark:text-slate-400">Defina os problemas que os cidadãos podem reportar no aplicativo.</p>
                </div>
                <button onClick={handleNewService} className="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 active:scale-95 transition-all">
                    <span className="material-symbols-outlined">add_circle</span>
                    Nova Ocorrência
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {serviceTypes.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">folder_off</span>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum tipo cadastrado</h3>
                    </div>
                )}
                {serviceTypes.map((service) => {
                    const iconIsUrl = isUrl(service.icon);
                    const subjectName = getSubjectName(service.subjectId);
                    
                    return (
                        <div key={service.id} className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 group relative overflow-hidden">
                            {!service.active && (
                                <div className="absolute top-0 right-0 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl z-10">INATIVO</div>
                            )}
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shrink-0 overflow-hidden">
                                    {iconIsUrl ? (
                                        <img src={service.icon} alt="Icon" className="w-full h-full object-contain p-2" />
                                    ) : (
                                        <span className="material-symbols-outlined text-3xl text-slate-600 dark:text-slate-400">{service.icon}</span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-slate-900 dark:text-white leading-tight mb-1 truncate" title={service.title}>{service.title}</h3>
                                    
                                    {/* Display Subject if available, else Secretariat */}
                                    <div className="flex flex-col gap-0.5">
                                        {service.subjectId && (
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold truncate flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[10px]">folder</span> {subjectName}
                                            </p>
                                        )}
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide truncate">{getSecretariatName(service.secretariatId)}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 h-10 leading-relaxed">{service.description}</p>
                            
                            <div className="pt-4 mt-auto border-t border-slate-100 dark:border-slate-700 flex gap-2">
                                <button onClick={() => handleEditService(service)} className="flex-1 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-sm">edit</span> Editar
                                </button>
                                <button onClick={() => handleDeleteService(service.id!)} className="w-10 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AdminServices;
