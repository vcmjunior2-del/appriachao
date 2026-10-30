
import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, isAdminUser } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { OccurrenceSubject, Secretariat } from '../../types';

const AdminSubjects: React.FC = () => {
    const { currentUser } = useAuth();
    const [subjects, setSubjects] = useState<OccurrenceSubject[]>([]);
    const [secretariats, setSecretariats] = useState<Secretariat[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState<OccurrenceSubject>({
        title: '', secretariatId: '', description: '', icon: 'folder', colorTheme: 'blue', active: true
    });
    
    // Image Upload State
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // AUTH GUARD: Allow strict admin email OR anonymous (demo)
        if (!isAdminUser(currentUser)) return;

        const unsubSub = onSnapshot(collection(db, "occurrence_subjects"), 
            s => setSubjects(s.docs.map(d => ({id: d.id, ...d.data()} as OccurrenceSubject))),
            error => console.log("AdminSubjects restricted")
        );
        const unsubSec = onSnapshot(collection(db, "secretariats"), 
            s => setSecretariats(s.docs.map(d => ({id: d.id, ...d.data()} as Secretariat))),
            error => console.log("AdminSubjects Secretariats restricted")
        );
        return () => { unsubSub(); unsubSec(); };
    }, [currentUser]);

    const handleNew = () => {
        setFormData({ title: '', secretariatId: '', description: '', icon: 'folder', colorTheme: 'blue', active: true });
        setIconFile(null);
        setIconPreview(null);
        setIsEditing(true);
    };

    const handleEdit = (s: OccurrenceSubject) => {
        setFormData(s);
        setIconFile(null);
        // Check if icon is a URL (custom image) or text (font)
        if (s.icon.startsWith('http')) {
            setIconPreview(s.icon);
        } else {
            setIconPreview(null);
        }
        setIsEditing(true);
    };

    const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIconFile(file);
            setIconPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!formData.title) return alert("O título é obrigatório.");
        if (!formData.secretariatId) return alert("Selecione uma secretaria responsável.");
        
        setIsSaving(true);
        try {
            let finalIcon = formData.icon;

            // Upload Icon if a new file was selected
            if (iconFile) {
                const storageRef = ref(storage, `subject_icons/${Date.now()}_${iconFile.name}`);
                await uploadBytes(storageRef, iconFile);
                finalIcon = await getDownloadURL(storageRef);
            }

            const dataToSave = { ...formData, icon: finalIcon };

            if (formData.id) {
                await setDoc(doc(db, "occurrence_subjects", formData.id), dataToSave, { merge: true });
            } else {
                const { id, ...data } = dataToSave;
                await addDoc(collection(db, "occurrence_subjects"), data);
            }
            
            setIsEditing(false);
            alert("Assunto salvo com sucesso!");
        } catch(e) { 
            console.error(e);
            alert("Erro ao salvar assunto."); 
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => { if(confirm("Tem certeza que deseja excluir este Assunto?")) await deleteDoc(doc(db, "occurrence_subjects", id)); };
    const getSecretariatName = (id: string) => secretariats.find(s => s.id === id)?.name || 'N/A';
    const isUrl = (str: string) => str.includes('http') || str.includes('data:');

    // --- Helper: Preview Colors ---
    const getThemeColors = (theme?: string) => {
        switch(theme) {
            case 'blue': return 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50';
            case 'green': return 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50';
            case 'red': return 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50';
            case 'yellow': return 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50';
            case 'purple': return 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/50';
            case 'orange': return 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/50';
            default: return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-700';
        }
    };

    if (isEditing) {
        return (
            <div className="max-w-4xl mx-auto animate-in slide-in-from-right-8 duration-500 pb-12">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsEditing(false)} className="size-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
                        </button>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{formData.id ? 'Editar Assunto' : 'Novo Assunto'}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Este será o ícone principal de acesso no app.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                        <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                            {isSaving ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <span className="material-symbols-outlined text-lg">check</span>} 
                            Salvar Assunto
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Form Data */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Card: Basic Info */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">info</span> Informações do Assunto
                            </h3>
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Título do Assunto</label>
                                    <input 
                                        value={formData.title} 
                                        onChange={(e) => setFormData({...formData, title: e.target.value})} 
                                        placeholder="Ex: Iluminação Pública, Limpeza Urbana..." 
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-slate-400" 
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Secretaria Responsável</label>
                                        <div className="relative">
                                            <select 
                                                value={formData.secretariatId} 
                                                onChange={(e) => setFormData({...formData, secretariatId: e.target.value})} 
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none appearance-none transition-all cursor-pointer"
                                            >
                                                <option value="">Selecione...</option>
                                                {secretariats.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Tema (Cor)</label>
                                        <div className="relative">
                                            <select 
                                                value={formData.colorTheme} 
                                                onChange={(e) => setFormData({...formData, colorTheme: e.target.value as any})} 
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none appearance-none transition-all cursor-pointer"
                                            >
                                                <option value="blue">Azul</option>
                                                <option value="green">Verde</option>
                                                <option value="red">Vermelho</option>
                                                <option value="yellow">Amarelo</option>
                                                <option value="purple">Roxo</option>
                                                <option value="orange">Laranja</option>
                                                <option value="gray">Cinza</option>
                                            </select>
                                            <div className={`absolute right-10 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-${formData.colorTheme === 'blue' ? 'blue' : formData.colorTheme === 'green' ? 'emerald' : formData.colorTheme === 'red' ? 'red' : formData.colorTheme === 'yellow' ? 'amber' : formData.colorTheme === 'orange' ? 'orange' : formData.colorTheme === 'purple' ? 'purple' : 'slate'}-500`}></div>
                                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Exemplos de Ocorrências (Descrição)</label>
                                    <textarea 
                                        value={formData.description} 
                                        onChange={(e) => setFormData({...formData, description: e.target.value})} 
                                        rows={3} 
                                        placeholder="Ex: Reparo de lâmpadas, troca de reatores, postes caídos..."
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none resize-none transition-all placeholder:text-slate-400"
                                    ></textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Visuals & Status */}
                    <div className="space-y-6">
                        
                        {/* Icon Upload */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">image</span> Ícone do App
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
                                    Recomendado: PNG Transparente (512x512).
                                </p>

                                {!iconPreview && (
                                    <div className="w-full mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Ou use ícone do Google Fonts</label>
                                        <div className="flex gap-2">
                                            <input 
                                                value={isUrl(formData.icon) ? '' : formData.icon} 
                                                onChange={(e) => setFormData({...formData, icon: e.target.value})} 
                                                placeholder="Ex: folder" 
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
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Assunto Ativo?</p>
                                <p className="text-xs text-slate-500">Visível no menu de ocorrências</p>
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
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">Assuntos de Ocorrência</h2>
                    <p className="text-slate-500 dark:text-slate-400">Gerencie os ícones principais de acesso no aplicativo móvel.</p>
                </div>
                <button onClick={handleNew} className="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 active:scale-95 transition-all">
                    <span className="material-symbols-outlined">add_circle</span>
                    Novo Assunto
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subjects.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">folder_off</span>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum assunto cadastrado</h3>
                    </div>
                )}
                {subjects.map((subject) => {
                    const iconIsUrl = isUrl(subject.icon);
                    return (
                        <div key={subject.id} className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 group relative overflow-hidden">
                            {!subject.active && (
                                <div className="absolute top-0 right-0 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl z-10">INATIVO</div>
                            )}
                            <div className="flex items-start gap-4">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border ${getThemeColors(subject.colorTheme)}`}>
                                    {iconIsUrl ? (
                                        <img src={subject.icon} alt="Icon" className="w-full h-full object-contain p-2" />
                                    ) : (
                                        <span className="material-symbols-outlined text-3xl">{subject.icon}</span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-slate-900 dark:text-white leading-tight mb-1 truncate" title={subject.title}>{subject.title}</h3>
                                    <p className="text-xs text-primary font-bold uppercase tracking-wide truncate">{getSecretariatName(subject.secretariatId)}</p>
                                </div>
                            </div>
                            
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 h-10 leading-relaxed">{subject.description}</p>
                            
                            <div className="pt-4 mt-auto border-t border-slate-100 dark:border-slate-700 flex gap-2">
                                <button onClick={() => handleEdit(subject)} className="flex-1 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-sm">edit</span> Editar
                                </button>
                                <button onClick={() => handleDelete(subject.id!)} className="w-10 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
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

export default AdminSubjects;
