
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { RequestItem, UserItem, Secretariat, ServiceTypeDefinition } from '../../types';

const AdminOverview: React.FC = () => {
    const { currentUser } = useAuth();
    const [stats, setStats] = useState({
        pending: 0,
        open: 0,
        scheduled: 0,
        completed: 0,
        activeUsers: 0,
        totalRequests: 0
    });
    
    // Local state for independent data fetching
    const [requests, setRequests] = useState<RequestItem[]>([]);
    const [users, setUsers] = useState<UserItem[]>([]);
    const [secretariats, setSecretariats] = useState<Secretariat[]>([]);

    useEffect(() => {
        // AUTH GUARD: Prevent listeners if not admin or anonymous admin
        if (!currentUser || (currentUser.email !== 'administracao@riachaodojacuipe.ba.gov.br' && !currentUser.isAnonymous)) return;

        const unsubReqs = onSnapshot(collection(db, "requests"), (snap) => {
            const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() } as RequestItem));
            setRequests(reqs);
            setStats(prev => ({
                ...prev,
                totalRequests: reqs.length,
                pending: reqs.filter(r => r.status === 'Em Análise').length,
                open: reqs.filter(r => r.status === 'Aberto').length,
                scheduled: reqs.filter(r => r.status === 'Agendado').length,
                completed: reqs.filter(r => r.status === 'Concluído').length,
            }));
        }, (error) => console.log("Overview Requests restricted"));

        const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
            const usrs = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserItem));
            setUsers(usrs);
            setStats(prev => ({ ...prev, activeUsers: usrs.filter(u => u.status === 'Ativo').length }));
        }, (error) => console.log("Overview Users restricted"));

        const unsubSecs = onSnapshot(collection(db, "secretariats"), (snap) => {
            setSecretariats(snap.docs.map(d => ({ id: d.id, ...d.data() } as Secretariat)));
        }, (error) => console.log("Overview Secretariats restricted"));

        return () => { unsubReqs(); unsubUsers(); unsubSecs(); };
    }, [currentUser]);

    return (
        <div className="animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">Painel de Controle</h2>
                    <p className="text-slate-500 dark:text-slate-400">Resumo das atividades e métricas de desempenho dos serviços públicos.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
                        <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                        Últimos 7 dias
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        Exportar
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Solicitações<br/>Pendentes</p>
                            <h3 className="text-4xl font-bold text-slate-900 dark:text-white mt-2">{stats.pending}</h3>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-500">
                            <span className="material-symbols-outlined">pending_actions</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        <span>+12%</span>
                        <span className="text-slate-400 font-medium ml-1">vs. semana anterior</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cidadãos Ativos</p>
                            <h3 className="text-4xl font-bold text-slate-900 dark:text-white mt-2">{stats.activeUsers}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-500">
                            <span className="material-symbols-outlined">groups</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400">
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        <span>+5%</span>
                        <span className="text-slate-400 font-medium ml-1">novos cadastros</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Resolvidos Hoje</p>
                            <h3 className="text-4xl font-bold text-slate-900 dark:text-white mt-2">18</h3>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-500">
                            <span className="material-symbols-outlined">check_circle</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400">
                        <span>94%</span>
                        <span className="text-slate-400 font-medium ml-1">taxa de sucesso</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Histórico</p>
                            <h3 className="text-4xl font-bold text-slate-900 dark:text-white mt-2">{stats.totalRequests}</h3>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-500">
                            <span className="material-symbols-outlined">folder_open</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-400">
                        <span className="material-symbols-outlined text-[14px]">info</span>
                        <span className="text-slate-400 font-medium ml-1">desde o início</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminOverview;
