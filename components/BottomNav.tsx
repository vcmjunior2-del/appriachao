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
    const { currentUser, userData } = useAuth(); // Get user and userData

    const renderNavItem = (screen: Screen, icon: string, label: string, isProfile = false) => {
        const isActive = currentScreen === screen;
        
        return (
            <button 
                onClick={() => onNavigate(screen)}
                className={`group relative flex flex-col items-center justify-end pb-3 gap-1 w-full h-full transition-all duration-300 ${
                    isActive ? 'text-white' : 'text-blue-200 hover:text-white'
                }`}
            >
                {/* Top Indicator */}
                <span className={`absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-white rounded-b-full shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-300 ease-out ${
                    isActive ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                }`} />

                {/* Icon */}
                <div className={`relative transition-all duration-300 ease-out transform ${isActive ? '-translate-y-1 scale-110' : 'translate-y-0 scale-100'}`}>
                    {isProfile && currentUser?.photoURL ? (
                        <>
                            <img 
                                src={currentUser.photoURL} 
                                alt="Perfil" 
                                className={`w-7 h-7 rounded-full object-cover border-2 shadow-sm ${isActive ? 'border-white' : 'border-blue-200/50'}`} 
                            />
                            {userData?.isVerified && (
                                <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full p-[1px] border border-[#135bec] dark:border-[#0e45b5] z-10">
                                    <span className="material-symbols-outlined text-white text-[8px] font-bold block">verified</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: isActive ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400" }}>
                            {icon}
                        </span>
                    )}
                </div>

                {/* Label */}
                <span className={`text-[10px] font-medium leading-none tracking-wide transition-all duration-300 ${
                    isActive ? 'opacity-100 font-semibold' : 'opacity-70'
                }`}>
                    {label}
                </span>
            </button>
        );
    };

    return (
        <nav className="absolute bottom-0 z-30 w-full max-w-md bg-[#135bec] dark:bg-[#0e45b5] shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
            <div className="grid grid-cols-5 h-[4.5rem] px-1">
                {renderNavItem(Screen.HOME, 'home', 'Início')}
                {renderNavItem(Screen.INFO_SERVICES, 'grid_view', 'Serviços')}
                {renderNavItem(Screen.SERVICES, 'assignment_late', 'Ocorrências')}
                {renderNavItem(Screen.EMERGENCY, 'sos', 'Emergências')}
                {renderNavItem(Screen.PROFILE, 'person', 'Você', true)}
            </div>
        </nav>
    )
}
