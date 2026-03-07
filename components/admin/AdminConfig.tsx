
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { AppConfig } from '../../types';

const AdminConfig: React.FC = () => {
    const [appConfig, setAppConfig] = useState<AppConfig>({
        appName: 'Riachão',
        municipalityName: 'Prefeitura Municipal de Riachão do Jacuípe',
        logoUrl: '',
        welcomeBackgroundUrl: '',
        supportEmail: '',
        supportPhone: '',
        maintenanceMode: false
    });
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "app_config", "general"), 
            (docSnap) => {
                if (docSnap.exists()) setAppConfig(docSnap.data() as AppConfig);
            },
            (error) => console.error("AdminConfig Error:", error)
        );
        return () => unsub();
    }, []);

    const handleSaveConfig = async () => {
        setIsSavingConfig(true);
        try {
            await setDoc(doc(db, "app_config", "general"), appConfig, { merge: true });
            alert("Salvo!");
        } catch (e) { alert("Erro."); } finally { setIsSavingConfig(false); }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploadingLogo(true);
        try {
            const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            setAppConfig(prev => ({ ...prev, logoUrl: downloadURL }));
        } catch (e) {
            console.error(e);
            alert("Erro ao fazer upload da logo.");
        } finally {
            setIsUploadingLogo(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-in fade-in duration-500 pb-10">
            <div className="mb-8"><h2 className="text-3xl font-black text-slate-900 dark:text-white">Configurações</h2></div>
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nome do Aplicativo</label>
                    <input value={appConfig.appName} onChange={(e) => setAppConfig({...appConfig, appName: e.target.value})} placeholder="Nome App" className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nome da Prefeitura / Órgão</label>
                    <input value={appConfig.municipalityName} onChange={(e) => setAppConfig({...appConfig, municipalityName: e.target.value})} placeholder="Nome Prefeitura" className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Logo do Aplicativo</label>
                    <div className="flex items-center gap-4">
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-blue-700" />
                        {isUploadingLogo && <span className="text-sm text-slate-500">Enviando...</span>}
                    </div>
                    {appConfig.logoUrl && (
                        <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center h-24 w-24">
                            <img 
                                src={appConfig.logoUrl} 
                                alt="Logo Preview" 
                                className="max-w-full max-h-full object-contain" 
                                referrerPolicy="no-referrer"
                            />
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">URL da Imagem de Fundo (Tela de Boas-vindas)</label>
                    <input value={appConfig.welcomeBackgroundUrl} onChange={(e) => setAppConfig({...appConfig, welcomeBackgroundUrl: e.target.value})} placeholder="URL Fundo" className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white font-mono text-sm" />
                </div>
                <button onClick={handleSaveConfig} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl">{isSavingConfig ? "Salvando..." : "Salvar"}</button>
            </div>
        </div>
    );
};

export default AdminConfig;
