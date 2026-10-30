import React, { useState, useEffect, useRef } from 'react';
import { Screen, ServiceTypeDefinition, Secretariat, OccurrenceSubject } from '../types';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AnimatePresence, motion } from 'framer-motion';

interface ServicesScreenProps {
  onBack: () => void;
  onSelectService: (service: ServiceTypeDefinition) => void;
  activeSecretariat: Secretariat | null; 
  onSelectSecretariat: (secretariat: Secretariat | null) => void; 
  registerBackHandler?: (handler: (() => boolean) | null) => void;
}

// --- Global Caches ---
let cachedSubjects: OccurrenceSubject[] | null = null;
let cachedSecretariats: Secretariat[] | null = null;
let cachedServices: ServiceTypeDefinition[] | null = null;

const ServicesScreen: React.FC<ServicesScreenProps> = ({ onBack, onSelectService, activeSecretariat, onSelectSecretariat, registerBackHandler }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data State initialized from cache
  const [subjects, setSubjects] = useState<OccurrenceSubject[]>(cachedSubjects || []);
  const [secretariats, setSecretariats] = useState<Secretariat[]>(cachedSecretariats || []); 
  const [allServices, setAllServices] = useState<ServiceTypeDefinition[]>(cachedServices || []);
  
  // CRITICAL: Ensure loading is false if caches exist to prevent flicker
  const hasCache = cachedSubjects !== null && cachedServices !== null;
  const [loading, setLoading] = useState(!hasCache);

  // Active Selection State
  const [activeSubject, setActiveSubject] = useState<OccurrenceSubject | null>(null);

  // Sync back handler with activeSubject (allows edge swipe back inside an occurrence)
  useEffect(() => {
    if (registerBackHandler) {
      if (activeSubject) {
        registerBackHandler(() => {
          setActiveSubject(null);
          setSearchTerm('');
          return true;
        });
      } else {
        registerBackHandler(null);
      }
    }
  }, [activeSubject, registerBackHandler]);

  useEffect(() => {
    return () => {
      registerBackHandler?.(null);
    };
  }, [registerBackHandler]);

  // --- Helper: Color Mapping ---
  const getThemeColors = (theme?: string) => {
      switch(theme) {
          case 'blue': return { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-100 dark:border-blue-800' };
          case 'green': return { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', border: 'border-green-100 dark:border-green-800' };
          case 'red': return { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-100 dark:border-red-800' };
          case 'yellow': return { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-800' };
          case 'purple': return { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-100 dark:border-purple-800' };
          case 'orange': return { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-100 dark:border-orange-800' };
          default: return { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-100 dark:border-slate-700' };
      }
  };

  const isUrl = (str: string) => str.includes('http') || str.includes('data:');
  const getSecretariatName = (id: string) => secretariats.find(s => s.id === id)?.name || '';

  const formatSecretariatName = (name: string) => {
      if (!name) return 'Prefeitura Municipal';
      // Remove prefixos comuns (case insensitive)
      const cleanName = name
          .replace(/Secretaria Municipal d[eao]s? /gi, '')
          .replace(/Secretaria d[eao]s? /gi, '')
          .replace(/Departamento d[eao]s? /gi, '')
          .replace(/Superintendência d[eao]s? /gi, '')
          .replace(/Diretoria d[eao]s? /gi, '');
      
      return cleanName;
  };

  // --- Fetch Data ---
  useEffect(() => {
    let subsLoaded = false;
    let servsLoaded = false;

    // 1. Fetch Subjects
    const unsubSub = onSnapshot(query(collection(db, "occurrence_subjects"), where("active", "==", true)), 
        (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OccurrenceSubject));
            setSubjects(data);
            cachedSubjects = data;
            subsLoaded = true;
            if (subsLoaded && servsLoaded) setLoading(false);
        },
        (error) => console.warn("Subjects Error", error)
    );

    // 2. Fetch Secretariats (For Names)
    const unsubSec = onSnapshot(query(collection(db, "secretariats")), 
        (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Secretariat));
            setSecretariats(data);
            cachedSecretariats = data;
        },
        (error) => console.warn("Secretariats Error", error)
    );

    // 3. Fetch Services
    const unsubServices = onSnapshot(query(collection(db, "service_types"), where("active", "==", true)), 
        (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceTypeDefinition));
            setAllServices(data);
            cachedServices = data;
            servsLoaded = true;
            if (subsLoaded && servsLoaded) setLoading(false);
        },
        (error) => {
            console.warn("Services Error", error);
            setLoading(false);
        }
    );

    // Safety fallback: If cache exists, ensure loading is false immediately after mount to catch any state drift
    if (cachedSubjects && cachedServices) setLoading(false);

    return () => { unsubSub(); unsubSec(); unsubServices(); }
  }, []);

  // Sempre volta ao topo ao abrir ou fechar um assunto de ocorrência
  useEffect(() => {
    const parentScroll = rootRef.current?.parentElement;
    if (parentScroll) {
      parentScroll.scrollTo({ top: 0, behavior: 'instant' });
      parentScroll.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeSubject]);

  // --- Navigation Handlers ---
  const handleBack = () => {
      if (activeSubject) {
          setActiveSubject(null);
          setSearchTerm('');
      } else {
          onBack();
      }
  };

  const handleSelectSubject = (subject: OccurrenceSubject) => {
      setActiveSubject(subject);
      setSearchTerm('');
  };

  // --- Filtering Logic ---
  
  // 1. Subjects Grid Filter
  const filteredSubjects = subjects.filter(s => 
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. Services List Filter (Inside Subject)
  const filteredServices = activeSubject 
      ? allServices.filter(s => 
          s.subjectId === activeSubject.id && // Must match Subject ID
          (s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
           s.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      : [];

  return (
    <div ref={rootRef} className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark pb-16 font-display">
       
       {/* Modern Header */}
       <div className="bg-white dark:bg-card-dark shadow-sm border-b border-gray-100 dark:border-gray-800 pb-2 z-10 sticky top-0">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <button 
                    onClick={handleBack}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-800 dark:text-slate-200 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        {activeSubject ? 'Nova Solicitação' : 'Ocorrências'}
                    </span>
                </div>
            </div>

            <div className="px-6 pb-4">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-1">
                    {activeSubject ? activeSubject.title : 'O que você precisa?'}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {activeSubject 
                        ? `Selecione o tipo de problema em ${activeSubject.title}.` 
                        : 'Escolha um assunto para reportar um problema.'}
                </p>
            </div>

            {/* Search Bar */}
            <div className="px-4 pb-2">
                <div className="group relative flex items-center w-full h-12 rounded-2xl bg-gray-100 dark:bg-gray-800/50 border border-transparent focus-within:bg-white dark:focus-within:bg-gray-900 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all overflow-hidden">
                    <div className="flex items-center justify-center pl-4 pr-2 text-gray-400">
                        <span className="material-symbols-outlined">search</span>
                    </div>
                    <input 
                        className="w-full bg-transparent border-none text-base text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-0 focus:outline-none h-full" 
                        placeholder={activeSubject ? "Buscar serviço específico..." : "Buscar assunto (ex: Luz, Lixo)..."}
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
       </div>

      <main className="flex-1 px-4 py-4 space-y-4 overflow-y-auto no-scrollbar">
        
        {loading ? (
             // SKELETON LOADER
             <div className="space-y-4 animate-pulse">
                 <div className="w-full h-32 bg-gray-200 dark:bg-gray-800 rounded-3xl mb-6"></div>
                 <div className="grid grid-cols-2 gap-3">
                     <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
                     <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
                     <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
                     <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
                 </div>
             </div>
        ) : (
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={activeSubject ? `subject-${activeSubject.id}` : 'subjects-root'}
                    initial={{ opacity: 0, y: 12, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.985 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full screen-stagger-scope"
                >
                    {/* PROMOTIONAL BANNER */}
                    {!searchTerm && !activeSubject && (
                        <div className="relative w-full h-32 rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-600 overflow-hidden shadow-lg p-5 flex flex-col justify-center mb-6 shrink-0">
                            <div className="absolute right-0 top-0 h-full w-1/2 opacity-10">
                                <span className="material-symbols-outlined text-[140px] text-white -mr-8 -mt-4">handyman</span>
                            </div>
                            <h3 className="text-white font-black text-lg relative z-10 leading-tight">Ajude a cuidar<br/>da nossa cidade</h3>
                            <p className="text-indigo-100 text-[10px] mt-1 relative z-10 max-w-[65%] font-medium opacity-90">
                                Viu algo errado? Abra uma ocorrência de iluminação, limpeza ou obras e acompanhe.
                            </p>
                        </div>
                    )}

                    {/* EMPTY STATE SUBJECTS */}
                    {!activeSubject && filteredSubjects.length === 0 && (
                        <div className="text-center py-10 text-gray-500">
                            <p>Nenhum assunto encontrado.</p>
                        </div>
                    )}

                    {/* SUBJECTS GRID */}
                    {!activeSubject && filteredSubjects.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                            {filteredSubjects.map(subject => {
                                const colors = getThemeColors(subject.colorTheme);
                                const iconIsImg = isUrl(subject.icon);
                                const count = allServices.filter(s => s.subjectId === subject.id).length;
                                const secName = getSecretariatName(subject.secretariatId);
                                const displaySecName = formatSecretariatName(secName);

                                return (
                                    <button
                                        key={subject.id}
                                        onClick={() => handleSelectSubject(subject)}
                                        className="relative flex flex-col items-start p-4 rounded-3xl bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left group min-h-[170px] justify-between overflow-hidden"
                                    >
                                        {/* Top Row: Icon and Badge */}
                                        <div className="flex w-full justify-between items-start mb-3">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors.bg} ${colors.text} shrink-0 overflow-hidden transition-transform group-hover:scale-105 shadow-inner`}>
                                                {iconIsImg ? (
                                                    <img src={subject.icon} alt="icon" className="w-full h-full object-contain p-2" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-[32px]">{subject.icon}</span>
                                                )}
                                            </div>
                                            <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${colors.bg} ${colors.text} flex items-center gap-1`}>
                                                {count} Opções
                                            </span>
                                        </div>
                                        
                                        {/* Content */}
                                        <div className="w-full flex-1 flex flex-col gap-1 mb-2">
                                            <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight line-clamp-2">{subject.title}</h3>
                                            <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 line-clamp-3 leading-tight mt-0.5">{subject.description}</p>
                                        </div>

                                        {/* Footer: Secretariat Name */}
                                        <div className="w-full pt-2 mt-auto border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <span className="material-symbols-outlined text-[12px] text-slate-400">business</span>
                                            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 truncate w-full text-left" title={secName}>
                                                {displaySecName}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* EMPTY STATE SERVICES */}
                    {activeSubject && filteredServices.length === 0 && (
                        <div className="flex flex-col items-center justify-center pt-20 text-center">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-3xl text-gray-400">folder_off</span>
                            </div>
                            <h3 className="text-gray-900 dark:text-white font-bold text-lg">Sem serviços disponíveis</h3>
                            <p className="text-gray-500 text-sm mt-1 max-w-[250px]">Nenhum tipo de ocorrência cadastrado para este assunto ainda.</p>
                        </div>
                    )}

                    {/* SERVICES LIST */}
                    {activeSubject && filteredServices.length > 0 && (
                        <div className="grid grid-cols-1 gap-3">
                            {filteredServices.map(service => {
                                const colors = getThemeColors(service.colorTheme);
                                const isImg = isUrl(service.icon);
                                return (
                                    <button 
                                        key={service.id}
                                        onClick={() => onSelectService(service)}
                                        className={`flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-card-dark border ${colors.border} shadow-sm active:scale-[0.98] transition-all group text-left`}
                                    >
                                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${colors.bg} ${isImg ? '' : colors.text} overflow-hidden`}>
                                            {isImg ? (
                                                <img src={service.icon} alt="Icon" className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform" />
                                            ) : (
                                                <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">{service.icon}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight mb-1">{service.title}</h3>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">{service.description}</p>
                                        </div>
                                        <span className="material-symbols-outlined text-gray-300 dark:text-gray-600">chevron_right</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        )}
      </main>
    </div>
  );
};

export default ServicesScreen;
