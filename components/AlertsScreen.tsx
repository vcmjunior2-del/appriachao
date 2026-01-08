
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { NotificationItem } from '../types';

interface AlertsScreenProps {
  onBack: () => void;
}

const AlertsScreen: React.FC<AlertsScreenProps> = ({ onBack }) => {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('Todas');
    const filters = ['Todas', 'Não Lidas', 'Atualizações', 'Alertas'];

    useEffect(() => {
        if (!currentUser) return;

        // Query simples sem orderBy para evitar erro de índice composto no Firestore
        const q = query(
            collection(db, "notifications"),
            where("userId", "in", [currentUser.uid, "all"])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationItem));
            
            // Ordenação feita no cliente (descendente por data)
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
            console.error("Error fetching notifications:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleMarkAllRead = async () => {
        // Optimistic UI Update
        setNotifications(prev => prev.map(n => ({...n, read: true})));

        const batch = writeBatch(db);
        const unread = notifications.filter(n => !n.read);
        if (unread.length === 0) return;

        unread.forEach(n => {
            const ref = doc(db, "notifications", n.id);
            batch.update(ref, { read: true });
        });

        try {
            await batch.commit();
        } catch (e) {
            console.error("Error batch update:", e);
        }
    };

    const handleMarkAsRead = async (id: string) => {
        // Optimistic UI Update: Mark as read locally immediately
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

        try {
            const batch = writeBatch(db);
            const ref = doc(db, "notifications", id);
            batch.update(ref, { read: true });
            await batch.commit();
        } catch (e) { console.error(e); }
    };

    // Filter Logic
    const filteredNotifications = notifications.filter(n => {
        if (activeFilter === 'Não Lidas') return !n.read;
        if (activeFilter === 'Atualizações') return n.type === 'update' || n.type === 'success';
        if (activeFilter === 'Alertas') return n.type === 'alert' || n.type === 'warning';
        return true;
    });

    // Grouping Logic
    const groupedNotifications = filteredNotifications.reduce((acc, note) => {
        let dateLabel = "Anteriormente";
        if (note.date) {
            const date = note.date.toDate ? note.date.toDate() : new Date(note.date.seconds * 1000);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (date.toDateString() === today.toDateString()) dateLabel = "Hoje";
            else if (date.toDateString() === yesterday.toDateString()) dateLabel = "Ontem";
            else dateLabel = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
        }
        
        if (!acc[dateLabel]) acc[dateLabel] = [];
        acc[dateLabel].push(note);
        return acc;
    }, {} as Record<string, NotificationItem[]>);

    const formatTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const getIconStyle = (type: string) => {
        switch (type) {
            case 'success': return { icon: 'check_circle', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' };
            case 'alert': return { icon: 'warning', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' };
            case 'info': return { icon: 'info', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' };
            case 'update': return { icon: 'update', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' };
            default: return { icon: 'notifications', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500' };
        }
    };

    // Helper to separate the status update line from the custom message
    const parseMessage = (msg: string) => {
        const prefix = "Status atualizado para:";
        if (msg.startsWith(prefix)) {
            const firstDotIndex = msg.indexOf('.');
            if (firstDotIndex !== -1) {
                return {
                    statusLine: msg.substring(0, firstDotIndex + 1), // "Status atualizado para: X."
                    content: msg.substring(firstDotIndex + 1).trim() // The rest of the message
                };
            }
        }
        return { statusLine: null, content: msg };
    };

    return (
        <div className="relative flex h-full min-h-screen w-full flex-col bg-white dark:bg-slate-900 overflow-hidden font-display">
            {/* Top App Bar */}
            <div className="sticky top-0 z-10 flex items-center bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4 pb-3 justify-between">
                <button 
                    onClick={onBack}
                    className="text-slate-900 dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                </button>
                <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">Notificações</h2>
                <div className="flex items-center justify-end absolute right-4">
                    <button 
                        onClick={handleMarkAllRead}
                        className="text-primary hover:text-blue-600 text-xs font-bold leading-normal tracking-[0.015em] shrink-0 transition-colors uppercase"
                    >
                        Ler tudo
                    </button>
                </div>
            </div>

            {/* Filter Chips */}
            <div className="flex gap-3 px-4 py-4 overflow-x-auto no-scrollbar bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-800/50">
                {filters.map((filter) => (
                     <button 
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full px-5 transition-transform active:scale-95 ${
                            activeFilter === filter 
                            ? 'bg-primary shadow-md shadow-primary/20' 
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        <p className={`text-sm font-medium leading-normal ${
                            activeFilter === filter 
                            ? 'text-white' 
                            : 'text-slate-900 dark:text-slate-200'
                        }`}>
                            {filter}
                        </p>
                    </button>
                ))}
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 pb-20">
                {loading ? (
                    <div className="flex justify-center pt-20">
                        <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
                    </div>
                ) : Object.keys(groupedNotifications).length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-20 text-center px-6">
                        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-4xl text-slate-300">notifications_off</span>
                        </div>
                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">Sem novas notificações</h3>
                        <p className="text-slate-500 text-sm mt-2">Você está em dia com todas as atualizações.</p>
                    </div>
                ) : (
                    Object.entries(groupedNotifications).map(([date, items]: [string, NotificationItem[]]) => (
                        <div key={date}>
                            <h3 className="text-slate-900 dark:text-white text-sm font-bold leading-tight tracking-[-0.015em] px-4 pt-6 pb-2 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10">{date}</h3>
                            {items.map((note) => {
                                const style = getIconStyle(note.type);
                                const { statusLine, content } = parseMessage(note.message);

                                return (
                                    <div 
                                        key={note.id} 
                                        onClick={() => handleMarkAsRead(note.id)}
                                        className={`relative group cursor-pointer transition-all duration-300 ${note.read ? 'opacity-70 bg-transparent' : 'bg-blue-50/40 dark:bg-blue-900/10'}`}
                                    >
                                        {!note.read && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                                        )}
                                        <div className="flex gap-4 px-4 py-4 justify-between items-start hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-slate-800/50">
                                            <div className="flex items-start gap-3 flex-1">
                                                <div className={`flex items-center justify-center rounded-xl shrink-0 size-10 ${style.bg} ${style.text}`}>
                                                    <span className="material-symbols-outlined text-[24px]">{style.icon}</span>
                                                </div>
                                                <div className="flex flex-col gap-1.5 w-full min-w-0">
                                                    {/* Header Line: ID & Time */}
                                                    <div className="flex items-center justify-between">
                                                        {note.relatedRequestId && (
                                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Protocolo #{note.relatedRequestId.slice(0,4).toUpperCase()}</span>
                                                        )}
                                                        <p className="text-slate-400 dark:text-slate-500 text-[10px] font-medium">{formatTime(note.date)}</p>
                                                    </div>
                                                    
                                                    {/* Title */}
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-base font-bold leading-tight ${note.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                                                            {note.title}
                                                        </p>
                                                        {!note.read && <span className="size-2 rounded-full bg-primary shrink-0 animate-pulse"></span>}
                                                    </div>

                                                    {/* Status Line (Separate) */}
                                                    {statusLine && (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-0.5">
                                                            {statusLine}
                                                        </p>
                                                    )}

                                                    {/* Message Body - Highlighted Box */}
                                                    {content && (
                                                        <div className={`p-2.5 rounded-lg border text-sm leading-snug font-bold transition-colors ${
                                                            note.read 
                                                            ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-700/50' 
                                                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-blue-100 dark:border-blue-900/30 shadow-sm'
                                                        }`}>
                                                            {content}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AlertsScreen;
