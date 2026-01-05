
import React, { useState, useEffect } from 'react';
import { Screen, InfoServiceDefinition } from '../types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface InfoServicesScreenProps {
  onBack: () => void;
  onNavigateToTracker?: () => void; // Prop para navegação
}

// Alterando a assinatura para aceitar a prop opcional (que será passada pelo App.tsx se necessário, mas aqui vamos usar um hack simples de navegação global ou pedir para passar no App)
// Para simplificar e manter compatibilidade, vamos injetar a navegação via App.tsx logic
const InfoServicesScreen: React.FC<InfoServicesScreenProps & { onNavigateToTracker: () => void }> = ({ onBack, onNavigateToTracker }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [services, setServices] = useState<InfoServiceDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // --- In-App Navigation State ---
  const [activeService, setActiveService] = useState<InfoServiceDefinition | null>(null);
  const [isGovSite, setIsGovSite] = useState(false);

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

  const filteredServices = services.filter(s => 
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleServiceClick = (service: InfoServiceDefinition) => {
      if (service.actionType === 'LINK_WEB' && service.actionConfig) {
          const url = service.actionConfig.trim();
          const isGov = url.includes('.gov.br') || url.includes('riachaodojacuipe');
          
          setActiveService(service);
          setIsGovSite(isGov);
          
      } else {
          alert("Serviço em fase de integração.");
      }
  };

  const handleOpenExternal = () => {
      if (activeService?.actionConfig) {
          let url = activeService.actionConfig;
          if (!url.startsWith('http')) url = `https://${url}`;
          window.open(url, '_blank');
          setActiveService(null);
      }
  };

  // --- RENDER: SECURE GATEWAY (In-App Transition) ---
  if (activeService) {
      const domain = activeService.actionConfig.replace('https://', '').replace('http://', '').split('/')[0];
      
      return (
          <div className="fixed inset-0 z-[100] flex flex-col bg-background-light dark:bg-background-dark animate-in slide-in-from-right duration-300">
              <header className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-card-dark">
                  <button onClick={() => setActiveService(null)} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <span className="material-symbols-outlined text-slate-800 dark:text-white font-bold">close</span>
                  </button>
                  <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Portal de Serviços</h2>
                  <div className="size-10"></div>
              </header>

              <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary mb-6 animate-bounce-gentle">
                      <span className="material-symbols-outlined text-5xl">{activeService.icon}</span>
                  </div>

                  <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2 leading-tight">
                      Acessar {activeService.title}
                  </h1>
                  
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed max-w-xs">
                      Para sua segurança e total compatibilidade com emissão de boletos, o portal da prefeitura será aberto em uma conexão segura protegida.
                  </p>

                  <div className="w-full max-w-xs space-y-4">
                      <button 
                          onClick={handleOpenExternal}
                          className="w-full bg-primary hover:bg-blue-600 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all group"
                      >
                          <span>Abrir Portal Seguro</span>
                          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">open_in_new</span>
                      </button>

                      <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                          <span className="material-symbols-outlined text-green-500 text-sm">lock</span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate flex-1">{domain}</span>
                      </div>
                  </div>
              </main>

              <footer className="p-6 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Ambiente Oficial • Riachão Cidadão</p>
              </footer>
          </div>
      );
  }

  // --- RENDER: LIST VIEW ---
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark pb-24 font-display">
       
       <div className="bg-white dark:bg-card-dark shadow-sm border-b border-gray-100 dark:border-gray-800 pb-2">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <button 
                    onClick={onBack}
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
                <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-1">Serviços Online</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Links rápidos para utilidades municipais.</p>
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

      <main className="flex-1 px-4 py-6 space-y-6 overflow-y-auto no-scrollbar">
        {loading ? (
             <div className="flex flex-col items-center justify-center pt-10 gap-3">
                 <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
                 <p className="text-sm text-gray-500">Carregando catálogo...</p>
             </div>
        ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* --- LIVE TRACKING FEATURE HIGHLIGHT --- */}
                {!searchTerm && (
                    <button 
                        onClick={onNavigateToTracker}
                        className="w-full mb-6 relative group overflow-hidden rounded-3xl bg-[#1e293b] text-white p-5 shadow-lg shadow-slate-900/10 active:scale-[0.98] transition-all flex items-center justify-between"
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
                                    <h3 className="font-bold text-lg leading-none">Coleta em Tempo Real</h3>
                                    <span className="bg-red-500 text-[9px] font-bold px-1.5 py-0.5 rounded text-white animate-pulse">AO VIVO</span>
                                </div>
                                <p className="text-xs text-emerald-100 font-medium">Veja onde o caminhão do lixo está agora.</p>
                            </div>
                        </div>
                        
                        <div className="relative z-10 bg-white/20 p-2 rounded-full">
                            <span className="material-symbols-outlined">chevron_right</span>
                        </div>
                    </button>
                )}

                {/* PROMOTIONAL BANNER */}
                {!searchTerm && (
                    <div className="relative w-full h-32 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700 overflow-hidden shadow-lg p-5 flex flex-col justify-center animate-in fade-in slide-in-from-top-4 duration-500 mb-6">
                        <div className="absolute right-0 top-0 h-full w-1/2 opacity-10">
                            <span className="material-symbols-outlined text-[140px] text-white -mr-8 -mt-8">language</span>
                        </div>
                        <h3 className="text-white font-black text-lg relative z-10 leading-tight">Facilidade Digital<br/>para você</h3>
                        <p className="text-blue-100 text-[10px] mt-1 relative z-10 max-w-[65%] font-medium opacity-90">Acesse portais oficiais, emita boletos e consulte dados sem filas.</p>
                    </div>
                )}

                {filteredServices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-10 text-center">
                        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">search_off</span>
                        <p className="text-gray-500">Nenhum serviço encontrado.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {filteredServices.map((service, index) => {
                            const colors = getColorClasses(service.colorTheme);
                            return (
                                <button 
                                    key={service.id}
                                    onClick={() => handleServiceClick(service)}
                                    className={`relative flex flex-col items-start p-4 rounded-2xl bg-white dark:bg-card-dark border ${colors.border} shadow-sm hover:shadow-md active:scale-[0.97] transition-all group h-full min-h-[140px] text-left`}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="flex justify-between w-full items-start mb-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colors.bg} ${colors.icon} shadow-inner`}>
                                            <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">{service.icon}</span>
                                        </div>
                                        <span className="material-symbols-outlined text-gray-300 text-sm">arrow_outward</span>
                                    </div>
                                    
                                    <div className="flex-1">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight mb-1 line-clamp-2">{service.title}</h3>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{service.description}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        )}
      </main>

      <style>{`
        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default InfoServicesScreen;
