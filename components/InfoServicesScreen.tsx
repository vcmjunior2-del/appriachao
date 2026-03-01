
import React, { useState, useEffect } from 'react';
import { Screen, InfoServiceDefinition } from '../types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAlert } from '../contexts/AlertContext';
import { Browser } from '@capacitor/browser';

interface InfoServicesScreenProps {
  onBack: () => void;
  onNavigateToTracker?: () => void; 
}

// --- Global Cache to prevent reloading flicker ---
let cachedServices: InfoServiceDefinition[] | null = null;

const InfoServicesScreen: React.FC<InfoServicesScreenProps & { onNavigateToTracker: () => void }> = ({ onBack, onNavigateToTracker }) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Initialize with cache if available
  const [services, setServices] = useState<InfoServiceDefinition[]>(cachedServices || []);
  
  // Only show loading if we don't have cached data
  const [loading, setLoading] = useState(cachedServices === null);
  const { showAlert } = useAlert();

  // --- Folder Navigation State ---
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<InfoServiceDefinition[]>([]);

  // --- Helper: Color Mapping with Gradients ---
  const getColorClasses = (theme: string) => {
      switch(theme) {
          case 'blue': return { 
              bg: 'bg-blue-50 dark:bg-blue-900/20', 
              icon: 'text-blue-600 dark:text-blue-400',
              border: 'border-blue-100 dark:border-blue-800' 
          };
          case 'green': return { 
              bg: 'bg-green-50 dark:bg-green-900/20', 
              icon: 'text-green-600 dark:text-green-400',
              border: 'border-green-100 dark:border-green-800' 
          };
          case 'red': return { 
              bg: 'bg-red-50 dark:bg-red-900/20', 
              icon: 'text-red-600 dark:text-red-400',
              border: 'border-red-100 dark:border-red-800' 
          };
          case 'yellow': return { 
              bg: 'bg-amber-50 dark:bg-amber-900/20', 
              icon: 'text-amber-600 dark:text-amber-400',
              border: 'border-amber-100 dark:border-amber-800' 
          };
          case 'purple': return { 
              bg: 'bg-purple-50 dark:bg-purple-900/20', 
              icon: 'text-purple-600 dark:text-purple-400',
              border: 'border-purple-100 dark:border-purple-800' 
          };
          case 'orange': return { 
              bg: 'bg-orange-50 dark:bg-orange-900/20', 
              icon: 'text-orange-600 dark:text-orange-400',
              border: 'border-orange-100 dark:border-orange-800' 
          };
          default: return { 
              bg: 'bg-slate-50 dark:bg-slate-800', 
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
            cachedServices = data; // Update cache
            setLoading(false);
        },
        (error) => {
            console.error("Error fetching info services:", error);
            setLoading(false);
        }
      );
      return () => unsubscribe();
  }, []);

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

  const handleItemClick = async (service: InfoServiceDefinition) => {
      if (service.isFolder) {
          // Enter Folder
          setCurrentParentId(service.id!);
          setFolderHistory(prev => [...prev, service]);
          setSearchTerm(''); // Clear search on enter
      } else if (service.actionType === 'TRACKER_BANNER') {
          // Special Action for Tracker
          onNavigateToTracker();
      } else if (service.actionType === 'LINK_WEB' && service.actionConfig) {
          // Open Web Browser using Capacitor Browser
          let url = service.actionConfig.trim();
          if (!url.startsWith('http')) url = `https://${url}`;
          
          try {
              await Browser.open({ url });
          } catch (error) {
              console.error("Error opening browser:", error);
              // Fallback if Browser plugin fails (e.g., in some web environments)
              window.open(url, '_blank');
          }
      } else {
          showAlert({ message: "Serviço em fase de integração.", type: 'info' });
      }
  };

  // Helper to check for Image URL
  const isUrl = (str: string) => str && (str.includes('http') || str.includes('data:'));

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

  const isRoot = !currentParentId && !searchTerm;

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
             // SKELETON LOADER
             <div className="grid grid-cols-2 gap-3 animate-pulse">
                 <div className="col-span-2 h-32 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
                 <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
                 <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
                 <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
                 <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
             </div>
        ) : (
            <div className="w-full">
                
                {/* STATIC SERVICES BANNER (Only at root) */}
                <div className={`relative w-full h-32 rounded-3xl bg-gradient-to-r from-[#135bec] to-blue-500 overflow-hidden shadow-lg p-5 flex-col justify-center mb-6 shrink-0 ${isRoot ? 'flex' : 'hidden'}`}>
                    <div className="absolute right-0 top-0 h-full w-1/2 opacity-10">
                        <span className="material-symbols-outlined text-[140px] text-white -mr-8 -mt-4">captive_portal</span>
                    </div>
                    <h3 className="text-white font-black text-lg relative z-10 leading-tight">Serviços<br/>Digitais</h3>
                    <p className="text-blue-100 text-[10px] mt-1 relative z-10 max-w-[65%] font-medium opacity-90">
                        Acesse documentos, taxas e consultas de forma rápida e segura.
                    </p>
                </div>

                {/* EMPTY STATE */}
                <div className={`flex-col items-center justify-center pt-10 text-center ${displayedServices.length === 0 ? 'flex' : 'hidden'}`}>
                    <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">folder_off</span>
                    <p className="text-gray-500">Nenhum serviço encontrado nesta pasta.</p>
                </div>

                {/* LIST RENDERER */}
                <div className={`grid-cols-2 gap-3 ${displayedServices.length > 0 ? 'grid' : 'hidden'}`}>
                    {services.map((service, index) => {
                        const isDisplayed = displayedServices.some(s => s.id === service.id);
                        
                        // --- STANDARD CARDS & FOLDERS (Layout Unificado) ---
                        const colors = getColorClasses(service.colorTheme);
                        const iconIsImg = isUrl(service.icon);
                        const isTracker = service.actionType === 'TRACKER_BANNER';

                        // Styling overrides for Tracker to keep visual punch while maintaining grid size
                        const cardBg = isTracker 
                            ? 'bg-gradient-to-br from-emerald-600 to-green-500 border-transparent shadow-emerald-500/20' 
                            : `bg-white dark:bg-card-dark border ${colors.border}`;
                        
                        const textColor = isTracker ? 'text-white' : 'text-slate-900 dark:text-white';
                        const descColor = isTracker ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400';
                        const iconBox = isTracker ? 'bg-white/20 text-white backdrop-blur-sm' : `${colors.bg} ${colors.icon}`;
                        const badgeStyle = isTracker ? 'bg-white text-emerald-700' : `${colors.bg} ${colors.icon}`;

                        return (
                            <button 
                                key={service.id}
                                onClick={() => handleItemClick(service)}
                                className={`relative flex-col items-start p-4 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left group min-h-[170px] justify-between overflow-hidden ${cardBg} ${isDisplayed ? 'flex' : 'hidden'}`}
                            >
                                {/* Background Decor for Tracker */}
                                {isTracker && (
                                    <div className="absolute -right-6 -bottom-6 opacity-20 pointer-events-none transform rotate-12">
                                        <span className="material-symbols-outlined text-[100px] text-white">local_shipping</span>
                                    </div>
                                )}

                                {/* Top Row: Icon and Badge */}
                                <div className="flex w-full justify-between items-start mb-3 relative z-10">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${iconBox} shrink-0 overflow-hidden transition-transform group-hover:scale-105 shadow-inner`}>
                                        {iconIsImg ? (
                                            <img src={service.icon} alt={service.title} className="w-full h-full object-contain p-2" />
                                        ) : (
                                            <span className="material-symbols-outlined text-[32px] group-hover:scale-110 transition-transform">
                                                {service.isFolder ? 'folder' : service.icon}
                                            </span>
                                        )}
                                    </div>
                                    {/* Action/Type Badge */}
                                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${badgeStyle} flex items-center gap-1 shadow-sm`}>
                                        {isTracker && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping absolute opacity-75"></span>}
                                        {isTracker && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 relative"></span>}
                                        {service.isFolder ? 'Pasta' : isTracker ? 'Ao Vivo' : 'Acesso'}
                                    </span>
                                </div>
                                
                                {/* Content */}
                                <div className="w-full flex-1 flex flex-col gap-1 mb-2 relative z-10">
                                    <h3 className={`text-sm font-black leading-tight line-clamp-2 ${textColor}`}>
                                        {service.title}
                                    </h3>
                                    {/* Reduced font size to 9px/10px for better fit */}
                                    <p className={`text-[9px] font-semibold line-clamp-3 leading-tight mt-0.5 ${descColor}`}>
                                        {service.description}
                                    </p>
                                </div>

                                {/* Footer Action */}
                                <div className={`w-full pt-2 mt-auto border-t flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity relative z-10 ${isTracker ? 'border-white/20' : 'border-slate-100 dark:border-slate-800'}`}>
                                    <span className={`material-symbols-outlined text-[12px] ${isTracker ? 'text-emerald-100' : 'text-slate-400'}`}>
                                        {service.isFolder ? 'folder_open' : isTracker ? 'location_on' : 'open_in_new'}
                                    </span>
                                    <span className={`text-[9px] font-bold uppercase tracking-wide truncate w-full text-left ${isTracker ? 'text-emerald-100' : 'text-slate-400'}`}>
                                        {service.isFolder ? 'Abrir Categoria' : isTracker ? 'Rastrear Agora' : 'Acessar Serviço'}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default InfoServicesScreen;
