
import React from 'react';
import { RequestItem, Secretariat } from '../../types';

interface AdminRequestsListProps {
    requests: RequestItem[];
    secretariats: Secretariat[];
    onSelectRequest: (req: RequestItem) => void;
}

const AdminRequestsList: React.FC<AdminRequestsListProps> = ({ requests, secretariats, onSelectRequest }) => {
    
    const getSecretariatName = (id?: string) => secretariats.find(s => s.id === id)?.name || 'N/A';

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Aberto': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Em Análise': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'Agendado': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'Concluído': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'Rejeitado': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 w-full">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">Todas as Ocorrências</h2>
                    <p className="text-slate-500 dark:text-slate-400">Listagem completa para auditoria e acompanhamento.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Ocorrência</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Secretaria</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Cidadão</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {requests.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="py-4 px-6">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${getStatusColor(req.status)}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full bg-current`}></span>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="font-bold text-slate-900 dark:text-white text-sm">{req.title}</div>
                                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{req.address}</div>
                                    </td>
                                    <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-300">
                                        {getSecretariatName(req.department)}
                                    </td>
                                    <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-300">
                                        {req.userName || 'Anônimo'}
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <button onClick={() => onSelectRequest(req)} className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors">
                                            Gerenciar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
            </div>
        </div>
    );
};

export default AdminRequestsList;
