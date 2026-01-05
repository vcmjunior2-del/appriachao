
import React from 'react';
import { Screen } from '../types';
import { useAuth } from '../contexts/AuthContext'; // Import Auth

interface BottomNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentScreen, onNavigate }) => {
  return null; 
};

export const DashboardBottomNav: React.FC<BottomNavProps> = ({ currentScreen, onNavigate }) => {
    const { currentUser } = useAuth(); // Get user

    return (
        <nav className="fixed bottom-0 z-30 w-full max-w-md bg-white dark:bg-card-dark border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
            <div className="grid grid-cols-5 h-[4.5rem] px-1">
                
                {/* Item 1: Início */}
                <button 
                    onClick={() => onNavigate(Screen.HOME)}
                    className={`group flex flex-col items-center justify-end pb-2 gap-1 w-full h-full transition-colors ${currentScreen === Screen.HOME ? 'text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                    <span className="material-symbols-outlined text-[26px] transition-transform group-active:scale-90" style={{ fontVariationSettings: currentScreen === Screen.HOME ? "'FILL' 1" : "'FILL' 0" }}>home</span>
                    <span className="text-[10px] font-medium leading-none tracking-wide">Início</span>
                </button>
                
                {/* Item 2: Serviços (Info Services / Portal) */}
                <button 
                    onClick={() => onNavigate(Screen.INFO_SERVICES)}
                    className={`group flex flex-col items-center justify-end pb-2 gap-1 w-full h-full transition-colors ${currentScreen === Screen.INFO_SERVICES ? 'text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                    <span className="material-symbols-outlined text-[26px] transition-transform group-active:scale-90" style={{ fontVariationSettings: currentScreen === Screen.INFO_SERVICES ? "'FILL' 1" : "'FILL' 0" }}>grid_view</span>
                    <span className="text-[10px] font-medium leading-none tracking-wide">Serviços</span>
                </button>

                {/* Item 3: Ocorrências (Reportar Problemas) */}
                <button 
                    onClick={() => onNavigate(Screen.SERVICES)}
                    className={`group flex flex-col items-center justify-end pb-2 gap-1 w-full h-full transition-colors ${currentScreen === Screen.SERVICES ? 'text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                    <span className="material-symbols-outlined text-[26px] transition-transform group-active:scale-90" style={{ fontVariationSettings: currentScreen === Screen.SERVICES ? "'FILL' 1" : "'FILL' 0" }}>assignment_late</span>
                    <span className="text-[10px] font-medium leading-none tracking-wide">Ocorrências</span>
                </button>

                {/* Item 4: Emergências (Red) */}
                <button 
                    onClick={() => onNavigate(Screen.EMERGENCY)}
                    className={`group flex flex-col items-center justify-end pb-2 gap-1 w-full h-full transition-colors ${currentScreen === Screen.EMERGENCY ? 'text-red-600 dark:text-red-500' : 'text-red-500/70 dark:text-red-400/70 hover:text-red-600 dark:hover:text-red-400'}`}
                >
                    <span className="material-symbols-outlined text-[26px] transition-transform group-active:scale-90" style={{ fontVariationSettings: currentScreen === Screen.EMERGENCY ? "'FILL' 1" : "'FILL' 0" }}>sos</span>
                    <span className="text-[10px] font-bold leading-none tracking-wide">Emergências</span>
                </button>

                {/* Item 5: Perfil (PHOTO AVATAR) -> Renomeado para 'Você' */}
                <button 
                    onClick={() => onNavigate(Screen.PROFILE)}
                    className={`group flex flex-col items-center justify-end pb-2 gap-1 w-full h-full transition-colors ${currentScreen === Screen.PROFILE ? 'text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                    <div className={`transition-transform group-active:scale-90 ${currentScreen === Screen.PROFILE ? 'scale-110' : ''}`}>
                        {currentUser?.photoURL ? (
                            <img 
                                src={currentUser.photoURL} 
                                alt="Perfil" 
                                className={`w-7 h-7 rounded-full object-cover border-2 ${currentScreen === Screen.PROFILE ? 'border-primary' : 'border-transparent'}`} 
                            />
                        ) : (
                            <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: currentScreen === Screen.PROFILE ? "'FILL' 1" : "'FILL' 0" }}>person</span>
                        )}
                    </div>
                    <span className="text-[10px] font-medium leading-none tracking-wide">Você</span>
                </button>
            </div>
        </nav>
    )
}
