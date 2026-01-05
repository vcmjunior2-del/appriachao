
import React from 'react';

interface DemographicsScreenProps {
  onBack: () => void;
}

const DemographicsScreen: React.FC<DemographicsScreenProps> = ({ onBack }) => {
  
  // Static Data based on IBGE 2022 / Estimates for Riachão do Jacuípe - BA
  const stats = {
      population: "33.398",
      density: "28,3 hab/km²",
      area: "1.190 km²",
      idh: "0,603",
      rankingIDH: "Médio",
      gentilico: "Jacuipense",
      prefeito: "Carlos Matos",
      pibPerCapita: "R$ 12.450,00"
  };

  const ageData = [
      { label: '0-14 anos', value: 22, color: 'bg-blue-400' },
      { label: '15-64 anos', value: 65, color: 'bg-primary' },
      { label: '65+ anos', value: 13, color: 'bg-indigo-500' },
  ];

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display overflow-y-auto no-scrollbar">
      
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-card-dark/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
        <button onClick={onBack} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Demografia</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 p-4 pb-10 space-y-6">
        
        {/* Main Population Card */}
        <div className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div className="relative z-10 text-center">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">População Total</p>
                <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-1">{stats.population}</h2>
                <span className="inline-block bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold">
                    Censo IBGE 2022
                </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase font-bold">Densidade</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{stats.density}</p>
                </div>
                <div className="text-center border-l border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-400 uppercase font-bold">Área Territorial</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{stats.area}</p>
                </div>
            </div>
        </div>

        {/* Age Distribution Chart */}
        <div className="bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">pie_chart</span>
                Faixa Etária Estimada
            </h3>
            
            <div className="flex h-4 w-full rounded-full overflow-hidden mb-4">
                {ageData.map((item, i) => (
                    <div key={i} className={`h-full ${item.color}`} style={{ width: `${item.value}%` }}></div>
                ))}
            </div>

            <div className="space-y-3">
                {ageData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                            <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">{item.label}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{item.value}%</span>
                    </div>
                ))}
            </div>
        </div>

        {/* Economic Indicators */}
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined">trending_up</span>
                </div>
                <p className="text-xs text-slate-400 font-bold uppercase">IDH (2010)</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.idh}</p>
                <p className="text-xs text-orange-600 dark:text-orange-400 font-bold mt-1">{stats.rankingIDH}</p>
            </div>
            
            <div className="bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined">attach_money</span>
                </div>
                <p className="text-xs text-slate-400 font-bold uppercase">PIB per Capita</p>
                <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">{stats.pibPerCapita}</p>
            </div>
        </div>

        {/* Additional Info List */}
        <div className="bg-white dark:bg-card-dark rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                    <span className="material-symbols-outlined text-slate-500">info</span>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Dados Gerais</h3>
                    <p className="text-xs text-slate-500">Informações administrativas</p>
                </div>
            </div>
            <div className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Gentílico</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{stats.gentilico}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Prefeito (Gestão Atual)</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{stats.prefeito}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Aniversário da Cidade</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">14 de Agosto</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Bioma</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Caatinga</span>
                </div>
            </div>
        </div>

        <p className="text-center text-[10px] text-gray-400 pt-4">
            Fontes: IBGE, Atlas Brasil e Prefeitura Municipal.
        </p>

      </main>
    </div>
  );
};

export default DemographicsScreen;
