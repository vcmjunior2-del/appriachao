
import React from 'react';

interface SplashScreenProps {
  isVisible: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background-light dark:bg-background-dark animate-out fade-out duration-700 fill-mode-forwards">
      
      {/* Background Gradient Blob effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 rounded-full blur-3xl opacity-50 animate-pulse"></div>

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col items-center">
        
        {/* Logo Container with Pulse Animation */}
        <div className="relative mb-6">
            <div className="w-24 h-24 bg-white dark:bg-[#1e293b] rounded-3xl shadow-xl flex items-center justify-center border border-gray-100 dark:border-gray-700 animate-bounce-gentle">
                 {/* Replace with actual Image tag if available: <img src="..." /> */}
                 <span className="material-symbols-outlined text-primary text-[48px]">account_balance</span>
            </div>
            {/* Loading Ring */}
            <div className="absolute -inset-2 border-2 border-primary/30 border-t-primary rounded-3xl animate-spin-slow"></div>
        </div>

        {/* Text */}
        <div className="text-center space-y-2 animate-in slide-in-from-bottom-4 duration-700 fade-in">
            <h2 className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-[0.3em]">Prefeitura de</h2>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Riachão</h1>
        </div>

      </div>

      {/* Bottom version text */}
      <div className="absolute bottom-10 text-gray-400 text-[10px] font-medium tracking-wide">
        Carregando serviços...
      </div>

      {/* Inline Styles for specific animations not in Tailwind default config */}
      <style>{`
        @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
            animation: spin-slow 3s linear infinite;
        }
        @keyframes bounce-gentle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
        .animate-bounce-gentle {
            animation: bounce-gentle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
