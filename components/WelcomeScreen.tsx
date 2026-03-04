import React from 'react';
import { useConfig } from '../contexts/ConfigContext';

interface WelcomeScreenProps {
  onLogin: () => void;
  onRegister: () => void;
  onAdminLogin: () => void;
  onGuestLogin: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onLogin, onRegister, onAdminLogin, onGuestLogin }) => {
  const { config } = useConfig();

  // Fallback defaults if config is not loaded yet or empty
  const backgroundUrl = config?.welcomeBackgroundUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuAz15pTge5gcJNUsuzOXCqSFInSQaWTbByWJauicm5UKi1hw9VH6lZ_JRLUvPmCXC1LoWUF8JA4P7bC94TwyCg4Ma3HTPBTnVw4W8mg8hY6T1qS3M284oOaKvV6jYnqsbu9_4NSdCnhIH2HkKpXBP3sIPRx838ZOCcunRqN3th-mrpUja4pAf5mld-kvzR1Fy2f2X9K9hI3WGForbYXz64M4yez1ByzV69Wk27h2TTg2cn7bryDJdfMD-NTABYOPrxUF13Z-9i7YgGE";
  const logoUrl = config?.logoUrl || "";
  const municipalityName = config?.municipalityName || "Prefeitura Municipal de";
  const appName = config?.appName || "Riachão";

  return (
    <div className="relative flex h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden">
        {/* Immersive Background Image Area */}
        <div className="absolute top-0 left-0 w-full h-[60%]">
             <div 
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url("${backgroundUrl}")` }}
             >
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-background-light dark:to-background-dark/80"></div>
             </div>
        </div>

        {/* Branding Overlay */}
        <div className="absolute top-16 left-0 w-full flex flex-col items-center justify-center z-10 animate-in fade-in slide-in-from-top-4 duration-700">
             <div className="h-24 w-24 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-2xl mb-4 overflow-hidden relative">
                 {logoUrl ? (
                     <>
                         <img 
                             src={logoUrl} 
                             alt="Logo" 
                             className="w-full h-full object-contain p-2" 
                             referrerPolicy="no-referrer"
                             onError={(e) => {
                                 e.currentTarget.style.display = 'none';
                                 const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                 if (fallback) fallback.style.display = 'block';
                             }}
                         />
                         <span className="material-symbols-outlined text-[48px] drop-shadow-md hidden" style={{ display: 'none' }}>account_balance</span>
                     </>
                 ) : (
                     <span className="material-symbols-outlined text-[48px] drop-shadow-md">account_balance</span>
                 )}
             </div>
             <h2 className="text-white/90 font-bold text-xs tracking-[0.2em] uppercase drop-shadow-md mb-1">{municipalityName}</h2>
             <h1 className="text-white font-extrabold text-4xl tracking-tight drop-shadow-lg">{appName}</h1>
        </div>

        {/* Bottom Card content */}
        <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-card-dark rounded-t-[2.5rem] shadow-[0_-10px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col items-center px-8 pt-10 pb-8 z-20 animate-in slide-in-from-bottom-10 duration-500">
            {/* Handle Bar */}
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-6"></div>
            
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-3 leading-tight">
                Sua cidade na<br/>palma da mão
            </h3>
            
            <p className="text-center text-slate-500 dark:text-gray-400 text-base mb-6 leading-relaxed max-w-xs">
                Acesse serviços, faça solicitações, acompanhe obras e receba alertas da prefeitura em um só lugar.
            </p>

            <div className="flex flex-col gap-3 w-full">
                <button 
                    onClick={onLogin}
                    className="w-full bg-[#135bec] hover:bg-blue-700 text-white font-bold h-14 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                >
                    <div className="bg-white/20 p-1 rounded-md">
                        <span className="material-symbols-outlined text-[18px]">login</span>
                    </div>
                    <span>Entrar</span>
                </button>
                
                <button 
                    onClick={onRegister}
                    className="w-full bg-transparent border-2 border-gray-100 dark:border-gray-700 text-slate-600 dark:text-gray-300 font-bold h-14 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-[0.98] flex items-center justify-center"
                >
                    Criar Conta
                </button>
            </div>

            <button 
                onClick={onGuestLogin}
                className="mt-4 text-sm font-semibold text-gray-500 hover:text-primary transition-colors flex items-center gap-1"
            >
                <span>Continuar sem login</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
            
            <div className="mt-6 flex flex-col items-center gap-2">
                <p className="text-[10px] text-gray-400 text-center leading-normal">
                    Ao continuar, você concorda com nossos <br/>
                    <span className="underline cursor-pointer hover:text-primary">Termos de Uso</span> e <span className="underline cursor-pointer hover:text-primary">Política de Privacidade</span>.
                </p>
                <button onClick={onAdminLogin} className="mt-2 text-[10px] font-bold text-gray-400 hover:text-primary uppercase tracking-wider">
                    Acesso Administrativo
                </button>
            </div>
        </div>
    </div>
  );
};

export default WelcomeScreen;
