
import React, { useState } from 'react';
import AdminOverview from './admin/AdminOverview';
import AdminUsers from './admin/AdminUsers';
import AdminRequests from './admin/AdminRequests';
import AdminSecretariats from './admin/AdminSecretariats';
import AdminServices from './admin/AdminServices';
import AdminSubjects from './admin/AdminSubjects'; // Novo componente
import AdminInfoServices from './admin/AdminInfoServices';
import AdminConfig from './admin/AdminConfig';
import AdminSentiment from './admin/AdminSentiment'; 
import AdminCityGuide from './admin/AdminCityGuide';

interface AdminDashboardProps {
  onLogout: () => void;
}

type AdminView = 'DASHBOARD' | 'USERS' | 'REQ_DASHBOARD' | 'REQ_LIST' | 'REQ_MAP' | 'REQ_KANBAN' | 'SECRETARIATS' | 'SUBJECTS_CONFIG' | 'SERVICES_CONFIG' | 'INFO_SERVICES_CONFIG' | 'NOTIFICATIONS' | 'CONFIG' | 'SENTIMENT' | 'CITY_GUIDE';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState<AdminView>('DASHBOARD');
  const [isOccurrencesExpanded, setIsOccurrencesExpanded] = useState(true);
  const [isTypesExpanded, setIsTypesExpanded] = useState(false); // Novo estado para expandir Tipos

  // --- Sidebar Component ---
  const SidebarLink = ({ icon, label, view, badge, isSub = false }: { icon: string, label: string, view: AdminView, badge?: number, isSub?: boolean }) => (
    <button 
        onClick={() => setCurrentView(view)}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors group ${
            currentView === view 
            ? 'bg-primary/10 text-primary' 
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
        } ${isSub ? 'pl-10 text-sm py-2.5' : ''}`}
    >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: currentView === view ? "'FILL' 1" : "'FILL' 0", fontSize: isSub ? '20px' : '24px' }}>{icon}</span>
        <span className="font-medium text-left">{label}</span>
        {badge ? (
            <span className="ml-auto bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                {badge}
            </span>
        ) : null}
    </button>
  );

  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display overflow-hidden">
      {/* Sidebar */}
      <aside className="flex flex-col w-72 bg-white dark:bg-[#111a22] border-r border-slate-200 dark:border-slate-800 h-full flex-shrink-0 transition-all duration-300">
        <div className="p-6 flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-3xl">account_balance</span>
            </div>
            <div>
                <h1 className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Admin Prefeitura</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Gestão Municipal</p>
            </div>
        </div>

        <nav className="flex-1 px-4 flex flex-col gap-2 overflow-y-auto py-4 custom-scrollbar">
            <SidebarLink icon="dashboard" label="Visão Geral" view="DASHBOARD" />
            <SidebarLink icon="groups" label="Cidadãos" view="USERS" />
            
            {/* Ocorrências Menu */}
            <div>
                <button 
                    onClick={() => setIsOccurrencesExpanded(!isOccurrencesExpanded)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors group text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white justify-between`}
                >
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined">assignment_late</span>
                        <span className="font-medium text-left">Ocorrências</span>
                    </div>
                    <span className={`material-symbols-outlined text-sm transition-transform ${isOccurrencesExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                
                {isOccurrencesExpanded && (
                    <div className="mt-1 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                        <SidebarLink icon="analytics" label="Dashboard" view="REQ_DASHBOARD" isSub />
                        <SidebarLink icon="list" label="Listagem" view="REQ_LIST" isSub />
                        <SidebarLink icon="map" label="Mapa Geral" view="REQ_MAP" isSub />
                        <SidebarLink icon="move_down" label="Tramitação" view="REQ_KANBAN" isSub />
                    </div>
                )}
            </div>

            <div className="my-2 border-t border-slate-100 dark:border-slate-800"></div>
            <p className="px-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Serviços</p>
            <SidebarLink icon="mood" label="Sentimento Popular" view="SENTIMENT" />

            <div className="my-2 border-t border-slate-100 dark:border-slate-800"></div>
            <p className="px-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Cadastros</p>
            <SidebarLink icon="map" label="Guia da Cidade" view="CITY_GUIDE" />
            <SidebarLink icon="corporate_fare" label="Secretarias / Órgãos" view="SECRETARIATS" />
            
            {/* Tipos de Ocorrência Menu Expandable */}
            <div>
                <button 
                    onClick={() => setIsTypesExpanded(!isTypesExpanded)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors group text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white justify-between`}
                >
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined">category</span>
                        <span className="font-medium text-left">Tipos de Ocorrência</span>
                    </div>
                    <span className={`material-symbols-outlined text-sm transition-transform ${isTypesExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                
                {isTypesExpanded && (
                    <div className="mt-1 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                        <SidebarLink icon="view_quilt" label="Assuntos (Ícones)" view="SUBJECTS_CONFIG" isSub />
                        <SidebarLink icon="list_alt" label="Tipos Específicos" view="SERVICES_CONFIG" isSub />
                    </div>
                )}
            </div>

            <SidebarLink icon="design_services" label="Portal de Serviços" view="INFO_SERVICES_CONFIG" />
            
            <div className="my-2 border-t border-slate-100 dark:border-slate-800"></div>
            <SidebarLink icon="campaign" label="Comunicação" view="NOTIFICATIONS" />
            <SidebarLink icon="settings" label="Configurações" view="CONFIG" />
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <div onClick={onLogout} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors group">
                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="material-symbols-outlined text-gray-500">person</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">Admin</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Sair do sistema</p>
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:text-red-500 transition-colors">logout</span>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-background-light dark:bg-background-dark">
        {/* Header */}
        <header className="flex items-center justify-between h-16 px-8 bg-white dark:bg-[#111a22] border-b border-slate-200 dark:border-slate-800 z-10 shrink-0">
            <div className="flex items-center flex-1 max-w-lg">
                <div className="relative w-full">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg py-2 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-slate-900 transition-all outline-none" placeholder="Buscar..." type="text" />
                </div>
            </div>
            <div className="flex items-center gap-4 ml-6">
                <button className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                    <span className="material-symbols-outlined">notifications</span>
                </button>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth relative custom-scrollbar">
            
            {/* Conditional Rendering of Modules */}
            {currentView === 'DASHBOARD' && <AdminOverview />}
            
            {currentView === 'USERS' && <AdminUsers />}
            
            {(currentView === 'REQ_DASHBOARD' || currentView === 'REQ_LIST' || currentView === 'REQ_MAP' || currentView === 'REQ_KANBAN') && (
                <AdminRequests initialView={currentView} />
            )}
            
            {currentView === 'SECRETARIATS' && <AdminSecretariats />}
            
            {currentView === 'SUBJECTS_CONFIG' && <AdminSubjects />}
            
            {currentView === 'SERVICES_CONFIG' && <AdminServices />}
            
            {currentView === 'INFO_SERVICES_CONFIG' && <AdminInfoServices />}
            
            {currentView === 'CONFIG' && <AdminConfig />}
            
            {currentView === 'SENTIMENT' && <AdminSentiment />}
            
            {currentView === 'CITY_GUIDE' && <AdminCityGuide />}

            {currentView === 'NOTIFICATIONS' && (
                <div className="flex items-center justify-center h-64 text-slate-500">Funcionalidade em desenvolvimento.</div>
            )}

        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
