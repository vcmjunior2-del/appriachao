
import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { CityPlace, CityPlaceSubCategory } from '../../types';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapUpdater = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

function MapPicker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });
    return position ? <Marker position={position} /> : null;
}

const AdminCityGuide: React.FC = () => {
    const { currentUser } = useAuth();
    const [places, setPlaces] = useState<CityPlace[]>([]);
    const [subCategories, setSubCategories] = useState<CityPlaceSubCategory[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isManagingSubCats, setIsManagingSubCats] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // SubCategory Form
    const [editingSubCatId, setEditingSubCatId] = useState<string | null>(null);
    const [newSubCatName, setNewSubCatName] = useState('');
    const [newSubCatCategory, setNewSubCatCategory] = useState<CityPlace['category']>('Lazer');
    const [newSubCatIconUrl, setNewSubCatIconUrl] = useState('');
    const [newSubCatColor, setNewSubCatColor] = useState('#3b82f6');
    const [isUploadingIcon, setIsUploadingIcon] = useState(false);
    const iconInputRef = useRef<HTMLInputElement>(null);
    
    // Form State
    const defaultForm: CityPlace = {
        name: '', category: 'Úteis', subCategoryId: '', description: '', phone: '', address: '', image: '', mapLink: ''
    };
    const [formData, setFormData] = useState<CityPlace>(defaultForm);
    
    // Image Upload
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const categories = ['Úteis', 'Saúde', 'Educação', 'Hospedagem', 'Gastronomia', 'Comércio', 'Lazer', 'Religião'];

    useEffect(() => {
        if (!currentUser || (currentUser.email !== 'administracao@riachaodojacuipe.ba.gov.br' && !currentUser.isAnonymous)) return;
        
        const unsubPlaces = onSnapshot(collection(db, "city_places"), (snap) => {
            setPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() } as CityPlace)));
        }, (error) => console.log("AdminCityGuide restricted"));

        const unsubSubCats = onSnapshot(collection(db, "city_place_subcategories"), (snap) => {
            setSubCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as CityPlaceSubCategory)));
        }, (error) => console.warn("AdminCityGuide SubCats restricted:", error));

        return () => {
            unsubPlaces();
            unsubSubCats();
        };
    }, [currentUser]);

    const handleAddSubCat = async () => {
        if (!newSubCatName) return;
        try {
            const data = {
                name: newSubCatName,
                category: newSubCatCategory,
                icon: newSubCatIconUrl,
                color: newSubCatColor
            };
            if (editingSubCatId) {
                await setDoc(doc(db, "city_place_subcategories", editingSubCatId), data, { merge: true });
                setEditingSubCatId(null);
            } else {
                await addDoc(collection(db, "city_place_subcategories"), data);
            }
            setNewSubCatName('');
            setNewSubCatIconUrl('');
        } catch (e) {
            console.error(e);
        }
    };

    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setIsUploadingIcon(true);
        try {
            const file = e.target.files[0];
            const storageRef = ref(storage, `city_place_icons/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setNewSubCatIconUrl(url);
        } catch (e) {
            console.error(e);
            alert("Erro ao fazer upload do ícone.");
        } finally {
            setIsUploadingIcon(false);
        }
    };

    const handleDeleteSubCat = async (id: string) => {
        if (confirm("Excluir esta pasta? Locais vinculados a ela continuarão existindo mas sem pasta.")) {
            await deleteDoc(doc(db, "city_place_subcategories", id));
        }
    };

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

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Pasta / Subcategoria (Opcional)</label>
                        <select 
                            value={formData.subCategoryId || ''} 
                            onChange={e => setFormData({...formData, subCategoryId: e.target.value})} 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="">Nenhuma (Local Solto)</option>
                            {subCategories.filter(sc => sc.category === formData.category).map(sc => (
                                <option key={sc.id} value={sc.id}>{sc.name}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">Selecione uma pasta pré-cadastrada para agrupar este local.</p>
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

                    <div className="mb-5">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Localização no Mapa (Clique para marcar)</label>
                        <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                            <MapContainer center={[-11.8061, -39.3853]} zoom={13} className="h-full w-full">
                                <MapUpdater />
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <MapPicker 
                                    position={formData.lat && formData.lng ? [Number(formData.lat), Number(formData.lng)] : null} 
                                    setPosition={(pos) => setFormData({...formData, lat: pos[0], lng: pos[1]})} 
                                />
                            </MapContainer>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-slate-500">
                            <span>Lat: {formData.lat ? Number(formData.lat).toFixed(6) : 'N/A'}</span>
                            <span>Lng: {formData.lng ? Number(formData.lng).toFixed(6) : 'N/A'}</span>
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
                <div className="flex gap-3">
                    <button onClick={() => setIsManagingSubCats(true)} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-all">
                        <span className="material-symbols-outlined">folder_managed</span> Gerenciar Pastas
                    </button>
                    <button onClick={handleNew} className="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center gap-2">
                        <span className="material-symbols-outlined">add_location_alt</span> Novo Local
                    </button>
                </div>
            </div>

            {/* SubCategory Management Modal */}
            {isManagingSubCats && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-[#1e293b] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Gerenciar Pastas</h3>
                            <button onClick={() => setIsManagingSubCats(false)} className="size-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Nova Pasta</label>
                                <div className="flex flex-col gap-2">
                                    <select 
                                        value={newSubCatCategory} 
                                        onChange={e => setNewSubCatCategory(e.target.value as any)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none text-sm"
                                    >
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <input 
                                                value={newSubCatName} 
                                                onChange={e => setNewSubCatName(e.target.value)}
                                                placeholder="Nome da pasta..."
                                                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none text-sm"
                                            />
                                            <input 
                                                type="color"
                                                value={newSubCatColor} 
                                                onChange={e => setNewSubCatColor(e.target.value)}
                                                className="w-12 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                                            />
                                            <button 
                                                onClick={() => iconInputRef.current?.click()}
                                                className="bg-slate-100 dark:bg-slate-800 p-2 rounded-xl text-slate-500 hover:text-primary transition-colors"
                                            >
                                                {isUploadingIcon ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : <span className="material-symbols-outlined">upload</span>}
                                            </button>
                                            <input type="file" ref={iconInputRef} onChange={handleIconUpload} className="hidden" accept="image/*" />
                                        </div>
                                        {newSubCatIconUrl && <img src={newSubCatIconUrl} className="w-10 h-10 rounded-lg object-cover" />}
                                        <button 
                                            onClick={handleAddSubCat}
                                            className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-600 transition-colors"
                                        >
                                            {editingSubCatId ? 'Atualizar' : 'Adicionar'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                                {subCategories.length === 0 ? (
                                    <p className="text-center py-4 text-slate-400 text-sm italic">Nenhuma pasta cadastrada.</p>
                                ) : (
                                    subCategories.sort((a,b) => a.category.localeCompare(b.category)).map(sc => (
                                        <div key={sc.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white text-sm">{sc.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">{sc.category}</p>
                                            </div>
                                            <button onClick={() => {
                                                setEditingSubCatId(sc.id!);
                                                setNewSubCatName(sc.name);
                                                setNewSubCatCategory(sc.category);
                                                setNewSubCatIconUrl(sc.icon || '');
                                                setNewSubCatColor(sc.color || '#3b82f6');
                                            }} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-1.5 rounded-lg transition-colors">
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button onClick={() => handleDeleteSubCat(sc.id!)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors">
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                    <div className="flex flex-col">
                                        <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase w-fit">{place.category}</span>
                                        {place.subCategoryId && (
                                            <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 ml-1">
                                                📁 {subCategories.find(sc => sc.id === place.subCategoryId)?.name || 'Pasta não encontrada'}
                                            </span>
                                        )}
                                    </div>
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
