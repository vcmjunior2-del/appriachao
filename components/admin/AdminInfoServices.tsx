
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { InfoServiceDefinition } from '../../types';

const AdminInfoServices: React.FC = () => {
    const { currentUser } = useAuth();
    const [view, setView] = useState<'DASHBOARD' | 'LIST'>('DASHBOARD');
    const [infoServicesList, setInfoServicesList] = useState<InfoServiceDefinition[]>([]);
    
    // CRUD State
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const defaultService: InfoServiceDefinition = {
        title: '', description: '', icon: 'info', colorTheme: 'blue', actionType: 'LINK_WEB', actionConfig: '', active: true
    };
    const [formData, setFormData] = useState<InfoServiceDefinition>(defaultService);

    // Mock Stats State
    const [stats, setStats] = useState({
        totalViews: 0,
        formsSubmitted: 0,
        appointments: 0,
        pollsAnswered: 0,
        trend: { data: [] as number[], labels: [] as string[] }
    });

    useEffect(() => {
        // AUTH GUARD
        if (!currentUser || currentUser.email !== 'administracao@riachaodojacuipe.ba.gov.br') return;

        const unsub = onSnapshot(collection(db, "info_services"), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as InfoServiceDefinition));
            setInfoServicesList(data);
            
            // Generate Mock Data based on list length to simulate activity
            const baseMultiplier = data.length || 1;
            setStats({
                totalViews: 1240 * baseMultiplier + 450,
                formsSubmitted: 320 * baseMultiplier + 120,
                appointments: 85 * baseMultiplier + 40,
                pollsAnswered: 540 * baseMultiplier,
                trend: calculateTrendData()
            });
        }, (error) => console.log("AdminInfoServices restricted"));
        return () => unsub();
    }, [currentUser]);

    // --- Helpers ---
    const calculateTrendData = () => {
        const days = 7;
        const data = Array.from({length: days}, () => Math.floor(Math.random() * 200) + 100);
        const labels = Array.from({length: days}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (days - 1 - i));
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        });
        return { data, labels };
    };

    const handleSave = async () => {
        if (!formData.title) return alert("O título é obrigatório.");
        setIsSaving(true);
        try {
            if (formData.id) await setDoc(doc(db, "info_services", formData.id), formData, { merge: true });
            else { const { id, ...data } = formData; await addDoc(collection(db, "info_services"), data); }
            setIsEditing(false);
            setFormData(defaultService);
        } catch (error) { alert("Erro ao salvar serviço."); } finally { setIsSaving(false); }
    };

    const handleEdit = (service: InfoServiceDefinition) => { setFormData(service); setIsEditing(true); setView('LIST'); };
    const handleDelete = async (id: string) => { if(confirm('Excluir este serviço?')) await deleteDoc(doc(db, "info_services", id)); };
    const handleNew = () => { setFormData(defaultService); setIsEditing(true); setView('LIST'); };

    const getColorPreview = (theme: string) => {
        const colors: any = {
            blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-200' },
            green: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-200' },
            red: { bg: 'bg-red-50', icon: 'text-red-600', border: 'border-red-200' },
            yellow: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-200' },
            purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-200' },
            orange: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-200' },
            gray: { bg: 'bg-slate-50', icon: 'text-slate-600', border: 'border-slate-200' },
        };
        return colors[theme] || colors.gray;
    };

    // --- RENDER: DASHBOARD VIEW ---
    if (view === 'DASHBOARD') {
        const maxVal = Math.max(...stats.trend.data, 1);
        const points = stats.trend.data.map((val, i) => {
            const x = (i / (stats.trend.data.length - 1)) * 100;
            const y = 100 - (val / maxVal) * 100;
            return `${x},${y}`;
        }).join(' ');

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">Painel de Tipos de Serviço</h2>
                        <p className="text-slate-500 dark:text-slate-400">Monitoramento e cadastro dos serviços digitais disponíveis.</p>
                    </div>
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <button onClick={() => setView('DASHBOARD')} className="px-4 py-2 bg-white dark:bg-slate-700 shadow-sm rounded-lg text-xs font-bold text-slate-900 dark:text-white transition-all">Visão Geral</button>
                        <button onClick={() => setView('LIST')} className="px-4 py-2 text-slate-500 dark:text-slate-400 text-xs font-bold hover:text-slate-900 dark:hover:text-white transition-all">Gerenciar Tipos</button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl"><span className="material-symbols-outlined">touch_app</span></div>
                            <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-lg">+12%</span>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">{stats.totalViews}</h3>
                        <p className="text-xs font-medium text-slate-500">Acessos Totais</p>
                    </div>
                    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl"><span className="material-symbols-outlined">assignment</span></div>
                            <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-lg">+5%</span>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">{stats.formsSubmitted}</h3>
                        <p className="text-xs font-medium text-slate-500">Formulários Enviados</p>
                    </div>
                    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-xl"><span className="material-symbols-outlined">calendar_month</span></div>
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">0%</span>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">{stats.appointments}</h3>
                        <p className="text-xs font-medium text-slate-500">Agendamentos</p>
                    </div>
                    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-xl"><span className="material-symbols-outlined">poll</span></div>
                            <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-lg">+8%</span>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">{stats.pollsAnswered}</h3>
                        <p className="text-xs font-medium text-slate-500">Enquetes Respondidas</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Access Chart */}
                    <div className="lg:col-span-2 bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-900 dark:text-white">Acessos aos Serviços (7 dias)</h3>
                        </div>
                        <div className="relative h-64 w-full">
                            <div className="absolute inset-0 flex flex-col justify-between text-xs text-slate-400">
                                {[1,2,3,4].map(i => <div key={i} className="border-b border-slate-100 dark:border-slate-700 w-full h-0"></div>)}
                            </div>
                            <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
                                <polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-primary drop-shadow-lg" points={points} vectorEffect="non-scaling-stroke" />
                                <polygon fill="url(#gradient-services)" className="opacity-20 text-primary" points={`0,100 ${points} 100,100`} vectorEffect="non-scaling-stroke" />
                                <defs>
                                    <linearGradient id="gradient-services" x1="0" x2="0" y1="0" y2="1">
                                        <stop offset="0%" stopColor="currentColor" />
                                        <stop offset="100%" stopColor="transparent" />
                                    </linearGradient>
                                </defs>
                                {stats.trend.data.map((val, i) => {
                                    const x = (i / (stats.trend.data.length - 1)) * 100;
                                    const y = 100 - (val / maxVal) * 100;
                                    return <circle key={i} cx={`${x}%`} cy={`${y}%`} r="4" className="fill-white stroke-primary stroke-2" />;
                                })}
                            </svg>
                        </div>
                        <div className="flex justify-between mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                            {stats.trend.labels.map((label, i) => <span key={i}>{label}</span>)}
                        </div>
                    </div>

                    {/* Top Services */}
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-6">Serviços Mais Acessados</h3>
                        <div className="flex-1 space-y-5 overflow-y-auto no-scrollbar">
                            {infoServicesList.slice(0, 5).map((service, i) => {
                                // Simulate random popularity based on index
                                const popularity = 100 - (i * 15);
                                return (
                                    <div key={service.id}>
                                        <div className="flex justify-between text-sm mb-1.5">
                                            <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 truncate">
                                                <span className="text-slate-400 font-normal w-4">{i + 1}.</span>
                                                {service.title}
                                            </span>
                                            <span className="font-mono text-slate-500">{Math.floor(popularity * 3.5)}</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${popularity}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                            {infoServicesList.length === 0 && <p className="text-sm text-slate-500">Nenhum serviço cadastrado.</p>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- VIEW: LIST/EDITOR ---
    if (isEditing) {
        const previewColors = getColorPreview(formData.colorTheme);
        return (
            <div className="max-w-5xl mx-auto animate-in slide-in-from-right-8 duration-500 pb-10">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsEditing(false)} className="size-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
                        </button>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{formData.id ? 'Editar Tipo' : 'Novo Tipo de Serviço'}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Configure a aparência e o destino do botão.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                        <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                            {isSaving ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <span className="material-symbols-outlined text-lg">check</span>} Salvar Alterações
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-sm">edit</span> Informações Básicas</h3>
                            <div className="space-y-4">
                                <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Título</label><input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none" placeholder="Ex: 2ª Via do IPTU" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
                                <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Descrição</label><textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none resize-none" placeholder="Descrição curta..." rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-sm">palette</span> Aparência</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Ícone</label><input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono text-sm" placeholder="Ex: receipt_long" value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} /></div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Cor do Tema</label>
                                    <div className="flex flex-wrap gap-3">
                                        {['blue', 'green', 'red', 'yellow', 'purple', 'orange', 'gray'].map((color) => (
                                            <button key={color} onClick={() => setFormData({...formData, colorTheme: color as any})} className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ring-2 ring-offset-2 dark:ring-offset-slate-900 ${formData.colorTheme === color ? 'ring-slate-400 scale-110' : 'ring-transparent'}`} style={{ backgroundColor: color === 'gray' ? '#64748b' : `var(--color-${color}-500, ${color})` }}>
                                                <div className={`w-full h-full rounded-full ${color === 'blue' ? 'bg-blue-500' : color === 'green' ? 'bg-emerald-500' : color === 'red' ? 'bg-red-500' : color === 'yellow' ? 'bg-amber-500' : color === 'purple' ? 'bg-purple-500' : color === 'orange' ? 'bg-orange-500' : 'bg-slate-500'}`}></div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-sm">link</span> Destino</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Tipo</label><select className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none" value={formData.actionType} onChange={e => setFormData({...formData, actionType: e.target.value as any})}><option value="LINK_WEB">Link Externo</option><option value="INTERNAL_FORM">Formulário</option><option value="STATIC_PAGE">Página</option></select></div>
                                <div className="md:col-span-2"><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Configuração (URL/ID)</label><input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono text-sm" value={formData.actionConfig} onChange={e => setFormData({...formData, actionConfig: e.target.value})} /></div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="bg-slate-100 dark:bg-[#0f172a] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-center sticky top-6">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Pré-visualização</p>
                            <div className={`relative flex flex-col items-start p-4 rounded-2xl bg-white dark:bg-[#1a2230] border ${previewColors.border} dark:border-slate-700 shadow-md h-auto min-h-[140px] text-left w-full max-w-[280px] mx-auto`}>
                                <div className="flex justify-between w-full items-start mb-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${previewColors.bg} dark:bg-slate-800 ${previewColors.icon} shadow-inner`}><span className="material-symbols-outlined text-2xl">{formData.icon || 'help'}</span></div>
                                    <span className="material-symbols-outlined text-gray-300 text-sm">open_in_new</span>
                                </div>
                                <div className="flex-1"><h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight mb-1 line-clamp-2">{formData.title || 'Título'}</h3><p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{formData.description || 'Descrição...'}</p></div>
                            </div>
                            <div className="mt-6 flex items-center justify-between px-4">
                                <span className="text-xs font-bold text-slate-500">Ativo?</span>
                                <input type="checkbox" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="scale-125" />
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
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">Tipos de Serviço</h2>
                    <p className="text-slate-500 dark:text-slate-400">Links úteis e atalhos disponíveis no app.</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <button onClick={() => setView('DASHBOARD')} className="px-4 py-2 text-slate-500 dark:text-slate-400 text-xs font-bold hover:text-slate-900 dark:hover:text-white transition-all">Visão Geral</button>
                        <button onClick={() => setView('LIST')} className="px-4 py-2 bg-white dark:bg-slate-700 shadow-sm rounded-lg text-xs font-bold text-slate-900 dark:text-white transition-all">Lista de Tipos</button>
                    </div>
                    <button onClick={handleNew} className="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center gap-2"><span className="material-symbols-outlined">add_circle</span> Novo</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {infoServicesList.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">grid_view</span>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum tipo de serviço cadastrado</h3>
                    </div>
                )}
                {infoServicesList.map((service) => {
                    const colors = getColorPreview(service.colorTheme);
                    return (
                        <div key={service.id} className="group bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                            {!service.active && <div className="absolute top-0 right-0 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">INATIVO</div>}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${colors.bg} dark:bg-slate-800 ${colors.icon}`}><span className="material-symbols-outlined text-3xl">{service.icon}</span></div>
                                    <div className="min-w-0"><h3 className="font-bold text-slate-900 dark:text-white leading-tight truncate pr-2">{service.title}</h3><p className="text-xs text-slate-500 mt-0.5 font-mono bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded w-fit">{service.actionType === 'LINK_WEB' ? 'LINK' : 'INTERNO'}</p></div>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 min-h-[2.5rem] mb-4 leading-relaxed">{service.description}</p>
                            <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button onClick={() => handleEdit(service)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><span className="material-symbols-outlined text-lg">edit</span> Editar</button>
                                <button onClick={() => handleDelete(service.id!)} className="px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><span className="material-symbols-outlined text-lg">delete</span></button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AdminInfoServices;
