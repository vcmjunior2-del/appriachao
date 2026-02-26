
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebaseConfig';
import { UserItem, Screen } from '../types';
import { useAlert } from '../contexts/AlertContext';

interface ProfileScreenProps {
  onLogout: () => void;
  onNavigate: (screen: Screen) => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout, onNavigate }) => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState<UserItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showAlert } = useAlert();

  // Form State
  const [editName, setEditName] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editCity, setEditCity] = useState('');

  // Photo Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserItem;
        setUserData(data);
        setEditName(data.name || '');
        setEditStreet(data.street || '');
        setEditNumber(data.number || '');
        setEditNeighborhood(data.neighborhood || '');
        setEditCity(data.city || 'Riachão do Jacuípe');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleLogout = async () => {
    try { await auth.signOut(); onLogout(); } catch (error) { console.error("Error logging out", error); }
  };

  const handleSaveProfile = async () => {
      if (!currentUser || !userData) return;
      setIsSaving(true);
      try {
          const userRef = doc(db, "users", currentUser.uid);
          const fullAddress = `${editStreet}, ${editNumber || 'S/N'} - ${editNeighborhood}, ${editCity}`;
          await updateDoc(userRef, { name: editName, street: editStreet, number: editNumber, neighborhood: editNeighborhood, city: editCity, address: fullAddress });
          if (editName !== currentUser.displayName) await currentUser.updateProfile({ displayName: editName });
          setIsEditing(false);
      } catch (error) { console.error("Erro ao atualizar perfil:", error); showAlert({ message: "Erro ao salvar alterações.", type: 'error' }); } finally { setIsSaving(false); }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && currentUser) {
          const file = e.target.files[0];
          setUploadingPhoto(true);
          try {
              const storageRef = ref(storage, `profile_photos/${currentUser.uid}`);
              // Fix: Explicitly set metadata to avoid storage/unknown errors
              const metadata = { contentType: file.type };
              await uploadBytes(storageRef, file, metadata);
              const photoURL = await getDownloadURL(storageRef);
              await currentUser.updateProfile({ photoURL });
              await updateDoc(doc(db, "users", currentUser.uid), { photoURL });
          } catch (error: any) {
              console.error("Erro upload foto:", error);
              showAlert({ message: `Erro ao atualizar foto: ${error.message || 'Tente novamente.'}`, type: 'error' });
          } finally { setUploadingPhoto(false); }
      }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-background-light dark:bg-background-dark"><span className="material-symbols-outlined animate-spin text-primary">progress_activity</span></div>;

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden pb-24 max-w-md mx-auto bg-background-light dark:bg-background-dark">
      <div className="sticky top-0 z-20 flex items-center bg-white/90 dark:bg-[#101622]/90 backdrop-blur-md p-4 border-b border-gray-100 dark:border-gray-800 justify-between">
        <div className="w-10"></div> <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight flex-1 text-center">Meu Perfil</h2>
        <button onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)} disabled={isSaving} className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isEditing ? 'bg-primary text-white shadow-md' : 'text-primary dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>{isSaving ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : <span className="material-symbols-outlined">{isEditing ? 'check' : 'edit_square'}</span>}</button>
      </div>
      <div className="flex flex-col items-center pt-8 pb-6 px-4">
        <div className="relative group">
          <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-28 w-28 shadow-lg ring-4 ring-white dark:ring-gray-800 bg-gray-200 relative overflow-hidden" style={{ backgroundImage: userData?.photoURL ? `url("${userData.photoURL}")` : undefined }}>
             {!userData?.photoURL && <div className="w-full h-full flex items-center justify-center text-gray-400"><span className="material-symbols-outlined text-5xl">person</span></div>}
             <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">{uploadingPhoto ? <span className="material-symbols-outlined animate-spin text-white">progress_activity</span> : <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>}</div>
             <input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" />
          </div>
          {userData?.isVerified && <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1.5 border-4 border-background-light dark:border-background-dark shadow-sm z-10"><span className="material-symbols-outlined text-white text-[18px] font-bold block">verified</span></div>}
        </div>
        <div className="flex flex-col items-center justify-center mt-4 gap-1 w-full">{isEditing ? <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="text-center font-bold text-lg bg-white dark:bg-card-dark border-b border-primary outline-none text-slate-900 dark:text-white w-2/3" /> : <h1 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight text-center">{userData?.name || "Cidadão"}</h1>}<p className="text-slate-500 dark:text-slate-400 text-sm font-medium text-center">{userData?.email}</p>
          <div className="mt-3 flex gap-2">
            {userData?.isVerified ? <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30"><span className="material-symbols-outlined text-[16px] fill-1">verified</span><span className="text-xs font-bold uppercase tracking-wide">Verificado</span></div> : <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"><span className="material-symbols-outlined text-[16px]">hourglass_top</span><span className="text-xs font-bold uppercase tracking-wide">Aguardando Verificação</span></div>}
            {userData?.status === 'Bloqueado' && <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/30"><span className="material-symbols-outlined text-[16px]">block</span><span className="text-xs font-bold uppercase tracking-wide">Conta Bloqueada</span></div>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 mb-6">
          <button onClick={() => onNavigate(Screen.REQUESTS)} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-[#1a2230] rounded-2xl shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 active:scale-95 transition-all group"><div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined">assignment</span></div><span className="text-xs font-bold text-slate-700 dark:text-slate-300">Minhas Solicitações</span></button>
          <button onClick={() => onNavigate(Screen.ALERTS)} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-[#1a2230] rounded-2xl shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 active:scale-95 transition-all group"><div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-500 dark:text-orange-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined">notifications</span></div><span className="text-xs font-bold text-slate-700 dark:text-slate-300">Notificações</span></button>
      </div>
      <div className="px-4 mt-2"><h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-3 ml-1 flex items-center gap-2"><span className="material-symbols-outlined text-sm">badge</span>Dados Cadastrais</h3>
        <div className="bg-white dark:bg-[#1a2230] rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10">
          <div className="w-full flex items-center gap-4 px-4 py-4 border-b border-slate-100 dark:border-slate-800"><div className="flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 size-10"><span className="material-symbols-outlined text-[20px]">fingerprint</span></div><div className="flex-1 text-left"><p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wide">CPF</p><p className="text-slate-900 dark:text-white text-base font-medium font-mono tracking-tight mt-0.5">{userData?.cpf || "Não informado"}</p></div>{isEditing && <span className="material-symbols-outlined text-gray-300 text-sm">lock</span>}</div>
          <div className="w-full flex items-start gap-4 px-4 py-4"><div className="flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 shrink-0 size-10"><span className="material-symbols-outlined text-[20px]">location_on</span></div><div className="flex-1 text-left"><p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wide mb-1">Endereço Residencial</p>{isEditing ? <div className="space-y-3 mt-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Rua / Logradouro</label><input value={editStreet} onChange={e => setEditStreet(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-primary" placeholder="Nome da Rua" /></div><div className="flex gap-2"><div className="w-24"><label className="text-[10px] text-gray-400 uppercase font-bold">Número</label><input value={editNumber} onChange={e => setEditNumber(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-primary" placeholder="123" /></div><div className="flex-1"><label className="text-[10px] text-gray-400 uppercase font-bold">Bairro</label><input value={editNeighborhood} onChange={e => setEditNeighborhood(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-primary" placeholder="Centro" /></div></div></div> : <><p className="text-slate-900 dark:text-white text-base font-medium leading-normal">{userData?.street ? `${userData.street}, ${userData.number || 'S/N'}` : 'Endereço não cadastrado'}</p><p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{userData?.neighborhood} {userData?.city ? `- ${userData.city}` : ''}</p></>}</div></div>
        </div>
      </div>
      <div className="px-4 mt-6"><h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-3 ml-1 flex items-center gap-2"><span className="material-symbols-outlined text-sm">settings</span>Ajustes</h3>
        <div className="bg-white dark:bg-[#1a2230] rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10">
          <div className="w-full flex items-center gap-4 px-4 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0"><div className="flex items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-500 dark:text-orange-400 shrink-0 size-10"><span className="material-symbols-outlined text-[20px]">notifications</span></div><div className="flex-1 text-left"><p className="text-slate-900 dark:text-white text-sm font-medium leading-normal truncate">Notificações Push</p></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" defaultChecked /><div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div></label></div>
          <button className="w-full flex items-center gap-4 px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"><div className="flex items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shrink-0 size-10"><span className="material-symbols-outlined text-[20px]">lock</span></div><div className="flex-1 text-left"><p className="text-slate-900 dark:text-white text-sm font-medium leading-normal truncate">Alterar Senha</p></div><span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-lg">chevron_right</span></button>
        </div>
      </div>
      <div className="px-4 mt-8 mb-4">
        <button onClick={handleLogout} className="w-full bg-white dark:bg-[#1a2230] rounded-2xl shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 p-4 flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group"><span className="material-symbols-outlined text-red-500 dark:text-red-400 group-hover:scale-110 transition-transform">logout</span><span className="text-red-500 dark:text-red-400 font-semibold text-sm">Sair da Conta</span></button>
        <p className="text-center text-slate-400 dark:text-slate-600 text-[10px] mt-4 font-mono">ID: {currentUser?.uid.slice(0,8)} • v2.4.0</p>
      </div>
    </div>
  );
};

export default ProfileScreen;
