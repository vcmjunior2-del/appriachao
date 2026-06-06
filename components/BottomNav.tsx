import React from 'react';
import { Screen } from '../types';
import { useAuth } from '../contexts/AuthContext'; // Import Auth

interface BottomNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  scrollDirection?: 'up' | 'down';
}

const BottomNav: React.FC<BottomNavProps> = ({ currentScreen, onNavigate }) => {
  return null; 
};

export const DashboardBottomNav: React.FC<BottomNavProps> = ({ currentScreen, onNavigate, scrollDirection = 'up' }) => {
    const { currentUser, userData } = useAuth(); // Get user and userData
    const isCompact = scrollDirection === 'down';

    const renderNavItem = (screen: Screen, icon: string, label: string, isProfile = false) => {
        const isActive = currentScreen === screen;
        
        return (
            <button 
                onClick={() => onNavigate(screen)}
                className="group relative flex flex-col items-center justify-center w-full h-full cursor-pointer focus:outline-none select-none transition-all duration-300"
            >
                {/* Active Backdrop Capsule (Like Modern WhatsApp/Material You / Instagram style) */}
                <div className={`absolute rounded-2xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-blue-50/90 dark:bg-blue-950/40 w-12 h-8 opacity-100 scale-100 shadow-[0_2px_12px_rgba(19,91,236,0.1)]' 
                      : 'w-0 h-0 opacity-0 scale-75 group-hover:bg-slate-100/50 dark:group-hover:bg-slate-800/30 group-hover:w-10 group-hover:h-7 group-hover:opacity-100'
                }`} />

                {/* Icon Wrapper */}
                <div className={`relative z-10 flex items-center justify-center transition-all duration-300 ${
                    isCompact ? 'translate-y-0.5 scale-90' : 'translate-y-0 scale-100'
                } ${
                    isActive 
                      ? 'text-[#135bec] dark:text-blue-400 font-bold scale-105' 
                      : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                }`}>
                    {isProfile && currentUser?.photoURL ? (
                        <div className="relative">
                            <img 
                                src={currentUser.photoURL} 
                                alt="Perfil" 
                                className={`rounded-full object-cover border-2 shadow-sm transition-all duration-300 ${
                                    isCompact ? 'w-6 h-6' : 'w-7 h-7'
                                } ${isActive ? 'border-[#135bec] dark:border-blue-400' : 'border-slate-355'}`} 
                            />
                            {userData?.isVerified && (
                                <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full p-[0.5px] border border-white dark:border-slate-900 z-10">
                                    <span className="material-symbols-outlined text-white text-[7px] font-bold block">verified</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: isActive ? "'FILL' 1, 'wght' 600" : "'FILL' 0, 'wght' 400" }}>
                            {icon}
                        </span>
                    )}
                </div>

                {/* Label (WhatsApp/Instagram layout) - Hides completely when scrolled down */}
                <span className={`z-10 text-[9px] mt-1 font-medium tracking-wide transition-all duration-300 ${
                    isCompact 
                      ? 'opacity-0 scale-50 max-h-0 overflow-hidden pointer-events-none' 
                      : 'opacity-100 max-h-4'
                } ${
                    isActive 
                      ? 'text-[#135bec] dark:text-blue-400 font-extrabold' 
                      : 'text-slate-500 dark:text-slate-400'
                }`}>
                    {label}
                </span>
            </button>
        );
    };

    return (
        <nav className={`absolute left-4 right-4 z-30 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/40 shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_45px_rgba(0,0,0,0.35)] ${
            isCompact 
              ? 'bottom-3 h-12 rounded-full scale-95 opacity-90 hover:opacity-100 px-3' 
              : 'bottom-4 h-16 rounded-[20px] scale-100 px-1'
        }`}>
            <div className={`grid grid-cols-5 h-full items-center`}>
                {renderNavItem(Screen.HOME, 'home', 'Início')}
                {renderNavItem(Screen.INFO_SERVICES, 'grid_view', 'Serviços')}
                {renderNavItem(Screen.SERVICES, 'assignment_late', 'Ocorrências')}
                {renderNavItem(Screen.EMERGENCY, 'sos', 'Emergências')}
                {renderNavItem(Screen.PROFILE, 'person', 'Você', true)}
            </div>
        </nav>
    )
}
