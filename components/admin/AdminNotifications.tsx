import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { GlobalNotification } from '../../types';
import { useAlert } from '../../contexts/AlertContext';

const AdminNotifications: React.FC = () => {
    const [notifications, setNotifications] = useState<GlobalNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showAlert } = useAlert();

    // Form State
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'info' | 'alert' | 'event'>('info');
    const [targetAudience, setTargetAudience] = useState<'all' | 'verified'>('all');

    useEffect(() => {
        const q = query(collection(db, 'notifications'), where('userId', '==', 'all'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalNotification));
            // Sort client-side to avoid composite index requirement
            data.sort((a, b) => {
                const getTime = (dateObj: any) => {
                    if (!dateObj) return 0;
                    if (dateObj.toDate) return dateObj.toDate().getTime();
                    if (dateObj.seconds) return dateObj.seconds * 1000;
                    if (dateObj instanceof Date) return dateObj.getTime();
                    return 0;
                };
                return getTime(b.date) - getTime(a.date);
            });
            setNotifications(data);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar notificações:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            showAlert({ message: 'Preencha todos os campos obrigatórios.', type: 'error' });
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'notifications'), {
                userId: 'all',
                title: title.trim(),
                message: message.trim(),
                type,
                targetAudience,
                date: serverTimestamp(),
                read: false, // For legacy compatibility, but readBy is what matters
                readBy: [],
                active: true
            });
            showAlert({ message: 'Notificação enviada com sucesso!', type: 'success' });
            setTitle('');
            setMessage('');
            setType('info');
            setTargetAudience('all');
        } catch (error) {
            console.error("Erro ao enviar notificação:", error);
            showAlert({ message: 'Erro ao enviar notificação.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir esta notificação?')) {
            try {
                await deleteDoc(doc(db, 'notifications', id));
                showAlert({ message: 'Notificação excluída.', type: 'success' });
            } catch (error) {
                console.error("Erro ao excluir:", error);
                showAlert({ message: 'Erro ao excluir notificação.', type: 'error' });
            }
        }
    };

    const getTypeColor = (t: string) => {
        switch (t) {
            case 'alert': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
            case 'event': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
            default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
        }
    };

    const getTypeIcon = (t: string) => {
        switch (t) {
            case 'alert': return 'warning';
            case 'event': return 'event';
            default: return 'info';
        }
    };

    const getTypeName = (t: string) => {
        switch (t) {
            case 'alert': return 'Alerta';
            case 'event': return 'Evento';
            default: return 'Informação';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Comunicação e Avisos</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Envie notificações push e avisos para os cidadãos.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Column */}
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">send</span>
                            Nova Notificação
                        </h3>
                        <form onSubmit={handleSendNotification} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Título do Aviso *</label>
                                <input 
                                    type="text" 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Ex: Campanha de Vacinação"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mensagem *</label>
                                <textarea 
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none min-h-[100px] resize-none"
                                    placeholder="Detalhes do aviso..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
                                    <select 
                                        value={type}
                                        onChange={(e) => setType(e.target.value as any)}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="info">Informação</option>
                                        <option value="alert">Alerta Urgente</option>
                                        <option value="event">Evento</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Público</label>
                                    <select 
                                        value={targetAudience}
                                        onChange={(e) => setTargetAudience(e.target.value as any)}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="all">Todos</option>
                                        <option value="verified">Apenas Verificados</option>
                                    </select>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-70"
                            >
                                {isSubmitting ? (
                                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                ) : (
                                    <span className="material-symbols-outlined">campaign</span>
                                )}
                                {isSubmitting ? 'Enviando...' : 'Enviar Notificação'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* List Column */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm h-full">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">history</span>
                            Histórico de Envios
                        </h3>
                        
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">notifications_off</span>
                                <p>Nenhuma notificação enviada ainda.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 overflow-y-auto max-h-[600px] custom-scrollbar pr-2">
                                {notifications.map(notif => (
                                    <div key={notif.id} className="flex gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-200 dark:hover:border-slate-700 transition-colors group">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${getTypeColor(notif.type)}`}>
                                            <span className="material-symbols-outlined">{getTypeIcon(notif.type)}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <h4 className="font-bold text-slate-900 dark:text-white truncate">{notif.title}</h4>
                                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                                    {notif.date ? new Date(notif.date.toDate()).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Agora'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{notif.message}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getTypeColor(notif.type)}`}>
                                                    {getTypeName(notif.type)}
                                                </span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                    {notif.targetAudience === 'all' ? 'Todos' : 'Verificados'}
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDelete(notif.id!)}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all shrink-0 self-start"
                                            title="Excluir"
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminNotifications;
