
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { db, isAdminUser } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Secretariat, ServiceTypeDefinition } from '../../types';

const AdminSecretariats: React.FC = () => {
    const { currentUser } = useAuth();
    const [secretariats, setSecretariats] = useState<Secretariat[]>([]);
    const [serviceTypes, setServiceTypes] = useState<ServiceTypeDefinition[]>([]);
    const [isEditingSecretariat, setIsEditingSecretariat] = useState(false);
    const [newSecretariat, setNewSecretariat] = useState<Secretariat>({
        id: '', name: '', manager: '', icon: 'business'
    });

    useEffect(() => {
        // AUTH GUARD
        if (!isAdminUser(currentUser)) return;

        const unsubSec = onSnapshot(collection(db, "secretariats"), 
            s => setSecretariats(s.docs.map(d => ({id: d.id, ...d.data()} as Secretariat))),
            error => console.log("AdminSecretariats restricted")
        );
        const unsubServ = onSnapshot(collection(db, "service_types"), 
            s => setServiceTypes(s.docs.map(d => ({id: d.id, ...d.data()} as ServiceTypeDefinition))),
            error => console.log("AdminServiceTypes restricted")
        );
        return () => { unsubSec(); unsubServ(); };
    }, [currentUser]);

    const handleSaveSecretariat = async () => {
        if (!newSecretariat.name) return alert("Nome obrigatório");
        try {
            if (newSecretariat.id) await setDoc(doc(db, "secretariats", newSecretariat.id), newSecretariat, { merge: true });
            else { const { id, ...data } = newSecretariat; await addDoc(collection(db, "secretariats"), data); }
            setIsEditingSecretariat(false);
            setNewSecretariat({ id: '', name: '', manager: '', icon: 'business' });
            alert("Salvo!");
        } catch(e) { alert("Erro"); }
    };

    const handleEditSecretariat = (s: Secretariat) => { setNewSecretariat(s); setIsEditingSecretariat(true); };
    const handleDeleteSecretariat = async (id: string) => { if(confirm("Excluir?")) await deleteDoc(doc(db, "secretariats", id)); };

    if (isEditingSecretariat) {
        return (
            <div className="max-w-xl mx-auto animate-in slide-in-from-right-8 duration-500">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setIsEditingSecretariat(false)} className="size-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"><span className="material-symbols-outlined">arrow_back</span></button>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{newSecretariat.id ? 'Editar Secretaria' : 'Cadastro de Secretaria'}</h2>
                </div>
                <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
                    <input type="text" value={newSecretariat.name} onChange={(e) => setNewSecretariat({...newSecretariat, name: e.target.value})} placeholder="Nome do Órgão" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none" />
                    <input type="text" value={newSecretariat.manager} onChange={(e) => setNewSecretariat({...newSecretariat, manager: e.target.value})} placeholder="Gestor Responsável" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none" />
                    <input type="text" value={newSecretariat.icon} onChange={(e) => setNewSecretariat({...newSecretariat, icon: e.target.value})} placeholder="Ícone (Google Fonts)" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none" />
                    <button onClick={handleSaveSecretariat} className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">Salvar Secretaria</button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">Secretarias e Órgãos</h2>
                    <p className="text-slate-500 dark:text-slate-400">Gerencie os departamentos responsáveis.</p>
                </div>
                <button onClick={() => { setIsEditingSecretariat(true); setNewSecretariat({ id: '', name: '', manager: '', icon: 'business' }); }} className="bg-primary hover:bg-blue-600 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center gap-2"><span className="material-symbols-outlined">add</span>Nova Secretaria</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {secretariats.map((sec) => (
                    <div key={sec.id} className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 group">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"><span className="material-symbols-outlined text-3xl">{sec.icon}</span></div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 dark:text-white truncate">{sec.name}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{sec.manager}</p>
                            <p className="text-xs text-primary mt-1">{serviceTypes.filter(s => s.secretariatId === sec.id).length} serviços vinculados</p>
                        </div>
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditSecretariat(sec)} className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg"><span className="material-symbols-outlined text-sm">edit</span></button>
                            <button onClick={() => handleDeleteSecretariat(sec.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg"><span className="material-symbols-outlined text-sm">delete</span></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminSecretariats;
