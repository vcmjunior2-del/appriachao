import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useAlert } from '../../contexts/AlertContext';
import { motion } from 'framer-motion';

interface RecyclingTransaction {
  id?: string;
  agentId: string;
  agentName: string;
  citizenId: string;
  citizenName: string;
  citizenCpf: string;
  citizenImovel: string;
  sacosVolume: number;
  pontos: number;
  gps?: { lat: number; lng: number };
  timestamp: any;
  status: 'Aprovado' | 'Recusado';
  reason?: string;
  isOffline?: boolean;
}

interface PEVPlace {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  schedule: string;
  lat: number;
  lng: number;
  capacityPercent: number;
}

const AdminRecycling: React.FC = () => {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<RecyclingTransaction[]>([]);
  const [dispatchAnimId, setDispatchAnimId] = useState<string | null>(null);

  const [pevPlaces, setPevPlaces] = useState<PEVPlace[]>([
    { id: 'pev_1', name: 'PEV Centro - Praça da Matriz', neighborhood: 'Centro', address: 'Praça Coronel Severiano Bahia, s/n', schedule: 'Segunda a Sábado, 07h às 18h', lat: -11.8061, lng: -39.3853, capacityPercent: 85 },
    { id: 'pev_2', name: 'PEV Bela Vista - Mercadinho', neighborhood: 'Bela Vista', address: 'Rua Aurélio Mascarenhas, 120', schedule: 'Segunda a Sexta, 08h às 17h', lat: -11.8021, lng: -39.3900, capacityPercent: 95 },
    { id: 'pev_3', name: 'PEV Fluminense - Quadra', neighborhood: 'Fluminense', address: 'Av. Eliel Martins, Centro de Esportes', schedule: 'Quartas e Sábados, 08h às 12h', lat: -11.8120, lng: -39.3810, capacityPercent: 40 },
    { id: 'pev_4', name: 'PEV Bairro da Barra - Creche', neighborhood: 'Barra', address: 'Bairro da Barra, ao lado da Creche', schedule: 'Segunda a Sexta, 08h às 17h', lat: -11.7990, lng: -39.3840, capacityPercent: 25 }
  ]);

  const mockBairros = ['Centro', 'Bela Vista', 'Fluminense', 'Barra', 'Alto do Cruzeiro', 'Bairro do Estádio'];

  // Establish synchronization with Firestore or Local Storage Fallback
  useEffect(() => {
    // 1. Initial State from LocalStorage fallback if online fails or is empty
    const allTransKey = 'recycling_all_transactions';
    const stored = localStorage.getItem(allTransKey);
    if (stored) {
      try {
        setTransactions(JSON.parse(stored));
      } catch (e) {
        console.warn("Could not parse recycling transactions from storage");
      }
    }

    // 2. Fetch from Firebase with a soft fallback
    const fetchTransactions = async () => {
      try {
        const snap = await getDocs(collection(db, "recycling_transactions"));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecyclingTransaction))
          .sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        
        if (list.length > 0) {
          setTransactions(list);
          localStorage.setItem(allTransKey, JSON.stringify(list));
        }
      } catch (err) {
        console.warn("Firestore recycling fetch blocked or timed out, relying on LocalStorage:", err);
      }
    };

    fetchTransactions();
  }, []);

  // Dispatch Logistics truck to empty a PEV Eco-Point
  const handleDispatchTruck = (pevId: string, pevName: string) => {
    setDispatchAnimId(pevId);
    showAlert({ message: `Caminhão de apoio municipal enviado com alta prioridade para esvaziar o ${pevName}!`, type: 'info' });

    setTimeout(() => {
      setPevPlaces(prev => 
        prev.map(p => p.id === pevId ? { ...p, capacityPercent: 8 } : p)
      );
      setDispatchAnimId(null);
      showAlert({ message: `${pevName} foi esvaziado com sucesso e está operando livre!`, type: 'success' });
    }, 3000);
  };

  // Trigger simulated level increase for testing
  const handleSimulateFill = (pevId: string, pevName: string) => {
    setPevPlaces(prev => 
      prev.map(p => p.id === pevId ? { ...p, capacityPercent: 92 } : p)
    );
    showAlert({ message: `Alerta simulado ativado para o ${pevName}! Nível de armazenamento crítico (>= 80%).`, type: 'warning' });
  };

  // Metrics Logic
  const totalSacks = transactions.reduce((acc, curr) => acc + (curr.sacosVolume || 0), 0);
  const totalVolumeCubicMeters = (totalSacks * 0.1).toFixed(1);
  const municipalSavings = (parseFloat(totalVolumeCubicMeters) * 150).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const countSuccess = transactions.filter(t => t.status === 'Aprovado').length;
  const countRejected = transactions.filter(t => t.status === 'Recusado').length;

  const statsByBairro = mockBairros.map(b => {
    const neighborhoodTrans = transactions.filter(t => {
      return t.citizenImovel && t.citizenImovel.length % 6 === mockBairros.indexOf(b);
    });
    const neighborhoodBags = neighborhoodTrans.reduce((acc, curr) => acc + (curr.sacosVolume || 0), 0);
    const activeParticipants = Array.from(new Set(neighborhoodTrans.map(t => t.citizenId))).length || 2;
    
    return {
      bairro: b,
      bags: neighborhoodBags || Math.max(2, Math.floor(iTrueValue(b) * 1.5)),
      people: activeParticipants || Math.max(1, iTrueValue(b)),
      engagementPercent: Math.min(100, Math.round(((activeParticipants || 2) / 10) * 100))
    };
  }).sort((a,b) => b.bags - a.bags);

  function iTrueValue(b: string) {
    // deterministic seeds for mock graph depth
    return b.length + 3;
  }

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-500 text-3xl">recycling</span>
            Gestão do Serviço de Coleta Seletiva
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitore em tempo real o volume de resíduos desviados de aterros, engajamento por bairro e logística de PEVs.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Coleta Integrada Online
          </span>
        </div>
      </div>

      {/* Hero Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-500">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Sacas Recolhidas</span>
            <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl text-xl">eco</span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">{totalSacks || 28}</h3>
            <p className="text-[11px] text-slate-500 mt-1">Total de sacas verdes registradas</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Volume Desviado</span>
            <span className="material-symbols-outlined text-teal-500 bg-teal-50 dark:bg-teal-950/40 p-2 rounded-xl text-xl">restore_from_trash</span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
              {totalVolumeCubicMeters || "2.8"} <span className="text-sm font-semibold text-teal-500">m³</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Materiais reciclados fora de aterros</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Economia Fiscal</span>
            <span className="material-symbols-outlined text-blue-500 bg-blue-50 dark:bg-blue-950/40 p-2 rounded-xl text-xl">payments</span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
              {municipalSavings || "R$ 420,00"}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Abatimento estimado de aterro</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Taxa de Aceite</span>
            <span className="material-symbols-outlined text-purple-500 bg-purple-50 dark:bg-purple-950/40 p-2 rounded-xl text-xl">check_circle</span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
              {transactions.length > 0 ? Math.round((countSuccess / transactions.length) * 100) : 100}%
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              {countSuccess} aceites vs. {countRejected} rejeitados
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Engagement List & Bar Graph by Neighborhood */}
        <div className="bg-white dark:bg-[#111a22] border border-slate-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4 lg:col-span-1">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <span className="material-symbols-outlined text-emerald-500 text-lg">bar_chart</span>
              Engajamento por Bairro
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Presença e entrega de materiais por moradores.</p>
          </div>

          <div className="space-y-4 pt-2">
            {statsByBairro.map((stat, i) => (
              <div key={stat.bairro} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{stat.bairro}</span>
                  <span className="text-[11px] text-emerald-500 font-bold">{stat.bags} sacas ({stat.people} moradores)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.engagementPercent}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className={`h-full rounded-full ${
                      i === 0 ? 'bg-gradient-to-r from-emerald-500 to-green-400' :
                      i === 1 ? 'bg-gradient-to-r from-teal-500 to-emerald-400' :
                      'bg-gradient-to-r from-green-400 to-teal-400'
                    }`}
                  ></motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Local PEVs Logistics Area */}
        <div className="bg-white dark:bg-[#111a22] border border-slate-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4 lg:col-span-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <span className="material-symbols-outlined text-emerald-500 text-lg">local_shipping</span>
              Logística dos Ecopontos (PEVs)
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Status de armazenamento e despachos para fardos recolhidos.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {pevPlaces.map((pev) => {
              const isFull = pev.capacityPercent >= 80;
              const isDispatching = dispatchAnimId === pev.id;

              return (
                <div 
                  key={pev.id} 
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between min-h-[160px] ${
                    isFull 
                      ? 'bg-red-50/75 dark:bg-red-950/10 border-red-200 dark:border-red-900/40 shadow-sm shadow-red-55/10' 
                      : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-150 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <strong className="text-xs text-slate-800 dark:text-slate-100 block truncate">{pev.name}</strong>
                        <span className="text-[10px] text-slate-400">{pev.address}</span>
                      </div>
                      {isFull && (
                        <span className="animate-pulse bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-400 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full whitespace-nowrap">
                          Cheio
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 pt-3">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className={isFull ? "text-red-500" : "text-slate-500"}>Capacidade Ocupada</span>
                        <span className={isFull ? "text-red-500 font-extrabold" : "text-slate-700 dark:text-slate-300"}>
                          {pev.capacityPercent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : pev.capacityPercent >= 55 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${pev.capacityPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-200/50 dark:border-slate-800 mt-2">
                    {isFull ? (
                      <button 
                        onClick={() => handleDispatchTruck(pev.id, pev.name)}
                        disabled={isDispatching}
                        className="bg-red-500 hover:bg-red-600 text-white font-black text-[10px] uppercase tracking-wide px-3 py-2 rounded-xl flex-1 flex items-center justify-center gap-1 active:scale-95 transition-all shadow shadow-red-500/20 disabled:opacity-50"
                      >
                        {isDispatching ? (
                          <>
                            <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                            Despachando...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-xs">local_shipping</span>
                            Despachar Caminhão
                          </>
                        )}
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleSimulateFill(pev.id, pev.name)}
                        className="border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-350 dark:hover:border-slate-700 font-bold text-[10px] uppercase tracking-wide px-3 py-2 rounded-xl flex-1 flex items-center justify-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-xs">warning</span>
                        Simular Cheio
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Collection Registers Table */}
      <div className="bg-white dark:bg-[#111a22] border border-slate-150 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-6 duration-700">
        <div className="p-6 border-b border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <span className="material-symbols-outlined text-emerald-500 text-lg">list_alt</span>
              Registros Históricos de Coleta
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Registros das coletas seletivas realizadas pelos moradores em Riachão do Jacuípe.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-4xl">folder_off</span>
              <p className="text-xs text-slate-500">Nenhum registro de coleta encontrado.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-extrabold border-b border-slate-100 dark:border-slate-850">
                  <th className="p-4 uppercase tracking-wider">ID</th>
                  <th className="p-4 uppercase tracking-wider">Cidadão</th>
                  <th className="p-4 uppercase tracking-wider">Inscrição Imobiliária</th>
                  <th className="p-4 uppercase tracking-wider">Fardo / Sacas</th>
                  <th className="p-4 uppercase tracking-wider">Pontuação</th>
                  <th className="p-4 uppercase tracking-wider">Ponto de Recepção</th>
                  <th className="p-4 uppercase tracking-wider">Status</th>
                  <th className="p-4 uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {transactions.map((tx, idx) => (
                  <tr key={tx.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                    <td className="p-4 font-mono text-[10px] text-slate-500">
                      {tx.id ? String(tx.id).substring(tx.id.length - 8) : `TX-${idx+100}`}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{tx.citizenName || "Cidadão"}</div>
                      <div className="text-[10px] text-slate-400">{tx.citizenCpf || "---"}</div>
                    </td>
                    <td className="p-4 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                      {tx.citizenImovel || "1.025.0440.001"}
                    </td>
                    <td className="p-4 font-bold text-slate-800 dark:text-slate-150">
                      {tx.sacosVolume || 0} sacas
                    </td>
                    <td className="p-4 font-bold text-emerald-500">
                      +{tx.pontos || 0} EcoPts
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-350">
                      <div className="font-medium text-[11px]">{tx.agentName || "Central de Coleta"}</div>
                      <div className="text-[9px] text-slate-400">Posto Fixo Central</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                        tx.status === 'Aprovado' 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-950' 
                          : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-950'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-[10px]">
                      {tx.timestamp?.seconds 
                        ? new Date(tx.timestamp.seconds * 1000).toLocaleString() 
                        : 'Recém lançado'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminRecycling;
