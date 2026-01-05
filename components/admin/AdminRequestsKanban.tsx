
import React from 'react';
import { RequestItem } from '../../types';

interface AdminRequestsKanbanProps {
    requests: RequestItem[];
    onSelectRequest: (req: RequestItem) => void;
}

const AdminRequestsKanban: React.FC<AdminRequestsKanbanProps> = ({ requests, onSelectRequest }) => {
    
    const isUrl = (str?: string) => str ? (str.includes('http') || str.includes('data:')) : false;
    
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Aberto': return 'bg-blue-100 text-blue-700';
            case 'Em Análise': return 'bg-amber-100 text-amber-700';
            case 'Agendado': return 'bg-purple-100 text-purple-700';
            case 'Concluído': return 'bg-green-100 text-green-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="h-full flex flex-col animate-in fade-in duration-500 overflow-hidden w-full">
            <div className="flex justify-between items-end mb-6 shrink-0">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">Mesa de Tramitação</h2>
                    <p className="text-slate-500 dark:text-slate-400">Visualize o fluxo e transfira ocorrências entre secretarias.</p>
                </div>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                <div className="flex h-full gap-6 min-w-max px-1">
                    {['Aberto', 'Em Análise', 'Agendado', 'Concluído'].map(status => (
                        <div key={status} className="w-80 flex flex-col h-full rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white/50 dark:bg-slate-800/50 rounded-t-2xl">
                                <span className="font-bold text-slate-700 dark:text-slate-200">{status}</span>
                                <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400">{requests.filter(r => r.status === status).length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 scroll-smooth">
                                {requests.filter(r => r.status === status).map(req => {
                                    const isImg = isUrl(req.icon);
                                    return (
                                        <div key={req.id} className="bg-white dark:bg-[#1e293b] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 group hover:border-primary/50 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isImg ? 'bg-white border border-gray-100' : req.iconBg} ${req.iconColor} overflow-hidden`}>
                                                    {isImg ? (
                                                        <img src={req.icon} className="w-full h-full object-contain p-1" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-lg">{req.icon}</span>
                                                    )}
                                                </div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${getStatusColor(req.status)}`}>{req.status}</span>
                                            </div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-tight mb-1">{req.title}</h4>
                                            <p className="text-xs text-slate-500 mb-3 line-clamp-2">{req.description}</p>
                                            
                                            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                                                <span className="text-[10px] text-slate-400 font-mono">#{req.id.slice(0,4)}</span>
                                                <button onClick={() => onSelectRequest(req)} className="text-xs font-bold text-primary hover:underline">Ver Detalhes</button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminRequestsKanban;
