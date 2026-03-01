import React, { useEffect, useState } from 'react';
import { useAlert } from '../contexts/AlertContext';

interface EmergencyScreenProps {
  onBack: () => void;
  isActive?: boolean;
}

const EmergencyScreen: React.FC<EmergencyScreenProps> = ({ onBack, isActive }) => {
  const [isPressing, setIsPressing] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('Obtendo localização...');
  const { showAlert } = useAlert();
  const rootRef = React.useRef<HTMLDivElement>(null);
  
  // Logic: Fetch GPS and Address on Mount
  useEffect(() => {
    let mounted = true;

    const fetchLocation = () => {
        if (!navigator.geolocation) {
            if (mounted) setCurrentAddress('GPS não suportado');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                try {
                    // Reverse Geocoding using BigDataCloud
                    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`);
                    
                    if (!mounted) return;

                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }

                    const data = await response.json();
                    
                    if (data && data.locality) {
                        let formatted = '';
                        
                        // Try to get street name (often in 'localityInfo.informative' or similar, but BigDataCloud free tier 
                        // sometimes puts it in 'locality' or 'principalSubdivision' depending on the region).
                        // A more reliable way with BigDataCloud free tier is to check for 'locality' (neighborhood/street level)
                        // and 'city' (city level).
                        
                        const street = data.localityInfo?.informative?.find((info: any) => info.order === 6 || info.order === 7)?.name || '';
                        const neighborhood = data.locality || '';
                        const city = data.city || data.principalSubdivision || '';

                        const parts = [];
                        if (street && street !== neighborhood) parts.push(street);
                        if (neighborhood) parts.push(neighborhood);
                        if (city && city !== neighborhood) parts.push(city);

                        if (parts.length > 0) {
                            formatted = parts.join(', ');
                        } else {
                            formatted = 'Localização Identificada';
                        }
                        
                        setCurrentAddress(formatted);
                    } else {
                        setCurrentAddress(`Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`);
                    }
                } catch (error) {
                    // Fail gracefully without console.error to prevent "Failed to fetch" noise
                    if (mounted) setCurrentAddress(`Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`);
                }
            },
            (error) => {
                console.warn("GPS Error", error);
                if (mounted) setCurrentAddress('Localização indisponível');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    fetchLocation();

    return () => { mounted = false; };
  }, []);

  // Simulation of press-and-hold logic
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isPressing) {
        timer = setTimeout(() => {
            showAlert({
                title: 'SOS Enviado',
                message: `Sinal de SOS enviado! Localização: ${currentAddress}`,
                type: 'success'
            });
            setIsPressing(false);
        }, 3000);
    }
    return () => clearTimeout(timer);
  }, [isPressing, currentAddress, showAlert]);

  return (
    <div ref={rootRef} className="relative flex h-full min-h-full w-full flex-col overflow-y-auto overflow-x-hidden bg-background-light dark:bg-background-dark font-display custom-scrollbar pb-24">
      {/* Inline Style for Pulse Animation */}
      <style>{`
        .pulse-ring {
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        @keyframes pulse-ring {
            0% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
            }
            70% {
                transform: scale(1);
                box-shadow: 0 0 0 20px rgba(239, 68, 68, 0);
            }
            100% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
            }
        }
      `}</style>

      {/* Header */}
      <header id="emergency-header" className="flex items-center bg-white dark:bg-card-dark p-4 pb-2 justify-between sticky top-0 z-50 shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1 -ml-1 text-gray-500 dark:text-gray-400 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">my_location</span>
              Localização Atual
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white leading-tight mt-0.5 animate-in fade-in">
                {currentAddress}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button className="text-primary font-bold text-sm px-3 py-1.5 bg-primary/5 rounded-full hover:bg-primary/10 transition-colors">Ajuda</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 pb-24 pt-4">
        {/* SOS Section */}
        <section className="flex flex-col items-center justify-center py-6 mb-2 rounded-2xl bg-gradient-to-b from-transparent to-red-50/50 dark:to-red-900/10">
          <h1 className="text-gray-900 dark:text-white tracking-tight text-[22px] font-extrabold leading-tight text-center mb-6">
            Emergência Imediata
          </h1>
          <div className="relative flex items-center justify-center mb-6">
            <div className={`absolute inset-0 rounded-full bg-red-500/20 w-52 h-52 m-auto transition-all duration-300 ${isPressing ? 'scale-110 bg-red-500/30' : 'pulse-ring'}`}></div>
            <button 
                onMouseDown={() => setIsPressing(true)}
                onMouseUp={() => setIsPressing(false)}
                onMouseLeave={() => setIsPressing(false)}
                onTouchStart={(e) => { e.preventDefault(); setIsPressing(true); }}
                onTouchEnd={(e) => { e.preventDefault(); setIsPressing(false); }}
                className={`relative z-10 flex flex-col items-center justify-center w-44 h-44 rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-xl transition-transform duration-200 border-[6px] border-white dark:border-background-dark group ring-4 ring-red-500/10 select-none touch-none [-webkit-touch-callout:none] ${isPressing ? 'scale-95' : 'active:scale-95'}`}
            >
              <span className="material-symbols-outlined text-white text-[56px] mb-1 drop-shadow-md">sos</span>
              <span className="text-white text-xs font-bold uppercase tracking-[0.2em] drop-shadow-sm">{isPressing ? 'Enviando...' : 'Segure 3s'}</span>
              <span className="absolute inset-0 rounded-full border border-white/20"></span>
            </button>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-[280px] leading-relaxed">
            Ao ativar, sua localização será enviada imediatamente para as autoridades e contatos de emergência.
          </p>
        </section>

        {/* Report Types List */}
        <section className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-900 dark:text-white tracking-tight text-lg font-bold leading-tight text-left flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">campaign</span>
              Reportar Ocorrência
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            {[
                { title: 'Enchente ou Alagamento', desc: 'Reportar inundações em vias públicas', icon: 'flood', color: 'blue' },
                { title: 'Deslizamento de Terra', desc: 'Reportar risco em encostas', icon: 'landslide', color: 'amber' },
                { title: 'Incêndio em Vegetação', desc: 'Reportar queimadas ilegais', icon: 'forest', color: 'orange' },
                { title: 'Outras Ocorrências', desc: 'Acidentes, árvores caídas, etc.', icon: 'report_problem', color: 'gray' },
            ].map((item) => (
                <button 
                    key={item.title}
                    className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-card-dark p-3 pr-4 shadow-sm active:bg-gray-50 dark:active:bg-gray-800 hover:border-gray-300 transition-colors group"
                >
                    <div className={`relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-${item.color}-50 dark:bg-${item.color}-900/10 border border-${item.color}-100 dark:border-${item.color}-900/30`}>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`material-symbols-outlined text-${item.color}-600 dark:text-${item.color}-400 text-[28px]`}>{item.icon}</span>
                        </div>
                    </div>
                    <div className="flex-1 text-left">
                        <h4 className={`text-gray-900 dark:text-white font-bold text-base group-hover:text-${item.color}-600 dark:group-hover:text-${item.color}-400 transition-colors`}>{item.title}</h4>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{item.desc}</p>
                    </div>
                    <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 group-hover:translate-x-1 transition-transform">chevron_right</span>
                </button>
            ))}
          </div>
        </section>

        {/* Emergency Contacts Grid */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-900 dark:text-white tracking-tight text-lg font-bold leading-tight text-left flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">phone_in_talk</span>
              Serviços de Emergência
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
                { name: 'SAMU', sub: 'Ambulância', num: '192', color: 'red', icon: 'medical_services' },
                { name: 'Polícia', sub: 'Militar', num: '190', color: 'blue', icon: 'local_police' },
                { name: 'Bombeiros', sub: 'Resgate', num: '193', color: 'orange', icon: 'local_fire_department' },
                { name: 'Defesa Civil', sub: 'Desastres', num: '199', color: 'yellow', icon: 'shield' },
            ].map((item) => (
                <a 
                    key={item.num}
                    href={`tel:${item.num}`}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-card-dark p-4 items-start shadow-sm hover:shadow-md transition-all active:bg-gray-50 dark:active:bg-gray-800 relative overflow-hidden group"
                >
                    <div className="absolute right-0 top-0 p-2 opacity-50 group-hover:opacity-100 transition-opacity">
                        <span className={`material-symbols-outlined text-${item.color}-500/20 text-[48px] -mr-2 -mt-2 rotate-12`}>{item.icon}</span>
                    </div>
                    <div className={`w-10 h-10 rounded-full bg-${item.color}-100 dark:bg-${item.color}-900/30 flex items-center justify-center text-${item.color}-600 dark:text-${item.color}-400 relative z-10`}>
                        <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
                    </div>
                    <div className="text-left relative z-10 w-full">
                        <div className="flex justify-between items-end w-full">
                            <div>
                                <h2 className="text-gray-900 dark:text-white text-base font-bold leading-tight">{item.name}</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mt-1">{item.sub}</p>
                            </div>
                            <span className={`text-lg font-black text-${item.color}-600 dark:text-${item.color}-400`}>{item.num}</span>
                        </div>
                    </div>
                </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default EmergencyScreen;