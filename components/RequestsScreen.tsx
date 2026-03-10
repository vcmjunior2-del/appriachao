
import React, { useState, useEffect } from 'react';
import { Screen, RequestItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface RequestsScreenProps {
  onBack: () => void;
  onSelectRequest: (requestId: string) => void; 
}

const RequestsScreen: React.FC<RequestsScreenProps> = ({ onBack, onSelectRequest }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'Em Andamento' | 'Histórico'>('Em Andamento');
  const [filter, setFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const filters = ['Todos', 'Iluminação', 'Limpeza', 'Obras', 'Saúde'];

  // --- Helper: Format Timestamp ---
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Data Pendente';
    // If it's a Firestore Timestamp
    if (timestamp.toDate) {
        const date = timestamp.toDate();
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }
    // Handle plain object with seconds (edge case)
    if (timestamp.seconds) {
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }
    return 'Recentemente';
  };

  const isUrl = (str?: string) => str ? (str.includes('http') || str.includes('data:')) : false;

  // --- Fetch Requests ---
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    const processSnapshot = (snapshot: any) => {
        // Sort documents client-side to avoid Firestore composite index requirement
        const sortedDocs = [...snapshot.docs].sort((a, b) => {
            const dateA = a.data().date?.seconds || 0;
            const dateB = b.data().date?.seconds || 0;
            return dateB - dateA; // Descending order
        });

        const fetchedRequests: RequestItem[] = sortedDocs.map((doc: any) => {
            const data = doc.data();
            // IMPORTANT: Spread data FIRST so we can override specific fields like 'date' with formatted strings
            return {
                ...data,
                id: doc.id,
                title: data.title || 'Solicitação',
                date: formatDate(data.date),
                address: data.address || 'Sem endereço',
                status: data.status,
                icon: data.icon || 'folder',
                iconBg: data.iconBg || 'bg-gray-100',
                iconColor: data.iconColor || 'text-gray-600',
                statusColor: data.statusColor || 'text-gray-600',
                statusBg: data.statusBg || 'bg-gray-100',
            } as RequestItem;
        });
        setRequests(fetchedRequests);
        setLoading(false);
    };

    // Basic query by userId
    const q = query(
        collection(db, "requests"), 
        where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, 
        processSnapshot, 
        (error) => {
            console.error("Error fetching requests:", error);
            setLoading(false);
        }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Basic filtering logic
  const filteredRequests = requests.filter(req => {
    // 1. Tab Filter
    const isHistory = req.status === 'Concluído' || req.status === 'Rejeitado'; 
    if (activeTab === 'Em Andamento' && isHistory) return false;
    if (activeTab === 'Histórico' && !isHistory) return false;

    // 2. Category Filter
    let matchesCategory = true;
    if (filter !== 'Todos') {
        if (filter === 'Iluminação' && !req.title.includes('Iluminação')) matchesCategory = false;
        else if (filter === 'Limpeza' && !req.title.includes('Limpeza')) matchesCategory = false;
        else if (filter === 'Obras' && !(req.title.includes('Obras') || req.title.includes('Buraco'))) matchesCategory = false;
        else if (filter === 'Saúde' && !req.title.includes('Saúde')) matchesCategory = false;
        else if (!req.title.includes(filter)) matchesCategory = false;
    }
    if (!matchesCategory) return false;

    // 3. Search Filter
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return req.title.toLowerCase().includes(term) || 
               req.id.toLowerCase().includes(term) || 
               (req.description && req.description.toLowerCase().includes(term));
    }
    
    return true;
  });

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark pb-16 font-display">
      
      {/* Modern Header with Banner (Matching InfoServicesScreen) */}
      <div className="bg-white dark:bg-card-dark shadow-sm border-b border-gray-100 dark:border-gray-800 pb-2 z-10">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <button 
                    onClick={onBack}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-800 dark:text-slate-200 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Suas Ocorrências</span>
                </div>
            </div>

            <div className="px-6 pb-4">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-1">Minhas Solicitações</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Acompanhe o andamento dos seus pedidos.</p>
            </div>

            {/* Search Bar */}
            <div className="px-4 pb-2">
                <div className="group relative flex items-center w-full h-12 rounded-2xl bg-gray-100 dark:bg-gray-800/50 border border-transparent focus-within:bg-white dark:focus-within:bg-gray-900 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all overflow-hidden">
                    <div className="flex items-center justify-center pl-4 pr-2 text-gray-400">
                        <span className="material-symbols-outlined">search</span>
                    </div>
                    <input 
                        className="w-full bg-transparent border-none text-base text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-0 focus:outline-none h-full" 
                        placeholder="Buscar por protocolo ou título..."
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
       </div>

      {/* Main Content List */}
      <main className="flex-1 px-4 py-4 space-y-4 overflow-y-auto no-scrollbar">
        
        {/* Tabs */}
        <div className="flex h-11 w-full items-center justify-center rounded-xl bg-gray-200 dark:bg-gray-800 p-1 relative mb-2">
            <label 
              className="group flex cursor-pointer h-full flex-1 items-center justify-center rounded-lg relative z-10"
              onClick={() => setActiveTab('Em Andamento')}
            >
              <input 
                type="radio" 
                name="status-tab" 
                value="Em Andamento" 
                className="peer invisible absolute w-0 h-0" 
                checked={activeTab === 'Em Andamento'}
                readOnly
              />
              <span className={`w-full h-full flex items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'Em Andamento' ? 'bg-white dark:bg-gray-700 text-primary dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                Em Andamento
              </span>
            </label>
            <label 
              className="group flex cursor-pointer h-full flex-1 items-center justify-center rounded-lg relative z-10"
              onClick={() => setActiveTab('Histórico')}
            >
              <input 
                type="radio" 
                name="status-tab" 
                value="Histórico" 
                className="peer invisible absolute w-0 h-0"
                checked={activeTab === 'Histórico'}
                readOnly
              />
               <span className={`w-full h-full flex items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'Histórico' ? 'bg-white dark:bg-gray-700 text-primary dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                Histórico
              </span>
            </label>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 transition-transform active:scale-95 ${
                filter === f 
                  ? 'bg-primary shadow-sm shadow-primary/30 text-white' 
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              <span className="text-sm font-medium leading-normal">{f}</span>
            </button>
          ))}
        </div>

        {loading ? (
             <div className="flex justify-center pt-10">
                 <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
             </div>
        ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-12 opacity-50">
                <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                <p>Nenhuma solicitação encontrada.</p>
            </div>
        ) : (
            filteredRequests.map(req => {
              const iconIsImg = isUrl(req.icon);
              return (
                <article 
                    key={req.id} 
                    onClick={() => onSelectRequest(req.id)}
                    className="group relative flex flex-col gap-3 rounded-2xl bg-white dark:bg-card-dark p-4 shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all active:scale-[0.99] cursor-pointer"
                >
                    <div className="flex justify-between items-start gap-3">
                    <div className="flex items-start gap-4 flex-1">
                        {/* Icon Box */}
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden ${req.iconBg} ${iconIsImg ? '' : req.iconColor}`}>
                          {iconIsImg ? (
                              <img src={req.icon} alt="Ícone" className="w-full h-full object-contain p-2" />
                          ) : (
                              <span className="material-symbols-outlined text-[24px]">{req.icon}</span>
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex flex-col gap-1 min-w-0">
                        <h3 className="text-slate-900 dark:text-white text-base font-bold leading-tight truncate">{req.title}</h3>
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium">
                            <span>ID {req.id.slice(-4).toUpperCase()}</span>
                            <span className="size-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                            {/* req.date is now guaranteed to be a string */}
                            <span>{req.date}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm leading-normal truncate">{req.address}</p>
                        </div>
                    </div>
                    {/* Status Badge */}
                    <div className="shrink-0">
                        <div className={`inline-flex items-center rounded-md px-2.5 py-1 ${req.statusBg}`}>
                        <span className={`size-1.5 rounded-full mr-1.5 ${req.status === 'Em Análise' ? 'animate-pulse bg-amber-500' : req.status === 'Aberto' ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
                        <span className={`text-xs font-bold ${req.statusColor}`}>{req.status}</span>
                        </div>
                    </div>
                    </div>
                    <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-bold text-primary flex items-center">
                            Ver detalhes <span className="material-symbols-outlined text-sm ml-0.5">arrow_forward</span>
                        </span>
                    </div>
                </article>
              );
            })
        )}
      </main>
    </div>
  );
};

export default RequestsScreen;
