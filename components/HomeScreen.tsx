
import React, { useRef, useEffect, useState } from 'react';
import { Screen, ImprovementArea, NewsItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext'; // Import ConfigContext
import { collection, query, where, onSnapshot, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import NewsModal from './NewsModal';

interface HomeScreenProps {
  onNavigate: (screen: Screen, params?: any) => void;
  registerBackHandler?: (handler: (() => boolean) | null) => void;
}

// --- Global Cache for Home ---
let cachedNews: NewsItem[] | null = null;
let cachedWeather: { temp: number; code: number; isDay: number } | null = null;
let cachedImprovementAreas: ImprovementArea[] | null = null;

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, registerBackHandler }) => {
  const { currentUser } = useAuth(); 
  const { config } = useConfig(); 
  const newsScrollRef = useRef<HTMLDivElement>(null);
  const [activeNewsIndex, setActiveNewsIndex] = useState(0);
  const [activeRequestsCount, setActiveRequestsCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // --- Widget States (Init with Cache) ---
  const [weather, setWeather] = useState<{ temp: number; code: number; isDay: number } | null>(cachedWeather);
  const [population] = useState("33.4k"); 

  // --- Sentiment Tracker States (Init with Cache) ---
  const [sentimentAreas, setSentimentAreas] = useState<ImprovementArea[]>(cachedImprovementAreas || []);
  const [sentimentValue, setSentimentValue] = useState<number>(50); 
  const [selectedImprovementAreas, setSelectedImprovementAreas] = useState<string[]>([]);
  const [sentimentComment, setSentimentComment] = useState('');
  const [isSubmittingSentiment, setIsSubmittingSentiment] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const userInteractedRef = useRef(false);
  
  // --- News State (Init with Cache) ---
  const [newsItems, setNewsItems] = useState<NewsItem[]>(cachedNews || []);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  // Sync back handler with news modal
  useEffect(() => {
    if (registerBackHandler) {
      if (selectedNews) {
        registerBackHandler(() => {
          setSelectedNews(null);
          return true;
        });
      } else {
        registerBackHandler(null);
      }
    }
  }, [selectedNews, registerBackHandler]);

  useEffect(() => {
    return () => {
      registerBackHandler?.(null);
    };
  }, [registerBackHandler]);

  const logoUrl = config?.logoUrl || "";

  const formatTimeAgo = (timestamp: any) => {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      if (diffInHours < 1) return "Agora";
      if (diffInHours < 24) return `Há ${diffInHours} horas`;
      const day = date.getDate();
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${day} ${months[date.getMonth()]}`;
  };

  const getTagColorClass = (theme: string) => {
      switch(theme) {
          case 'blue': return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
          case 'green': return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
          case 'red': return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
          case 'yellow': return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
          case 'purple': return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
          default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
      }
  };

  // --- Real-time Data ---
  useEffect(() => {
    // 1. Fetch Weather with Robust Error Handling
    const fetchWeather = async (retryCount = 0) => {
        if (!navigator.onLine && retryCount === 0) {
            console.warn("Weather fetch skipped: Browser is offline.");
            return;
        }
        
        try {
            const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-11.8069&longitude=-39.3856&current_weather=true&timezone=America%2FBahia');
            if (!res.ok) throw new Error('Weather API Error: ' + res.status);
            const data = await res.json();
            if (data && data.current_weather) {
                const wData = {
                    temp: Math.round(data.current_weather.temperature),
                    code: data.current_weather.weathercode,
                    isDay: data.current_weather.is_day
                };
                setWeather(wData);
                cachedWeather = wData;
            }
        } catch (e) {
            console.warn(`Weather fetch attempt ${retryCount + 1} failed:`, e);
            // Automatic retry up to 3 times with backoff
            if (retryCount < 2) {
                setTimeout(() => fetchWeather(retryCount + 1), 3000 * (retryCount + 1));
            }
        }
    };
    
    // Fetch if not already cached or if cached is old (simulated)
    fetchWeather();

    // 2. Fetch Improvement Areas
    const unsubAreas = onSnapshot(query(collection(db, "improvement_areas"), where("active", "==", true)), 
        (snap) => {
            const areas = snap.docs.map(d => ({ id: d.id, ...d.data() } as ImprovementArea));
            setSentimentAreas(areas);
            cachedImprovementAreas = areas;
        },
        (error) => console.warn("Sentiment Areas Restricted")
    );

    // 3. Fetch News
    const unsubNews = onSnapshot(collection(db, "news"),
        (snap) => {
            const news = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as NewsItem))
                .filter(n => n.active === true) 
                .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
            setNewsItems(news);
            cachedNews = news;
        },
        (error) => console.warn("News Error")
    );

    if (!currentUser) return () => { unsubAreas(); unsubNews(); };

    // 4. Load User Sentiment
    const fetchUserSentiment = async () => {
        try {
            const docRef = doc(db, "sentiment_logs", currentUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.sentimentValue !== undefined) setSentimentValue(data.sentimentValue);
                if (data.selectedAreas) setSelectedImprovementAreas(data.selectedAreas);
                if (data.comment) setSentimentComment(data.comment);
            }
        } catch (e) {}
        setDataLoaded(true);
    };
    fetchUserSentiment();

    // 5. Query Active Requests
    const unsubRequests = onSnapshot(query(collection(db, "requests"), where("userId", "==", currentUser.uid)), 
        (snapshot) => {
            const activeCount = snapshot.docs.filter(doc => !['Concluído', 'Rejeitado'].includes(doc.data().status)).length;
            setActiveRequestsCount(activeCount);
        }, 
        (error) => console.warn("Requests Listener Error")
    );

    // 6. Query Unread Notifications
    let unread1 = 0;
    let unread2 = 0;
    const updateUnread = () => setUnreadNotifications(unread1 + unread2);

    const unsubNotifs1 = onSnapshot(query(collection(db, "notifications"), where("userId", "==", currentUser.uid)), 
        (snapshot) => {
            unread1 = snapshot.docs.filter(doc => !doc.data().read).length;
            updateUnread();
        },
        (error) => console.warn("Notifications Listener Error")
    );
    const unsubNotifs2 = onSnapshot(query(collection(db, "notifications"), where("userId", "==", "all")), 
        (snapshot) => {
            unread2 = snapshot.docs.filter(doc => {
                const data = doc.data();
                return !(data.readBy?.includes(currentUser.uid));
            }).length;
            updateUnread();
        },
        (error) => console.warn("Notifications Listener Error")
    );

    return () => {
        unsubRequests();
        unsubNotifs1();
        unsubNotifs2();
        unsubAreas();
        unsubNews();
    };
  }, [currentUser]);

  useEffect(() => {
    if (newsItems.length <= 1) return;
    const timer = setTimeout(() => {
      if (newsScrollRef.current) {
        const nextIndex = (activeNewsIndex + 1) % newsItems.length;
        const container = newsScrollRef.current;
        container.scrollTo({ left: container.offsetWidth * nextIndex, behavior: 'smooth' });
        setActiveNewsIndex(nextIndex);
      }
    }, 4000); 
    return () => clearTimeout(timer);
  }, [activeNewsIndex, newsItems.length]);

  const handleScroll = () => {
    if (newsScrollRef.current) {
      const container = newsScrollRef.current;
      const index = Math.round(container.scrollLeft / container.offsetWidth);
      if (index !== activeNewsIndex) setActiveNewsIndex(index);
    }
  };

  const getWeatherInfo = (code: number, isDay: number) => {
      if (code === 0) return { label: 'Ensolarado', icon: isDay ? 'sunny' : 'clear_night' };
      if (code >= 1 && code <= 3) return { label: 'Parcialmente Nublado', icon: isDay ? 'partly_cloudy_day' : 'partly_cloudy_night' };
      if (code >= 45 && code <= 48) return { label: 'Nevoeiro', icon: 'foggy' };
      if (code >= 51 && code <= 67) return { label: 'Chuva Fraca', icon: 'rainy' };
      if (code >= 80 && code <= 99) return { label: 'Chuva Forte', icon: 'thunderstorm' };
      return { label: 'Disponível', icon: 'device_thermostat' };
  };

  const weatherInfo = weather ? getWeatherInfo(weather.code, weather.isDay) : { label: 'Carregando...', icon: 'device_thermostat' };

  const getSentimentStatus = (val: number) => {
      if (val <= 20) return { label: 'Péssimo', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', scaleVal: 1 };
      if (val <= 40) return { label: 'Ruim', color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', scaleVal: 2 };
      if (val <= 60) return { label: 'Regular', color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', scaleVal: 3 };
      if (val <= 80) return { label: 'Bom', color: 'text-lime-500', bg: 'bg-lime-100 dark:bg-lime-900/30', scaleVal: 4 };
      return { label: 'Muito Bom', color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', scaleVal: 5 };
  };

  const toggleArea = (label: string) => {
      userInteractedRef.current = true;
      setSelectedImprovementAreas(prev => prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]);
  };

  const handleSubmitSentiment = async () => {
      if (!currentUser) return;
      setIsSubmittingSentiment(true);
      try {
          const scaleStatus = getSentimentStatus(sentimentValue);
          await setDoc(doc(db, "sentiment_logs", currentUser.uid), {
              userId: currentUser.uid,
              sentiment: scaleStatus.scaleVal,
              sentimentValue: sentimentValue, 
              selectedAreas: selectedImprovementAreas,
              comment: sentimentComment,
              date: serverTimestamp() 
          });
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 3000);
      } catch (e) {
          console.error("Error submitting sentiment", e);
      } finally {
          setIsSubmittingSentiment(false);
      }
  };

  const currentStatus = getSentimentStatus(sentimentValue);

  // Auto-save effect removed
  // useEffect(() => {
  //     if (!dataLoaded || !currentUser || !userInteractedRef.current) return;
  //     const timer = setTimeout(() => {
  //         handleSubmitSentiment();
  //     }, 1000);
  //     return () => clearTimeout(timer);
  // }, [sentimentValue, selectedImprovementAreas, sentimentComment, dataLoaded]);

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pb-16 max-w-md mx-auto bg-background-light dark:bg-background-dark">
      <header className="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl h-10 w-10 flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden relative">
                {logoUrl ? (
                    <>
                        <img 
                            src={logoUrl} 
                            alt="Logo" 
                            className="w-full h-full object-contain scale-110" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'block';
                            }}
                        />
                        <span className="material-symbols-outlined text-primary hidden" style={{ display: 'none' }}>account_balance</span>
                    </>
                ) : (
                    <span className="material-symbols-outlined text-primary">account_balance</span>
                )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Olá,</span>
              <h2 className="text-lg font-bold leading-tight tracking-tight text-[#111318] dark:text-white truncate max-w-[180px]">{currentUser?.displayName || "Cidadão"}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate(Screen.REQUESTS)} className="relative flex items-center justify-center h-10 w-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><span className="material-symbols-outlined text-gray-700 dark:text-gray-200" style={{ fontSize: '24px' }}>assignment</span></button>
            <button onClick={() => onNavigate(Screen.ALERTS)} className="relative flex items-center justify-center h-10 w-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><span className="material-symbols-outlined text-gray-700 dark:text-gray-200" style={{ fontSize: '24px' }}>notifications</span>{unreadNotifications > 0 && <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-background-dark animate-pulse"></span>}</button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-6 pt-4">
        <div className="grid grid-cols-2 gap-3 px-4 animate-in slide-in-from-bottom-2 duration-500">
            <div onClick={() => onNavigate(Screen.WEATHER)} className="bg-white dark:bg-card-dark p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-28 cursor-pointer hover:border-orange-200 dark:hover:border-orange-900/50 transition-colors active:scale-[0.98]">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-orange-500 text-[18px] animate-spin-slow" style={{ animationDuration: '10s' }}>{weatherInfo.icon}</span>
                    <span className="text-orange-500 font-bold text-[10px] uppercase tracking-wider">CLIMA</span>
                </div>
                <div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white leading-none mb-1">{weather ? `${weather.temp}°C` : '--'}</div>
                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">{weatherInfo.label} em<br/>Riachão do Jacuípe - BA</div>
                </div>
            </div>
            <div onClick={() => onNavigate(Screen.DEMOGRAPHICS)} className="bg-white dark:bg-card-dark p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-28 cursor-pointer hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors active:scale-[0.98]">
                <div className="flex items-center gap-2 mb-1"><span className="material-symbols-outlined text-blue-600 text-[18px]">groups</span><span className="text-blue-600 font-bold text-[10px] uppercase tracking-wider">POPULAÇÃO</span></div>
                <div><div className="text-3xl font-black text-slate-900 dark:text-white leading-none mb-1">{population}</div><div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">Habitantes estimados</div></div>
            </div>
        </div>

        {activeRequestsCount > 0 && (
            <div className="px-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-blue-500 p-5 shadow-lg text-white cursor-pointer active:scale-98 transition-transform" onClick={() => onNavigate(Screen.REQUESTS)}>
                    <div className="relative z-10 flex justify-between items-center">
                        <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-blue-100">Minhas Solicitações</span>
                            <div className="flex items-baseline gap-2"><span className="text-3xl font-bold">{activeRequestsCount}</span><span className="text-base font-medium text-blue-100">em andamento</span></div>
                            <p className="text-xs text-blue-200 mt-1">Toque para ver detalhes</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors"><span className="material-symbols-outlined">chevron_right</span></div>
                    </div>
                    <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                </div>
            </div>
        )}

        {newsItems.length > 0 && (
            <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Destaques</h3>
                <div className="flex gap-1.5">{newsItems.map((_, index) => <div key={index} className={`h-1.5 rounded-full transition-all duration-300 ${index === activeNewsIndex ? 'w-4 bg-primary' : 'w-1.5 bg-gray-300 dark:bg-gray-700'}`}></div>)}</div>
            </div>
            <div ref={newsScrollRef} onScroll={handleScroll} className="flex w-full overflow-x-auto snap-x snap-mandatory no-scrollbar">{newsItems.map((news) => (
                <div key={news.id} className="snap-center shrink-0 w-full px-4" onClick={() => setSelectedNews(news)}>
                    <div className="relative w-full h-48 rounded-2xl bg-white dark:bg-card-dark shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden group cursor-pointer">
                        <div className="absolute top-3 left-3 z-10"><span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-sm ${getTagColorClass(news.colorTheme)}`}>{news.tag}</span></div>
                        <div className="h-full w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url("${news.imageUrl}")` }}>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                            {news.videoUrl && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white/80 text-6xl">play_circle</span>
                                </div>
                            )}
                        </div>
                        <div className="absolute bottom-0 left-0 w-full p-4"><h4 className="font-bold text-white text-xl leading-tight mb-1 drop-shadow-md line-clamp-2">{news.title}</h4><p className="text-gray-200 text-sm line-clamp-1 mb-2 opacity-90">{news.description}</p><div className="flex items-center gap-2 text-gray-300 text-xs font-medium"><span className="material-symbols-outlined text-[14px]">schedule</span><span>{formatTimeAgo(news.date)}</span></div></div>
                    </div>
                </div>))}
            </div>
            </section>
        )}

        <NewsModal news={selectedNews} onClose={() => setSelectedNews(null)} />

        <section className="px-4 grid grid-cols-2 gap-3 animate-in slide-in-from-bottom-4 duration-500">
            <div onClick={() => onNavigate(Screen.INFO_SERVICES)} className="relative overflow-hidden rounded-3xl bg-[#135bec] dark:bg-[#1e40af] p-4 text-white shadow-lg shadow-blue-500/20 cursor-pointer active:scale-95 transition-transform group min-h-[112px] flex flex-col justify-between">
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                        <div className="flex items-center gap-1.5 mb-2 opacity-90"><span className="material-symbols-outlined text-[18px]">grid_view</span><span className="text-[9px] font-bold uppercase tracking-widest">SERVIÇOS</span></div>
                        <h3 className="text-lg font-bold leading-tight mb-1">Portal do<br/>Cidadão</h3>
                        <p className="text-[10px] text-blue-100 leading-snug opacity-90">IPTU, Alvarás e consultas.</p>
                    </div>
                    <div className="absolute bottom-3 right-3"><div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors"><span className="material-symbols-outlined text-[18px]">arrow_outward</span></div></div>
                </div>
            </div>
            <div onClick={() => onNavigate(Screen.SERVICES)} className="relative overflow-hidden rounded-3xl bg-indigo-500 dark:bg-indigo-700 p-4 text-white shadow-lg shadow-indigo-500/20 cursor-pointer active:scale-95 transition-transform group min-h-[112px] flex flex-col justify-between">
                <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                        <div className="flex items-center gap-1.5 mb-2 opacity-90"><span className="material-symbols-outlined text-[18px]">assignment_late</span><span className="text-[9px] font-bold uppercase tracking-widest">OCORRÊNCIAS</span></div>
                        <h3 className="text-lg font-bold leading-tight mb-1">Reportar<br/>Problema</h3>
                        <p className="text-[10px] text-indigo-100 leading-snug opacity-90">Iluminação, buracos e obras.</p>
                    </div>
                    <div className="absolute bottom-3 right-3"><div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors"><span className="material-symbols-outlined text-[18px]">add</span></div></div>
                </div>
            </div>
        </section>

        <section className="flex flex-col gap-3 px-4 animate-in slide-in-from-bottom-5 duration-700">
          <div className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[20px]">location_city</span><h3 className="text-lg font-bold text-gray-900 dark:text-white">Guia da Cidade</h3></div>
          <div className="grid grid-cols-3 gap-3">{[
              { label: 'Úteis', category: 'Úteis', icon: 'contact_phone', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: 'Saúde', category: 'Saúde', icon: 'local_hospital', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
              { label: 'Educação', category: 'Educação', icon: 'school', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
              { label: 'Hotéis', category: 'Hospedagem', icon: 'hotel', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
              { label: 'Mercados', category: 'Comércio', icon: 'storefront', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
              { label: 'Lazer', category: 'Lazer', icon: 'attractions', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/20' },
            ].map((cat) => (
              <button key={cat.label} onClick={() => onNavigate(Screen.CITY_GUIDE, cat.category)} className="flex flex-col items-center justify-center p-3 gap-2 bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 hover:border-primary/50 hover:shadow-md transition-all active:scale-95 h-24"><div className={`h-9 w-9 rounded-full flex items-center justify-center ${cat.bg} ${cat.color}`}><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{cat.icon}</span></div><span className="font-semibold text-xs text-center text-gray-800 dark:text-gray-200 leading-tight">{cat.label}</span></button>
            ))}</div>
        </section>

        <section className="px-4 animate-in slide-in-from-bottom-6 duration-700 pb-8">
            <div className="bg-white dark:bg-card-dark rounded-3xl p-5 shadow-md border border-slate-100 dark:border-slate-800 relative overflow-hidden transition-all duration-300">
                {/* Toast Notification - Localized */}
                <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${showSuccessMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                    <div className="bg-slate-900/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-slate-900 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-green-400 dark:text-green-600 text-sm">check_circle</span>
                        <span className="text-[10px] font-bold pr-1">Sentimento atualizado!</span>
                    </div>
                </div>
                <div className="flex justify-between items-start mb-6 relative z-10"><div><h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">Análise da População</h3><p className="text-xs text-slate-500 dark:text-gray-400">Sentimento geral hoje</p></div><div className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 ${currentStatus.bg} ${currentStatus.color}`}>{currentStatus.label}</div></div>
                <div className="relative z-10 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 relative h-12 flex items-center">
                            <input type="range" min="0" max="100" value={sentimentValue} onChange={(e) => {
                                userInteractedRef.current = true;
                                setSentimentValue(Number(e.target.value));
                            }} className="w-full h-full appearance-none cursor-pointer absolute inset-0 z-20 opacity-0 touch-pan-y" />
                            <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden z-0"></div>
                            <div className="absolute top-1/2 -translate-y-1/2 left-0 h-4 rounded-full transition-all duration-100 z-10 bg-gradient-to-r from-green-400 to-green-600" style={{ width: `${sentimentValue}%` }}></div>
                            <div className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-white border-[3px] border-green-500 rounded-full shadow-lg z-10 pointer-events-none transition-all duration-100 flex items-center justify-center" style={{ left: `calc(${sentimentValue}% - 16px)` }}>
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            </div>
                        </div>
                        <span className={`text-2xl font-black transition-colors duration-300 w-16 text-right ${currentStatus.color}`}>{sentimentValue}%</span>
                    </div>
                    <div className="flex justify-between px-2 mt-2 relative">{[10, 30, 50, 70, 90].map((val, idx) => {
                            const isActive = Math.ceil(sentimentValue / 20) === (idx + 1) || (sentimentValue === 0 && idx === 0);
                            const emojis = ['sentiment_very_dissatisfied', 'sentiment_dissatisfied', 'sentiment_neutral', 'sentiment_satisfied', 'sentiment_very_satisfied'];
                            const colors = ['text-red-300', 'text-orange-300', 'text-yellow-300', 'text-lime-300', 'text-green-300'];
                            const activeColors = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-lime-500', 'text-green-500'];
                            return (
                                <button 
                                    key={idx} 
                                    onClick={() => {
                                        userInteractedRef.current = true;
                                        setSentimentValue(val);
                                    }}
                                    className={`material-symbols-outlined transition-all duration-300 text-3xl p-2 -m-2 rounded-full active:scale-95 ${isActive ? `${activeColors[idx]} scale-125` : `${colors[idx]} opacity-40 scale-90 hover:opacity-70`}`} 
                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                    {emojis[idx]}
                                </button>
                            );
                        })}</div>
                </div>
                <div className="h-px bg-slate-100 dark:bg-slate-800 mb-4"></div>
                <div className="relative z-10">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">O que podemos melhorar?</p>
                    <div className="flex flex-wrap gap-2 mb-5">{sentimentAreas.map((area) => (
                            <button key={area.id} onClick={() => toggleArea(area.label)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${selectedImprovementAreas.includes(area.label) ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-primary/30'}`}>{selectedImprovementAreas.includes(area.label) && <span className="material-symbols-outlined text-[10px]">check</span>}{area.label}</button>
                        ))}</div>
                    
                    <div className="mb-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                            Tem algo mais a dizer? Escreva abaixo suas sugestões, elogios ou críticas detalhadas para ajudar a gestão municipal.
                        </p>
                        <textarea
                            value={sentimentComment}
                            onChange={(e) => {
                                userInteractedRef.current = true;
                                setSentimentComment(e.target.value);
                            }}
                            placeholder="Descreva aqui sua sugestão ou reclamação..."
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none resize-none h-24"
                        />
                    </div>

                    <div className="flex items-center justify-end">
                        <button 
                            onClick={handleSubmitSentiment}
                            disabled={isSubmittingSentiment}
                            className="bg-primary text-white font-bold py-2 px-6 rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmittingSentiment ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <span>Enviar Avaliação</span>
                                    <span className="material-symbols-outlined text-sm">send</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </section>

      </main>
    </div>
  );
};

export default HomeScreen;
