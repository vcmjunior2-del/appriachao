
import React, { useState, useEffect } from 'react';
import { Screen, InfoServiceDefinition } from '../types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface InfoServicesScreenProps {
  onBack: () => void;
  onNavigateToTracker?: () => void; 
}

const InfoServicesScreen: React.FC<InfoServicesScreenProps & { onNavigateToTracker: () => void }> = ({ onBack, onNavigateToTracker }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [services, setServices] = useState<InfoServiceDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Folder Navigation State ---
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<InfoServiceDefinition[]>([]);

  // --- In-App Navigation State ---
  const [activeService, setActiveService] = useState<InfoServiceDefinition | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);

  // --- Helper: Color Mapping with Gradients ---
  const getColorClasses = (theme: string) => {
      switch(theme) {
          case 'blue': return { 
              bg: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/10', 
              icon: 'text-blue-600 dark:text-blue-400',
              border: 'border-blue-100 dark:border-blue-800' 
          };
          case 'green': return { 
              bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-900/10', 
              icon: 'text-emerald-600 dark:text-emerald-400',
              border: 'border-emerald-100 dark:border-emerald-800' 
          };
          case 'red': return { 
              bg: 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/10', 
              icon: 'text-red-600 dark:text-red-400',
              border: 'border-red-100 dark:border-red-800' 
          };
          case 'yellow': return { 
              bg: 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/10', 
              icon: 'text-amber-600 dark:text-amber-400',
              border: 'border-amber-100 dark:border-amber-800' 
          };
          case 'purple': return { 
              bg: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/10', 
              icon: 'text-purple-600 dark:text-purple-400',
              border: 'border-purple-100 dark:border-purple-800' 
          };
          case 'orange': return { 
              bg: 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-900/10', 
              icon: 'text-orange-600 dark:text-orange-400',
              border: 'border-orange-100 dark:border-orange-800' 
          };
          default: return { 
              bg: 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900', 
              icon: 'text-slate-600 dark:text-slate-300',
              border: 'border-slate-100 dark:border-slate-700' 
          };
      }
  };

  useEffect(() => {
      const unsubscribe = onSnapshot(collection(db, "info_services"), 
        (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InfoServiceDefinition));
            setServices(data);
            setLoading(false);
        },
        (error) => {
            console.error("Error fetching info services:", error);
            setLoading(false);
        }
      );
      return () => unsubscribe();
  }, []);

  useEffect(() => {
      if (activeService) setIframeLoading(true);
  }, [activeService]);

  // --- Logic: Navigation ---
  
  const handleBackNavigation = () => {
      if (currentParentId) {
          // Go up one level
          const newHistory = [...folderHistory];
          newHistory.pop(); // Remove current folder
          setFolderHistory(newHistory);
          
          const parentFolder = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
          setCurrentParentId(parentFolder ? parentFolder.id! : null);
      } else {
          onBack(); // Exit screen
      }
  };

  const handleItemClick = (service: InfoServiceDefinition) => {
      if (service.isFolder) {
          // Enter Folder
          setCurrentParentId(service.id!);
          setFolderHistory(prev => [...prev, service]);
          setSearchTerm(''); // Clear search on enter
      } else if (service.actionType === 'TRACKER_BANNER') {
          // Special Action for Tracker
          onNavigateToTracker();
      } else if (service.actionType === 'LINK_WEB' && service.actionConfig) {
          // Open Web Browser
          setActiveService(service);
      } else {
          alert("Serviço em fase de integração.");
      }
  };

  // --- Logic: Filtering ---
  
  // 1. Filter by Search (Global search across all levels if searching)
  // 2. Filter by Current Folder (if not searching)
  const displayedServices = services.filter(s => {
      if (searchTerm) {
          return s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 s.description.toLowerCase().includes(searchTerm.toLowerCase());
      }
      // If root, show items with no parentId OR parentId is null/empty string
      if (!currentParentId) return !s.parentId;
      // If folder selected, show children
      return s.parentId === currentParentId;
  });

  const currentFolderName = currentParentId 
      ? folderHistory[folderHistory.length - 1]?.title 
      : 'Serviços Online';

  // --- RENDER: INTERNAL BROWSER (IFRAME) ---
  if (activeService) {
      let url = activeService.actionConfig.trim();
      if (!url.startsWith('http')) url = `https://${url}`;
      const domain = url.replace('https://', '').replace('http://', '').split('/')[0];

      return (
          <div className="fixed inset-0 z-[100] flex flex-col bg-background-light dark:bg-background-dark animate-in slide-in-from-bottom duration-300">
              <header className="p-3 pb-2 flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-card-dark shadow-sm z-10">
                  <button onClick={() => setActiveService(null)} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-slate-800 dark:text-white">
                      <span className="material-symbols-outlined">close</span>
                  </button>
                  <div className="flex-1 flex flex-col justify-center bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-1.5 border border-transparent focus-within:border-primary/50 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[12px] text-green-600 dark:text-green-400">lock</span>
                        <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate">{activeService.title}</h2>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-mono">{domain}</p>
                  </div>
                  <button onClick={() => window.open(url, '_blank')} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-primary" title="Abrir no Navegador">
                      <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                  </button>
              </header>
              <main className="flex-1 relative bg-white w-full h-full overflow-hidden">
                  {iframeLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 z-0">
                          <span className="material-symbols-outlined animate-spin text-primary text-3xl mb-2">progress_activity</span>
                          <p className="text-xs text-slate-500 font-medium">Carregando portal...</p>
                      </div>
                  )}
                  <iframe src={url} title={activeService.title} className="w-full h-full border-none relative z-10" onLoad={() => setIframeLoading(false)} sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" />
                  {!iframeLoading && (
                      <div className="absolute bottom-0 left-0 right-0 bg-yellow-50 dark:bg-yellow-900/20 p-2 text-center border-t border-yellow-200 dark:border-yellow-900/50 z-20">
                          <p className="text-[10px] text-yellow-700 dark:text-yellow-400">Se não carregar, use o ícone <span className="material-symbols-outlined text-[10px] align-middle">open_in_new</span> acima.</p>
                      </div>
                  )}
              </main>
          </div>
      );
  }

  // --- RENDER: LIST VIEW ---
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark pb-24 font-display">
       
       <div className="bg-white dark:bg-card-dark shadow-sm border-b border-gray-100 dark:border-gray-800 pb-2">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <button 
                    onClick={handleBackNavigation}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-800 dark:text-slate-200 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Portal Digital</span>
                </div>
            </div>

            <div className="px-6 pb-4">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-1 animate-in slide-in-from-left-2 duration-300">
                    {currentFolderName}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {currentParentId ? 'Selecione uma opção abaixo.' : 'Links rápidos para utilidades municipais.'}
                </p>
            </div>

            <div className="px-4 pb-2">
                <div className="group relative flex items-center w-full h-12 rounded-2xl bg-gray-100 dark:bg-gray-800/50 border border-transparent focus-within:bg-white dark:focus-within:bg-gray-900 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all overflow-hidden">
                    <div className="flex items-center justify-center pl-4 pr-2 text-gray-400">
                        <span className="material-symbols-outlined">search</span>
                    </div>
                    <input 
                        className="w-full bg-transparent border-none text-base text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-0 focus:outline-none h-full" 
                        placeholder="O que você precisa?"
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
       </div>

      <main className="flex-1 px-4 py-6 space-y-4 overflow-y-auto no-scrollbar">
        {loading ? (
             <div className="flex flex-col items-center justify-center pt-10 gap-3">
                 <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
                 <p className="text-sm text-gray-500">Carregando catálogo...</p>
             </div>
        ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 grid grid-cols-2 gap-4">
                
                {/* LIST RENDERER */}
                {displayedServices.length === 0 ? (
                    <div className="col-span-2 flex flex-col items-center justify-center pt-10 text-center">
                        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">folder_off</span>
                        <p className="text-gray-500">Nenhum serviço encontrado nesta pasta.</p>
                    </div>
                ) : (
                    displayedServices.map((service, index) => {
                        // --- SPECIAL CARD: TRACKER BANNER ---
                        if (service.actionType === 'TRACKER_BANNER') {
                            return (
                                <button 
                                    key={service.id}
                                    onClick={() => handleItemClick(service)}
                                    className="col-span-2 w-full relative group overflow-hidden rounded-3xl bg-[#1e293b] text-white p-5 shadow-lg shadow-slate-900/10 active:scale-[0.98] transition-all flex items-center justify-between min-h-[120px]"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-500 opacity-90 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="absolute -right-6 -bottom-6 text-white/10">
                                        <span className="material-symbols-outlined text-[100px]">local_shipping</span>
                                    </div>
                                    
                                    <div className="relative z-10 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center animate-pulse">
                                            <span className="material-symbols-outlined text-2xl">my_location</span>
                                        </div>
                                        <div className="text-left">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h3 className="font-bold text-lg leading-none">{service.title}</h3>
                                                <span className="bg-red-500 text-[9px] font-bold px-1.5 py-0.5 rounded text-white animate-pulse">AO VIVO</span>
                                            </div>
                                            <p className="text-xs text-emerald-100 font-medium">{service.description}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="relative z-10 bg-white/20 p-2 rounded-full">
                                        <span className="material-symbols-outlined">chevron_right</span>
                                    </div>
                                </button>
                            );
                        }

                        // --- STANDARD CARDS & FOLDERS ---
                        const colors = getColorClasses(service.colorTheme);
                        return (
                            <button 
                                key={service.id}
                                onClick={() => handleItemClick(service)}
                                className={`relative flex flex-col items-start p-4 rounded-2xl bg-white dark:bg-card-dark border ${colors.border} shadow-sm hover:shadow-md active:scale-[0.97] transition-all group h-full min-h-[140px] text-left`}
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="flex justify-between w-full items-start mb-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colors.bg} ${colors.icon} shadow-inner`}>
                                        <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">
                                            {service.isFolder ? 'folder' : service.icon}
                                        </span>
                                    </div>
                                    <span className="material-symbols-outlined text-gray-300 text-sm">
                                        {service.isFolder ? 'chevron_right' : 'open_in_new'}
                                    </span>
                                </div>
                                
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight mb-1 line-clamp-2">{service.title}</h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{service.description}</p>
                                </div>
                                
                                {service.isFolder && (
                                    <div className="absolute bottom-4 right-4 opacity-50 text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-bold text-slate-500 uppercase">
                                        Pasta
                                    </div>
                                )}
                            </button>
                        );
                    })
                )}
            </div>
        )}
      </main>
    </div>
  );
};

export default InfoServicesScreen;
