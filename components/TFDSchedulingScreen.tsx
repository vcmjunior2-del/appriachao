
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { TFDAppointment } from '../types';

interface TFDSchedulingScreenProps {
  onBack: () => void;
}

const TFDSchedulingScreen: React.FC<TFDSchedulingScreenProps> = ({ onBack }) => {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState<TFDAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    patientName: '',
    patientCpf: '',
    appointmentDate: '',
    transportDate: '',
    destinationCity: '',
    destinationHospital: '',
    medicalSpecialty: '',
    hasAccompanyingPerson: false,
    accompanyingPersonName: '',
    contactPhone: '',
    notes: ''
  });

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "tfd_appointments"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TFDAppointment));
      setAppointments(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching TFD appointments:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "tfd_appointments"), {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Cidadão',
        patientName: formData.patientName,
        patientCpf: formData.patientCpf,
        appointmentDate: new Date(formData.appointmentDate),
        transportDate: new Date(formData.transportDate),
        destinationCity: formData.destinationCity,
        destinationHospital: formData.destinationHospital,
        medicalSpecialty: formData.medicalSpecialty,
        hasAccompanyingPerson: formData.hasAccompanyingPerson,
        accompanyingPersonName: formData.hasAccompanyingPerson ? formData.accompanyingPersonName : '',
        contactPhone: formData.contactPhone,
        status: 'Pendente',
        createdAt: serverTimestamp(),
        notes: formData.notes
      });

      setSuccessMessage(true);
      setShowForm(false);
      setFormData({
        patientName: '',
        patientCpf: '',
        appointmentDate: '',
        transportDate: '',
        destinationCity: '',
        destinationHospital: '',
        medicalSpecialty: '',
        hasAccompanyingPerson: false,
        accompanyingPersonName: '',
        contactPhone: '',
        notes: ''
      });
      setTimeout(() => setSuccessMessage(false), 5000);
    } catch (error) {
      console.error("Error scheduling TFD:", error);
      alert("Erro ao realizar agendamento. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pendente': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Confirmado': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'Cancelado': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'Realizado': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark">
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-4">
        <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <span className="material-symbols-outlined text-gray-700 dark:text-gray-200">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Agendamento TFD</h1>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl flex items-center gap-3 text-green-700 dark:text-green-400 animate-in fade-in slide-in-from-top-2">
            <span className="material-symbols-outlined">check_circle</span>
            <p className="text-sm font-medium">Solicitação de agendamento enviada com sucesso! Aguarde a confirmação.</p>
          </div>
        )}

        {!showForm ? (
          <div className="space-y-6">
            <div className="bg-primary/10 dark:bg-primary/20 p-6 rounded-3xl border border-primary/20 dark:border-primary/30">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
                  <span className="material-symbols-outlined text-3xl">directions_bus</span>
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">Transporte TFD</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tratamento Fora de Domicílio</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Solicite o transporte para consultas, exames ou procedimentos médicos em outras cidades.
              </p>
              <button 
                onClick={() => setShowForm(true)}
                className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">add_circle</span>
                Novo Agendamento
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span>
                Meus Agendamentos
              </h3>

              {loading ? (
                <div className="flex justify-center py-10">
                  <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
                </div>
              ) : appointments.length === 0 ? (
                <div className="bg-white dark:bg-card-dark rounded-3xl p-8 text-center border border-gray-100 dark:border-gray-800">
                  <span className="material-symbols-outlined text-gray-300 dark:text-gray-700 text-5xl mb-3">event_busy</span>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">Você ainda não possui agendamentos.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((app) => (
                    <div key={app.id} className="bg-white dark:bg-card-dark rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white">{app.destinationCity}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{app.destinationHospital}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(app.status)}`}>
                          {app.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-gray-400 text-sm">calendar_month</span>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">Viagem</span>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{formatDate(app.transportDate)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-gray-400 text-sm">medical_services</span>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">Especialidade</span>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{app.medicalSpecialty}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-gray-400 text-sm">person</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">{app.patientName}</span>
                        </div>
                        {app.hasAccompanyingPerson && (
                          <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400">
                            <span className="material-symbols-outlined text-[12px]">group</span>
                            <span className="text-[10px] font-bold">+1</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Solicitar Transporte</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 pb-10">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Nome do Paciente</label>
                <input 
                  required
                  type="text"
                  value={formData.patientName}
                  onChange={e => setFormData({...formData, patientName: e.target.value})}
                  placeholder="Nome completo"
                  className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">CPF</label>
                  <input 
                    required
                    type="text"
                    value={formData.patientCpf}
                    onChange={e => setFormData({...formData, patientCpf: e.target.value})}
                    placeholder="000.000.000-00"
                    className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Telefone</label>
                  <input 
                    required
                    type="tel"
                    value={formData.contactPhone}
                    onChange={e => setFormData({...formData, contactPhone: e.target.value})}
                    placeholder="(75) 99999-9999"
                    className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Data da Consulta</label>
                  <input 
                    required
                    type="date"
                    value={formData.appointmentDate}
                    onChange={e => setFormData({...formData, appointmentDate: e.target.value})}
                    className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Data da Viagem</label>
                  <input 
                    required
                    type="date"
                    value={formData.transportDate}
                    onChange={e => setFormData({...formData, transportDate: e.target.value})}
                    className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Cidade de Destino</label>
                <input 
                  required
                  type="text"
                  value={formData.destinationCity}
                  onChange={e => setFormData({...formData, destinationCity: e.target.value})}
                  placeholder="Ex: Salvador, Feira de Santana"
                  className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Hospital / Clínica</label>
                <input 
                  required
                  type="text"
                  value={formData.destinationHospital}
                  onChange={e => setFormData({...formData, destinationHospital: e.target.value})}
                  placeholder="Nome da instituição"
                  className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Especialidade Médica</label>
                <input 
                  required
                  type="text"
                  value={formData.medicalSpecialty}
                  onChange={e => setFormData({...formData, medicalSpecialty: e.target.value})}
                  placeholder="Ex: Cardiologia, Oncologia"
                  className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">Possui Acompanhante?</span>
                    <span className="text-[10px] text-gray-500">Obrigatório para menores ou idosos</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, hasAccompanyingPerson: !formData.hasAccompanyingPerson})}
                    className={`h-6 w-11 rounded-full relative transition-colors duration-300 ${formData.hasAccompanyingPerson ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${formData.hasAccompanyingPerson ? 'left-6' : 'left-1'}`}></div>
                  </button>
                </div>

                {formData.hasAccompanyingPerson && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Nome do Acompanhante</label>
                    <input 
                      required
                      type="text"
                      value={formData.accompanyingPersonName}
                      onChange={e => setFormData({...formData, accompanyingPersonName: e.target.value})}
                      placeholder="Nome completo"
                      className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all mt-1"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Observações (Opcional)</label>
                <textarea 
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="Informações adicionais relevantes..."
                  className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all h-24 resize-none"
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    Processando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">send</span>
                    Confirmar Solicitação
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export default TFDSchedulingScreen;
