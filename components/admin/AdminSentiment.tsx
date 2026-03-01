
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { SentimentLog, ImprovementArea } from '../../types';

const AdminSentiment: React.FC = () => {
    const { currentUser } = useAuth();
    const [view, setView] = useState<'STATS' | 'CONFIG'>('STATS');
    const [logs, setLogs] = useState<SentimentLog[]>([]);
    const [areas, setAreas] = useState<ImprovementArea[]>([]);
    const [newAreaLabel, setNewAreaLabel] = useState('');

    useEffect(() => {
        // AUTH GUARD
        if (!currentUser || (currentUser.email !== 'administracao@riachaodojacuipe.ba.gov.br' && !currentUser.isAnonymous)) return;

        // Fetch Logs (Last 100 for performance in demo)
        const qLogs = query(collection(db, "sentiment_logs"), orderBy("date", "desc"), limit(200));
        const unsubLogs = onSnapshot(qLogs, (snap) => {
            setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as SentimentLog)));
        }, (error) => console.log("AdminSentiment Logs restricted"));

        // Fetch Areas
        const qAreas = query(collection(db, "improvement_areas"));
        const unsubAreas = onSnapshot(qAreas, (snap) => {
            setAreas(snap.docs.map(d => ({ id: d.id, ...d.data() } as ImprovementArea)));
        }, (error) => console.log("AdminSentiment Areas restricted"));

        return () => { unsubLogs(); unsubAreas(); };
    }, [currentUser]);

    // --- Stats Calculations ---
    const calculateAverage = () => {
        if (logs.length === 0) return 0;
        const sum = logs.reduce((acc, log) => acc + log.sentiment, 0);
        return (sum / logs.length).toFixed(1);
    };

    const calculateTopAreas = () => {
        const counts: Record<string, number> = {};
        logs.forEach(log => {
            if (log.selectedAreas) {
                log.selectedAreas.forEach(area => {
                    counts[area] = (counts[area] || 0) + 1;
                });
            }
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    };

    const getEmojiForAvg = (avg: number) => {
        if (avg >= 4.5) return { icon: 'sentiment_very_satisfied', color: 'text-green-500' };
        if (avg >= 3.5) return { icon: 'sentiment_satisfied', color: 'text-lime-500' };
        if (avg >= 2.5) return { icon: 'sentiment_neutral', color: 'text-yellow-500' };
        if (avg >= 1.5) return { icon: 'sentiment_dissatisfied', color: 'text-orange-500' };
        return { icon: 'sentiment_very_dissatisfied', color: 'text-red-500' };
    };

    // --- Config Actions ---
    const handleAddArea = async () => {
        if (!newAreaLabel.trim()) return;
        await addDoc(collection(db, "improvement_areas"), {
            label: newAreaLabel,
            icon: 'check_box_outline_blank',
            active: true
        });
        setNewAreaLabel('');
    };

    const handleDeleteArea = async (id: string) => {
        if (confirm("Excluir esta área?")) await deleteDoc(doc(db, "improvement_areas", id));
    };

    const avg = parseFloat(calculateAverage() as string);
    const mood = getEmojiForAvg(avg);
    const topAreas = calculateTopAreas();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">Sentimento Popular</h2>
                    <p className="text-slate-500 dark:text-slate-400">Acompanhe o humor da cidade e configure as opções de feedback.</p>
                </div>
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button onClick={() => setView('STATS')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'STATS' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>Monitoramento</button>
                    <button onClick={() => setView('CONFIG')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'CONFIG' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>Configuração</button>
                </div>
            </div>

            {view === 'STATS' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Mood Card */}
                    <div className="lg:col-span-1 bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm flex flex-col items-center justify-center text-center">
                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Humor Médio (Geral)</h3>
                        <span className={`material-symbols-outlined text-[100px] mb-2 ${mood.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{mood.icon}</span>
                        <h2 className="text-5xl font-black text-slate-900 dark:text-white mb-1">{avg || 0}</h2>
                        <p className="text-xs text-slate-400">Baseado em {logs.length} votos</p>
                    </div>

                    {/* Top Areas */}
                    <div className="lg:col-span-2 bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6">Áreas Mais Citadas para Melhoria</h3>
                        <div className="space-y-4">
                            {topAreas.slice(0, 5).map(([area, count], i) => {
                                const percentage = (count / logs.length) * 100;
                                return (
                                    <div key={area}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{area}</span>
                                            <span className="font-mono text-slate-500">{count} votos</span>
                                        </div>
                                        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${percentage}%` }}></div>
                                        </div>
                                    </div>
                                )
                            })}
                            {topAreas.length === 0 && <p className="text-slate-500 text-sm">Nenhum dado registrado ainda.</p>}
                        </div>
                    </div>

                    {/* Recent Feedbacks */}
                    <div className="lg:col-span-3 bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Últimas Interações</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            {logs.slice(0, 8).map(log => {
                                const logMood = getEmojiForAvg(log.sentiment);
                                return (
                                    <div key={log.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`material-symbols-outlined text-2xl ${logMood.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{logMood.icon}</span>
                                            <span className="text-[10px] text-slate-400">{log.date?.toDate ? log.date.toDate().toLocaleDateString() : 'Hoje'}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {log.selectedAreas && log.selectedAreas.length > 0 ? (
                                                log.selectedAreas.map(a => (
                                                    <span key={a} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{a}</span>
                                                ))
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic">Sem observações</span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Gerenciar Opções de Melhoria</h3>
                        
                        <div className="flex gap-2 mb-6">
                            <input 
                                value={newAreaLabel}
                                onChange={e => setNewAreaLabel(e.target.value)}
                                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                                placeholder="Nova área (ex: Iluminação Pública)"
                            />
                            <button onClick={handleAddArea} className="bg-primary text-white font-bold px-4 rounded-xl hover:bg-blue-600 transition-colors">Adicionar</button>
                        </div>

                        <div className="space-y-2">
                            {areas.map(area => (
                                <div key={area.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{area.label}</span>
                                    <button onClick={() => handleDeleteArea(area.id!)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><span className="material-symbols-outlined text-lg">delete</span></button>
                                </div>
                            ))}
                            {areas.length === 0 && <p className="text-center text-slate-500 py-4">Nenhuma opção cadastrada.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSentiment;
