
import React from 'react';
import { RequestItem, Secretariat } from '../../types';

interface AdminRequestsStatsProps {
    requests: RequestItem[];
    secretariats: Secretariat[];
}

const AdminRequestsStats: React.FC<AdminRequestsStatsProps> = ({ requests, secretariats }) => {
    
    // Calculate Trend Data (Last 7 days)
    const calculateTrendData = () => {
        const days = 7;
        const data = new Array(days).fill(0);
        const labels = new Array(days).fill('');
        const today = new Date();
        for (let i = 0; i < days; i++) {
            const d = new Date();
            d.setDate(today.getDate() - (days - 1 - i));
            labels[i] = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const count = requests.filter(r => {
                if(!r.date) return false;
                const rDate = r.date.toDate ? r.date.toDate() : new Date(r.date.seconds * 1000);
                return rDate.toDateString() === d.toDateString();
            }).length;
            data[i] = count;
        }
        return { data, labels };
    };

    const trend = calculateTrendData();
    const total = requests.length;
    
    const maxVal = Math.max(...trend.data, 1);
    const points = trend.data.map((val, i) => {
        const x = (i / (trend.data.length - 1)) * 100;
        const y = 100 - (val / maxVal) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12 w-full">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">Centro de Comando</h2>
                    <p className="text-slate-500 dark:text-slate-400">Monitoramento em tempo real das solicitações municipais.</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-blue-600">inbox</span>
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Total de Ocorrências</p>
                    <h3 className="text-4xl font-black text-slate-900 dark:text-white">{total}</h3>
                </div>
                {/* Add more KPI cards here as needed */}
            </div>
             <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Volume de Solicitações (7 dias)</h4>
                    <div className="relative h-64 w-full">
                        <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
                            <polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-primary drop-shadow-lg" points={points} vectorEffect="non-scaling-stroke" />
                        </svg>
                    </div>
             </div>
        </div>
    );
};

export default AdminRequestsStats;
