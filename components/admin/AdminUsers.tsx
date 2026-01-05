
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { UserItem } from '../../types';

const AdminUsers: React.FC = () => {
    const { currentUser } = useAuth();
    const [usersList, setUsersList] = useState<UserItem[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

    useEffect(() => {
        // AUTH GUARD
        if (!currentUser || currentUser.email !== 'administracao@riachaodojacuipe.ba.gov.br') return;

        const unsub = onSnapshot(collection(db, "users"), (snap) => {
            setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserItem)));
        }, (error) => console.log("AdminUsers restricted"));
        return () => unsub();
    }, [currentUser]);

    const handleToggleUserStatus = async (user: UserItem) => {
        try {
            const newStatus = user.status === 'Ativo' ? 'Bloqueado' : 'Ativo';
            await updateDoc(doc(db, "users", user.id), { status: newStatus });
            if (selectedUser && selectedUser.id === user.id) setSelectedUser({ ...selectedUser, status: newStatus });
        } catch (e) { alert("Erro ao atualizar usuário."); }
    };

    const handleToggleUserVerification = async (user: UserItem) => {
        try {
            const newState = !user.isVerified;
            await updateDoc(doc(db, "users", user.id), { isVerified: newState });
            if (selectedUser && selectedUser.id === user.id) {
                setSelectedUser({ ...selectedUser, isVerified: newState });
            }
        } catch (e) {
            alert("Erro ao verificar usuário.");
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Data não disponível';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <>
            {!selectedUser ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">Cidadãos Cadastrados</h2>
                            <p className="text-slate-500 dark:text-slate-400">Gerencie o acesso e visualize os dados dos usuários do aplicativo.</p>
                        </div>
                        
                        <div className="relative min-w-[300px]">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input 
                                type="text" 
                                placeholder="Buscar por nome ou e-mail..." 
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Users Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                                <span className="material-symbols-outlined text-2xl">groups</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total de Cadastros</p>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{usersList.length}</h3>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl">
                                <span className="material-symbols-outlined text-2xl">verified_user</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Usuários Ativos</p>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{usersList.filter(u => u.status === 'Ativo').length}</h3>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl">
                                <span className="material-symbols-outlined text-2xl">block</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Bloqueados</p>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{usersList.filter(u => u.status === 'Bloqueado').length}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuário</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Contato</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Data Cadastro</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {usersList
                                    .filter(u => 
                                        u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
                                        u.email.toLowerCase().includes(userSearch.toLowerCase())
                                    )
                                    .map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 text-sm font-bold overflow-hidden border border-white dark:border-slate-600 shadow-sm relative">
                                                    {user.photoURL ? (
                                                        <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        user.name.charAt(0).toUpperCase()
                                                    )}
                                                    {user.isVerified && (
                                                        <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border border-white dark:border-slate-800">
                                                            <span className="material-symbols-outlined text-[10px] font-bold block">verified</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1">
                                                        {user.name}
                                                    </p>
                                                    <p className="text-xs text-slate-400">ID: {user.id.slice(0,6)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[16px] text-slate-400">mail</span>
                                                {user.email}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-slate-500 dark:text-slate-400">
                                            {formatDate(user.dateJoined)}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                user.status === 'Ativo' 
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Ativo' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => setSelectedUser(user)}
                                                    className="text-xs font-bold py-1.5 px-3 rounded-lg transition-colors border border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                                >
                                                    Ver Cadastro
                                                </button>
                                                <button 
                                                    onClick={() => handleToggleUserStatus(user)}
                                                    className={`text-xs font-bold py-1.5 px-3 rounded-lg transition-colors border ${
                                                        user.status === 'Ativo'
                                                        ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20'
                                                        : 'border-green-200 text-green-600 hover:bg-green-50 dark:border-green-900/50 dark:text-green-400 dark:hover:bg-green-900/20'
                                                    }`}
                                                >
                                                    {user.status === 'Ativo' ? 'Bloquear' : 'Ativar'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {usersList.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-slate-500">
                                            <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">person_off</span>
                                            <p>Nenhum cidadão encontrado.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="animate-in slide-in-from-right-8 duration-500 space-y-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setSelectedUser(null)}
                            className="size-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Detalhes do Cidadão</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Column 1: Identity Card */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col items-center text-center h-fit">
                            <div className="relative w-24 h-24 mb-4">
                                <div className="w-full h-full rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-3xl font-bold overflow-hidden border-4 border-white dark:border-slate-600 shadow-lg">
                                    {selectedUser.photoURL ? (
                                        <img src={selectedUser.photoURL} alt={selectedUser.name} className="w-full h-full object-cover" />
                                    ) : (
                                        selectedUser.name.charAt(0).toUpperCase()
                                    )}
                                </div>
                                {selectedUser.isVerified && (
                                    <div className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-800 shadow-sm" title="Conta Verificada">
                                        <span className="material-symbols-outlined text-[18px] font-bold block">verified</span>
                                    </div>
                                )}
                            </div>
                            
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{selectedUser.name}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{selectedUser.email}</p>
                            
                            <div className="flex gap-2 mb-6 flex-wrap justify-center">
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                                    selectedUser.status === 'Ativo' 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${selectedUser.status === 'Ativo' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    {selectedUser.status}
                                </span>
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                    <span className="material-symbols-outlined text-[14px]">badge</span>
                                    Cidadão
                                </span>
                            </div>

                            <div className="w-full pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                <button 
                                    onClick={() => handleToggleUserVerification(selectedUser)}
                                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                                        selectedUser.isVerified
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">{selectedUser.isVerified ? 'remove_moderator' : 'verified'}</span>
                                    {selectedUser.isVerified ? 'Remover Verificação' : 'Verificar Conta'}
                                </button>

                                <button 
                                    onClick={() => handleToggleUserStatus(selectedUser)}
                                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors border ${
                                        selectedUser.status === 'Ativo'
                                        ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20'
                                        : 'border-green-200 text-green-600 hover:bg-green-50 dark:border-green-900/50 dark:text-green-400 dark:hover:bg-green-900/20'
                                    }`}
                                >
                                    {selectedUser.status === 'Ativo' ? 'Bloquear Acesso' : 'Desbloquear Acesso'}
                                </button>
                            </div>
                        </div>

                        {/* Column 2 & 3: Details */}
                        <div className="md:col-span-2 space-y-6">
                            
                            {/* Personal Info */}
                            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">person</span>
                                    Dados Pessoais
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">CPF</p>
                                        <p className="text-base font-medium text-slate-900 dark:text-white font-mono">
                                            {selectedUser.cpf || 'Não cadastrado'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">ID do Sistema</p>
                                        <p className="text-base font-medium text-slate-900 dark:text-white font-mono">{selectedUser.id}</p>
                                    </div>
                                     <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Data de Cadastro</p>
                                        <p className="text-base font-medium text-slate-900 dark:text-white">{formatDate(selectedUser.dateJoined)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Address Info */}
                            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">home</span>
                                    Endereço Residencial
                                </h4>
                                {selectedUser.street || selectedUser.address ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="sm:col-span-2">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Logradouro Completo</p>
                                            <p className="text-base font-medium text-slate-900 dark:text-white">
                                                {selectedUser.street 
                                                    ? `${selectedUser.street}, ${selectedUser.number || 'S/N'}` 
                                                    : (selectedUser.address || 'Endereço não informado')}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Bairro</p>
                                            <p className="text-base font-medium text-slate-900 dark:text-white">{selectedUser.neighborhood || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Cidade</p>
                                            <p className="text-base font-medium text-slate-900 dark:text-white">{selectedUser.city || 'Riachão do Jacuípe'}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-slate-500 dark:text-slate-400 text-sm italic">Endereço não cadastrado.</p>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdminUsers;
