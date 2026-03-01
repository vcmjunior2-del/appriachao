
import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { CityPlace } from '../../types';

const AdminCityGuide: React.FC = () => {
    const { currentUser } = useAuth();
    const [places, setPlaces] = useState<CityPlace[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form State
    const defaultForm: CityPlace = {
        name: '', category: 'Úteis', description: '', phone: '', address: '', image: '', mapLink: ''
    };
    const [formData, setFormData] = useState<CityPlace>(defaultForm);
    
    // Image Upload
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const categories = ['Úteis', 'Saúde', 'Educação', 'Hospedagem', 'Gastronomia', 'Comércio', 'Lazer'];

    useEffect(() => {
        if (!currentUser || (currentUser.email !== 'administracao@riachaodojacuipe.ba.gov.br' && !currentUser.isAnonymous)) return;
        
        const unsub = onSnapshot(collection(db, "city_places"), (snap) => {
            setPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() } as CityPlace)));
        }, (error) => console.log("AdminCityGuide restricted"));
        return () => unsub();
    }, [currentUser]);

    const handleNew = () => {
        setFormData(defaultForm);
        setImageFile(null);
        setImagePreview(null);
        setIsEditing(true);
    };

    const handleEdit = (place: CityPlace) => {
        setFormData(place);
        setImageFile(null);
        setImagePreview(place.image || null);
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Excluir este local?")) await deleteDoc(doc(db, "city_places", id));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!formData.name) return alert("Nome é obrigatório.");
        setIsSaving(true);
        try {
            let finalImage = formData.image;
            if (imageFile) {
                const storageRef = ref(storage, `city_places/${Date.now()}_${imageFile.name}`);
                await uploadBytes(storageRef, imageFile);
                finalImage = await getDownloadURL(storageRef);
            }

            const dataToSave = { ...formData, image: finalImage || '' };

            if (formData.id) {
                await setDoc(doc(db, "city_places", formData.id), dataToSave, { merge: true });
            } else {
                const { id, ...data } = dataToSave;
                await addDoc(collection(db, "city_places"), data);
            }
            setIsEditing(false);
            alert("Salvo com sucesso!");
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isEditing) {
        return (
            <div className="max-w-2xl mx-auto animate-in slide-in-from-right-8 duration-500 pb-10">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsEditing(false)} className="size-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
                        </button>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{formData.id ? 'Editar Local' : 'Novo Local'}</h2>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-5">
                    
                    {/* Image Upload */}
                    <div className="flex flex-col items-center mb-4">
                        <div 
                            className="relative w-full h-48 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden group hover:border-primary/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {imagePreview ? (
                                <img src={imagePreview} className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex flex-col items-center text-slate-400">
                                    <span className="material-symbols-outlined text-4xl mb-2">add_photo_alternate</span>
                                    <span className="text-xs font-bold uppercase">Adicionar Foto</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-xs font-bold uppercase tracking-wider">Alterar</span>
                            </div>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nome do Local</label>
                            <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary" placeholder="Ex: Hospital Municipal" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Categoria</label>
                            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary">
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Telefone</label>
                            <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary" placeholder="(75) 9999-9999" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Endereço</label>
                            <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary" placeholder="Rua, Número, Bairro" />
                        </div>
                    </div>

                    <button onClick={handleSave} disabled={isSaving} className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        {isSaving ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <span className="material-symbols-outlined text-lg">check</span>}
                        Salvar Local
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">Guia da Cidade</h2>
                    <p className="text-slate-500 dark:text-slate-400">Cadastre telefones úteis e locais de interesse público.</p>
                </div>
                <button onClick={handleNew} className="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center gap-2">
                    <span className="material-symbols-outlined">add_location_alt</span> Novo Local
                </button>
            </div>

            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Local</th>
                            <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</th>
                            <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Contato</th>
                            <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {places.map(place => (
                            <tr key={place.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                            {place.image ? <img src={place.image} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-slate-400">place</span>}
                                        </div>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">{place.name}</span>
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">{place.category}</span>
                                </td>
                                <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-300">{place.phone || '-'}</td>
                                <td className="py-4 px-6 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => handleEdit(place)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><span className="material-symbols-outlined text-lg">edit</span></button>
                                        <button onClick={() => handleDelete(place.id!)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><span className="material-symbols-outlined text-lg">delete</span></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {places.length === 0 && (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-500">Nenhum local cadastrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminCityGuide;
