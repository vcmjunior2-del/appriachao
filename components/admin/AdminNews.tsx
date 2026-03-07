
import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, deleteDoc, setDoc, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { NewsItem } from '../../types';

const AdminNews: React.FC = () => {
    const { currentUser } = useAuth();
    const [newsList, setNewsList] = useState<NewsItem[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form State
    const defaultForm: NewsItem = {
        title: '', description: '', imageUrl: '', videoUrl: '', tag: '', colorTheme: 'blue', date: null, active: true
    };
    const [formData, setFormData] = useState<NewsItem>(defaultForm);
    
    // Image Upload
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Video Upload
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // AUTH GUARD
        if (!currentUser || (currentUser.email !== 'administracao@riachaodojacuipe.ba.gov.br' && !currentUser.isAnonymous)) return;

        const q = query(collection(db, "news"), orderBy("date", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setNewsList(snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem)));
        }, (error) => console.log("AdminNews restricted"));
        return () => unsub();
    }, [currentUser]);

    const handleNew = () => {
        setFormData(defaultForm);
        setImageFile(null);
        setImagePreview(null);
        setVideoFile(null);
        setIsEditing(true);
    };

    const handleEdit = (item: NewsItem) => {
        setFormData(item);
        setImageFile(null);
        setImagePreview(item.imageUrl || null);
        setVideoFile(null);
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Excluir esta notícia permanentemente?")) await deleteDoc(doc(db, "news", id));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!formData.title) return alert("O título é obrigatório.");
        if (!formData.description) return alert("A descrição é obrigatória.");
        
        setIsSaving(true);
        try {
            let finalImageUrl = formData.imageUrl;

            // Upload Image if selected
            if (imageFile) {
                const sanitizedName = imageFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
                const storageRef = ref(storage, `news_images/${Date.now()}_${sanitizedName}`);
                await uploadBytes(storageRef, imageFile);
                finalImageUrl = await getDownloadURL(storageRef);
            }

            let finalVideoUrl = formData.videoUrl;
            // Upload Video if selected
            if (videoFile) {
                const sanitizedName = videoFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
                const storageRef = ref(storage, `news_videos/${Date.now()}_${sanitizedName}`);
                await uploadBytes(storageRef, videoFile);
                finalVideoUrl = await getDownloadURL(storageRef);
            }

            const dataToSave = { 
                ...formData, 
                imageUrl: finalImageUrl,
                videoUrl: finalVideoUrl,
                date: formData.date || serverTimestamp() // Preserve original date on edit, or new on create
            };

            if (formData.id) {
                await setDoc(doc(db, "news", formData.id), dataToSave, { merge: true });
            } else {
                const { id, ...data } = dataToSave;
                await addDoc(collection(db, "news"), data);
            }
            
            setIsEditing(false);
            alert("Salvo com sucesso!");
        } catch(e) { 
            console.error(e);
            alert("Erro ao salvar destaque."); 
        } finally {
            setIsSaving(false);
        }
    };

    // Helper for styles
    const getTagStyle = (theme: string) => {
        switch(theme) {
            case 'blue': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
            case 'green': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
            case 'red': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
            case 'yellow': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
            case 'purple': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
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
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{formData.id ? 'Editar Destaque' : 'Novo Destaque'}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Notícias que aparecem na tela inicial do app.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                        <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                            {isSaving ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <span className="material-symbols-outlined text-lg">check</span>} 
                            Publicar
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Form */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Título da Manchete</label>
                                <input 
                                    value={formData.title} 
                                    onChange={(e) => setFormData({...formData, title: e.target.value})} 
                                    placeholder="Ex: Campanha de Vacinação Inicia Amanhã" 
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-slate-400" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Resumo / Subtítulo</label>
                                <textarea 
                                    value={formData.description} 
                                    onChange={(e) => setFormData({...formData, description: e.target.value})} 
                                    rows={3} 
                                    placeholder="Texto curto que aparece abaixo do título..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none resize-none transition-all placeholder:text-slate-400"
                                ></textarea>
                            </div>
                            
                            {/* Video Upload */}
                            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">videocam</span> Vídeo (Opcional)
                                </h3>
                                <div 
                                    className="relative w-full h-48 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden group hover:border-primary/50 transition-colors"
                                    onClick={() => videoInputRef.current?.click()}
                                >
                                    {videoFile ? (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2">movie</span>
                                            <span className="text-xs font-bold uppercase">{videoFile.name}</span>
                                        </div>
                                    ) : formData.videoUrl ? (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2">movie</span>
                                            <span className="text-xs font-bold uppercase">Vídeo já carregado</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2">add_to_photos</span>
                                            <span className="text-xs font-bold uppercase">Carregar Vídeo</span>
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={videoInputRef} onChange={(e) => e.target.files && setVideoFile(e.target.files[0])} className="hidden" accept="video/*" />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Tag (Categoria)</label>
                                    <input 
                                        value={formData.tag} 
                                        onChange={(e) => setFormData({...formData, tag: e.target.value})} 
                                        placeholder="Ex: Saúde, Obras..." 
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Cor da Tag</label>
                                    <select 
                                        value={formData.colorTheme} 
                                        onChange={(e) => setFormData({...formData, colorTheme: e.target.value as any})} 
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="blue">Azul (Informativo)</option>
                                        <option value="green">Verde (Saneamento/Ambiente)</option>
                                        <option value="red">Vermelho (Urgente/Saúde)</option>
                                        <option value="yellow">Amarelo (Atenção/Obras)</option>
                                        <option value="purple">Roxo (Cultura/Eventos)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Image Upload */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">image</span> Imagem de Capa
                            </h3>
                            <div 
                                className="relative w-full h-48 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden group hover:border-primary/50 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {imagePreview ? (
                                    <div className="w-full h-full relative">
                                        <img src={imagePreview} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-white text-xs font-bold uppercase tracking-wider">Alterar Imagem</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400">
                                        <span className="material-symbols-outlined text-4xl mb-2">add_photo_alternate</span>
                                        <span className="text-xs font-bold uppercase">Carregar Imagem</span>
                                    </div>
                                )}
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                        </div>
                    </div>

                    {/* Right: Preview */}
                    <div className="space-y-6">
                        <div className="bg-slate-100 dark:bg-[#0f172a] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 sticky top-6">
                            <div className="flex justify-between items-center mb-6">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pré-visualização (App)</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Visível?</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} />
                                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                                    </label>
                                </div>
                            </div>
                            
                            {/* Card Simulation */}
                            <div className="relative w-full aspect-[4/3] rounded-2xl bg-white dark:bg-card-dark shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden group">
                                <div className="absolute top-3 left-3 z-10">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-sm ${getTagStyle(formData.colorTheme)}`}>
                                        {formData.tag || 'Geral'}
                                    </span>
                                </div>
                                <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: imagePreview ? `url("${imagePreview}")` : 'none', backgroundColor: '#e2e8f0' }}>
                                    {!imagePreview && <div className="w-full h-full flex items-center justify-center text-slate-400"><span className="material-symbols-outlined text-4xl">image</span></div>}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full p-4">
                                    <h4 className="font-bold text-white text-lg leading-tight mb-1 drop-shadow-md line-clamp-2">{formData.title || 'Título da Notícia'}</h4>
                                    <p className="text-gray-200 text-xs line-clamp-1 mb-2 opacity-90">{formData.description || 'Descrição da notícia aparecerá aqui...'}</p>
                                    <div className="flex items-center gap-2 text-gray-300 text-[10px] font-medium">
                                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                                        <span>Agora mesmo</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">Destaques e Notícias</h2>
                    <p className="text-slate-500 dark:text-slate-400">Gerencie o conteúdo do carrossel principal do aplicativo.</p>
                </div>
                <button onClick={handleNew} className="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95">
                    <span className="material-symbols-outlined">add_circle</span> Novo Destaque
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {newsList.map((item) => (
                    <div key={item.id} className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">
                        <div className="relative h-40 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400"><span className="material-symbols-outlined text-4xl">newspaper</span></div>
                            )}
                            <div className="absolute top-3 left-3">
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-sm ${getTagStyle(item.colorTheme)}`}>
                                    {item.tag}
                                </span>
                            </div>
                            {!item.active && (
                                <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                                    <span className="bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-bold uppercase">Rascunho / Inativo</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-5 flex-1 flex flex-col">
                            <h3 className="font-bold text-slate-900 dark:text-white leading-tight mb-2 line-clamp-2">{item.title}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">{item.description}</p>
                            
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                                <button onClick={() => handleEdit(item)} className="flex-1 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-sm">edit</span> Editar
                                </button>
                                <button onClick={() => handleDelete(item.id!)} className="w-10 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {newsList.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">feed</span>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhuma notícia publicada</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminNews;
