
import React, { useState, useEffect, useRef } from 'react';
import { Screen, ServiceTypeDefinition, Secretariat } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { AlertProvider, useAlert } from './contexts/AlertContext';
import { auth, db, isAdminUser } from './firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore'; 
import { registerPush, showForegroundNotification } from './pushNotifications';
import { AnimatePresence, motion } from 'framer-motion';
import WelcomeScreen from './components/WelcomeScreen';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import HomeScreen from './components/HomeScreen';
import RequestsScreen from './components/RequestsScreen';
import ProfileScreen from './components/ProfileScreen';
import ServiceDetailsScreen from './components/ServiceDetailsScreen';
import ServicesScreen from './components/ServicesScreen'; 
import InfoServicesScreen from './components/InfoServicesScreen'; 
import AlertsScreen from './components/AlertsScreen';
import EmergencyScreen from './components/EmergencyScreen';
import AdminDashboard from './components/AdminDashboard';
import AdminLoginScreen from './components/AdminLoginScreen';
import RequestTrackingScreen from './components/RequestTrackingScreen'; 
import SplashScreen from './components/SplashScreen';
import WeatherScreen from './components/WeatherScreen';
import DemographicsScreen from './components/DemographicsScreen';
import CityGuideScreen from './components/CityGuideScreen';
import GarbageTrackerScreen from './components/GarbageTrackerScreen'; // Import Tracker
import TFDSchedulingScreen from './components/TFDSchedulingScreen'; // Import TFD
import RecyclingScreen from './components/RecyclingScreen'; // Import Recycling
import { DashboardBottomNav } from './components/BottomNav';

const AppContent: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const { showAlert } = useAlert();
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.WELCOME);
  const [selectedService, setSelectedService] = useState<ServiceTypeDefinition | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [activeSecretariat, setActiveSecretariat] = useState<Secretariat | null>(null);
  const [cityGuideCategory, setCityGuideCategory] = useState<string | undefined>(undefined);
  
  // State for dynamic back navigation (User Profile vs Home)
  const [returnScreen, setReturnScreen] = useState<Screen>(Screen.HOME);

  // State for the Splash Screen
  const [showSplash, setShowSplash] = useState(true);
  const isFirstLoad1 = useRef(true);
  const isFirstLoad2 = useRef(true);

  // Scroll direction state for dynamic collapsible BottomNav
  // 'down' = compact/retracted, 'up' = expanded/full
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('up');
  const scrollStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollPosMapRef = useRef<WeakMap<HTMLElement, number>>(new WeakMap());

  // Screen Navigation History Stack for back navigation & gestures
  const screenHistoryRef = useRef<Screen[]>([]);
  const activeBackHandlerRef = useRef<(() => boolean) | null>(null);

  // App container ref, active screen scroll container ref & Edge swipe tracking state
  const appContainerRef = useRef<HTMLDivElement>(null);
  const screenContainerRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const touchStartTimeRef = useRef<number>(0);
  const isEdgeSwipeActiveRef = useRef<boolean>(false);
  const [swipeIndicator, setSwipeIndicator] = useState<{ active: boolean; x: number }>({ active: false, x: 0 });

  // Função universal que garante que toda página/aba abra sempre no topo
  const resetAllScrollToTop = () => {
    const performReset = () => {
      if (screenContainerRef.current) {
        screenContainerRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        screenContainerRef.current.scrollTop = 0;
      }
      if (appContainerRef.current) {
        appContainerRef.current.scrollTop = 0;
        const scrollableNodes = appContainerRef.current.querySelectorAll('main, section, div');
        scrollableNodes.forEach((node) => {
          const el = node as HTMLElement;
          if (el.scrollTop > 0 && !el.classList.contains('no-scrollbar')) {
            el.scrollTop = 0;
          }
        });
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    performReset();
    requestAnimationFrame(performReset);
    setTimeout(performReset, 60);
    setTimeout(performReset, 220);
  };

  // Scroll detection hook (with capture: true to intercept all nested container scrolling)
  // Regras estritas:
  // - Rolando para baixo -> retrai (down / isCompact)
  // - Rolando para cima -> retrai (down / isCompact)
  // - Deixou parado -> expande (up / !isCompact) após debounce
  // - Elementos como caixas de texto, inputs, carrosséis horizontais não afetam o menu
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target || typeof target.scrollTop !== 'number') return;

      // 1. Guarda estrita: Ignora inputs de formulário, textareas, elementos editáveis
      const tagName = target.tagName;
      if (tagName === 'TEXTAREA' || tagName === 'INPUT' || tagName === 'SELECT' || target.isContentEditable) {
        return;
      }
      // Ignora sliders/carrosséis puramente horizontais como o de notícias
      if (target.classList && target.classList.contains('no-scrollbar')) {
        return;
      }

      // 2. Ignora containers que não têm rolagem vertical substancial
      if (target.scrollHeight - target.clientHeight < 30) {
        return;
      }

      const currentScroll = target.scrollTop;
      const prevScroll = lastScrollPosMapRef.current.get(target) ?? currentScroll;
      const diff = currentScroll - prevScroll;

      // Armazena a posição do scroll exclusivamente para este elemento (evita interferência entre elementos)
      lastScrollPosMapRef.current.set(target, currentScroll);

      // Ignora micro-oscilações (< 3px)
      if (Math.abs(diff) < 3) return;

      // 3. Se estiver no topo da tela (ou voltou ao topo), expande imediatamente
      if (currentScroll <= 20) {
        if (scrollStopTimerRef.current) {
          clearTimeout(scrollStopTimerRef.current);
          scrollStopTimerRef.current = null;
        }
        setScrollDirection('up');
        return;
      }

      // 4. Regra: Qualquer movimento de rolagem (cima ou baixo) retrai a barra
      setScrollDirection('down');

      // 5. Regra: Deixou a tela parada -> expande
      if (scrollStopTimerRef.current) {
        clearTimeout(scrollStopTimerRef.current);
      }
      scrollStopTimerRef.current = setTimeout(() => {
        setScrollDirection('up');
      }, 650);
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      if (scrollStopTimerRef.current) {
        clearTimeout(scrollStopTimerRef.current);
      }
    };
  }, []);

  // Reset scroll state and scroll position on every screen or sub-view change
  useEffect(() => {
    if (scrollStopTimerRef.current) {
      clearTimeout(scrollStopTimerRef.current);
      scrollStopTimerRef.current = null;
    }
    setScrollDirection('up');
    resetAllScrollToTop();
  }, [currentScreen, activeSecretariat, selectedService, selectedRequestId]);

  // --- Initial Load Effect ---
  useEffect(() => {
    if (!loading) {
      // Logic to decide initial screen
      let targetScreen = Screen.WELCOME;
      if (currentUser) {
          if (currentScreen === Screen.WELCOME || currentScreen === Screen.LOGIN || currentScreen === Screen.REGISTER || currentScreen === Screen.ADMIN_LOGIN) {
              targetScreen = Screen.HOME;
          } else {
              targetScreen = currentScreen;
          }
      } else {
         const allowedScreens = [Screen.WELCOME, Screen.LOGIN, Screen.REGISTER, Screen.ADMIN_LOGIN, Screen.ADMIN_DASHBOARD];
         // Keep on Admin Dashboard if refreshing page while logged in as admin (simple check)
         if (currentScreen === Screen.ADMIN_DASHBOARD && isAdminUser(currentUser)) targetScreen = Screen.ADMIN_DASHBOARD;
         else if (!allowedScreens.includes(currentScreen)) targetScreen = Screen.WELCOME;
         else targetScreen = currentScreen;
      }

      // Set the screen, but keep splash visible for a moment for effect
      setCurrentScreen(targetScreen);
      
      const timer = setTimeout(() => {
          setShowSplash(false);
      }, 2500); // 2.5s total splash time on initial load

      return () => clearTimeout(timer);
    }
  }, [loading]);

  // --- NOTIFICATIONS (PUSH + AVISO COM O APP ABERTO) ---
  useEffect(() => {
      if (!currentUser) return;

      // 1. Registra o aparelho para push (navegador ou app nativo)
      registerPush(currentUser.uid, true).catch((err) => console.warn('Push não registrado:', err));

      const q1 = query(collection(db, "notifications"), where("userId", "==", currentUser.uid));
      const q2 = query(collection(db, "notifications"), where("userId", "==", "all"));

      const handleSnapshot = (snapshot: any, isFirstRef: React.MutableRefObject<boolean>) => {
          if (isFirstRef.current) {
              isFirstRef.current = false;
              return;
          }

          snapshot.docChanges().forEach((change: any) => {
              if (change.type === "added") {
                  const notifData = change.doc.data();
                  const title = notifData.title || "Nova Atualização";
                  const body = notifData.message || "Você tem uma nova notificação da prefeitura.";
                  // Navegador com permissão: notificação do sistema. App nativo ou sem permissão: aviso dentro do app.
                  showForegroundNotification(title, body).then((shown) => {
                      if (!shown) showAlert({ title, message: body, type: 'info' });
                  });
              }
          });
      };

      const unsub1 = onSnapshot(q1, (snap) => handleSnapshot(snap, isFirstLoad1), (error) => console.warn("Notifications error:", error));
      const unsub2 = onSnapshot(q2, (snap) => handleSnapshot(snap, isFirstLoad2), (error) => console.warn("Notifications error:", error));

      return () => {
          unsub1();
          unsub2();
      };
  }, [currentUser]);

  // --- Helper: Login Transition Animation ---
  const handleLoginTransition = () => {
      setShowSplash(true);
      setTimeout(() => {
          setCurrentScreen(Screen.HOME);
          setTimeout(() => setShowSplash(false), 500); 
      }, 2000);
  };

  const handleGuestLogin = async () => {
    try {
        await auth.signInAnonymously();
    } catch (error: any) {
        console.error("Guest login failed", error);
        if (error.code === 'auth/operation-not-allowed') {
            showAlert({ message: "Login anônimo não habilitado no Firebase Console.", type: 'error' });
        } else {
            showAlert({ message: "Erro ao entrar como convidado. Tente novamente.", type: 'error' });
        }
    }
  };

  const handleAdminLoginClick = () => {
      handleNavigate(Screen.ADMIN_LOGIN);
  };

  const handleAdminLoginSuccess = () => {
      handleNavigate(Screen.ADMIN_DASHBOARD);
  };

  const handleSelectService = (service: ServiceTypeDefinition) => {
      setSelectedService(service);
      handleNavigate(Screen.SERVICE_DETAILS);
  };

  const handleSelectRequest = (requestId: string) => {
      setSelectedRequestId(requestId);
      handleNavigate(Screen.REQUEST_TRACKING);
  };

  // Check if back navigation is logically available
  const canGoBack = Boolean(
      activeBackHandlerRef.current !== null ||
      (currentScreen === Screen.SERVICES && activeSecretariat !== null) ||
      screenHistoryRef.current.length > 0 ||
      (currentScreen !== Screen.HOME && currentScreen !== Screen.WELCOME && currentScreen !== Screen.ADMIN_DASHBOARD)
  );

  // Centralized Back Navigation Handler (supports sub-views, gestures, and history)
  const handleGoBack = () => {
      // 1. Se há um tratador ativo registrado na tela atual (ex: fechar modal, sair de pasta, fechar ocorrência)
      if (activeBackHandlerRef.current) {
          const handled = activeBackHandlerRef.current();
          if (handled) {
              resetAllScrollToTop();
              return;
          }
      }

      // 2. Caso especial da tela de Ocorrências: se uma secretaria específica estiver selecionada, voltar para a lista
      if (currentScreen === Screen.SERVICES && activeSecretariat !== null) {
          setActiveSecretariat(null);
          resetAllScrollToTop();
          return;
      }

      // 3. Regra solicitada: Botões e gestos de voltar em Serviços, Ocorrências e Emergências sempre voltam para Início
      if (
          currentScreen === Screen.SERVICES ||
          currentScreen === Screen.INFO_SERVICES ||
          currentScreen === Screen.EMERGENCY
      ) {
          // Limpa histórico residual para manter coerência
          screenHistoryRef.current = [];
          setCurrentScreen(Screen.HOME);
          resetAllScrollToTop();
          return;
      }

      // 4. Se houver histórico na pilha de navegação, voltar para a tela anterior
      if (screenHistoryRef.current.length > 0) {
          const prevScreen = screenHistoryRef.current.pop();
          if (prevScreen && prevScreen !== currentScreen) {
              setCurrentScreen(prevScreen);
              return;
          }
      }

      // 5. Mapeamento hierárquico padrão caso o histórico esteja vazio
      switch (currentScreen) {
          case Screen.SERVICE_DETAILS:
              setCurrentScreen(Screen.SERVICES);
              break;
          case Screen.REQUEST_TRACKING:
              setCurrentScreen(Screen.REQUESTS);
              break;
          case Screen.GARBAGE_TRACKER:
          case Screen.COLETA_SELETIVA:
          case Screen.TFD_SCHEDULING:
              setCurrentScreen(Screen.INFO_SERVICES);
              break;
          case Screen.WEATHER:
          case Screen.DEMOGRAPHICS:
          case Screen.CITY_GUIDE:
              setCurrentScreen(Screen.HOME);
              break;
          case Screen.REQUESTS:
          case Screen.ALERTS:
              setCurrentScreen(returnScreen || Screen.HOME);
              break;
          case Screen.SERVICES:
          case Screen.INFO_SERVICES:
          case Screen.EMERGENCY:
          case Screen.PROFILE:
              setCurrentScreen(Screen.HOME);
              break;
          case Screen.LOGIN:
          case Screen.REGISTER:
          case Screen.ADMIN_LOGIN:
              setCurrentScreen(Screen.WELCOME);
              break;
          default:
              break;
      }
  };

  const handleNavigate = (screen: Screen, params?: any) => {
      if (screen === currentScreen) {
          resetAllScrollToTop();
          return;
      }

      // Logic: Determine where to go back to if accessing Requests or Alerts
      if (screen === Screen.REQUESTS || screen === Screen.ALERTS) {
          if (currentScreen === Screen.PROFILE) {
              setReturnScreen(Screen.PROFILE);
          } else {
              setReturnScreen(Screen.HOME);
          }
      }

      if (screen === Screen.CITY_GUIDE && params) {
          setCityGuideCategory(params);
      }

      // Adiciona tela atual ao histórico (limite de 20 para evitar consumo excessivo de memória)
      screenHistoryRef.current = [...screenHistoryRef.current.slice(-19), currentScreen];

      // Sincroniza com histórico do navegador para suportar gestos nativos do Android
      try {
          window.history.pushState({ screen, timestamp: Date.now() }, '');
      } catch (err) {
          // ignora em ambientes restritos
      }

      setCurrentScreen(screen);
  };

  const handleBottomNavNavigate = (screen: Screen) => {
      // Se clicou na aba ativa, volta ao topo e reseta sub-seleção se houver
      if (currentScreen === screen) {
          if (activeBackHandlerRef.current) {
              activeBackHandlerRef.current();
          }
          if (screen === Screen.SERVICES && activeSecretariat !== null) {
              setActiveSecretariat(null);
          }
          resetAllScrollToTop();
      } else {
          handleNavigate(screen);
      }
  };

  // --- Sincronização com o botão Voltar do sistema (Android PopState) ---
  useEffect(() => {
      if (!window.history.state) {
          try {
              window.history.replaceState({ screen: currentScreen }, '');
          } catch (e) {}
      }

      const handlePopState = () => {
          handleGoBack();
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
          window.removeEventListener('popstate', handlePopState);
      };
  }, [currentScreen, activeSecretariat]);

  // --- Detecção do Gesto de Borda no Celular (Swipe da borda esquerda para voltar) ---
  useEffect(() => {
      const handleTouchStart = (e: TouchEvent) => {
          if (e.touches.length !== 1) return;
          const touch = e.touches[0];

          // Calcula posição relativa ao container do app
          const containerRect = appContainerRef.current?.getBoundingClientRect();
          const containerLeft = containerRect ? Math.max(0, containerRect.left) : 0;
          const relativeX = touch.clientX - containerLeft;

          // Inicia gesto apenas se o toque começar na borda esquerda (0 a 45px)
          if (relativeX >= 0 && relativeX <= 45) {
              touchStartXRef.current = touch.clientX;
              touchStartYRef.current = touch.clientY;
              touchStartTimeRef.current = Date.now();
              isEdgeSwipeActiveRef.current = true;
          } else {
              isEdgeSwipeActiveRef.current = false;
          }
      };

      const handleTouchMove = (e: TouchEvent) => {
          if (!isEdgeSwipeActiveRef.current) return;
          const touch = e.touches[0];
          const deltaX = touch.clientX - touchStartXRef.current;
          const deltaY = touch.clientY - touchStartYRef.current;

          // Se o usuário estiver rolando verticalmente logo no início ou puxando para trás, aborta
          if (deltaX < -10 || (Math.abs(deltaY) > deltaX && deltaX < 25)) {
              isEdgeSwipeActiveRef.current = false;
              setSwipeIndicator({ active: false, x: 0 });
              return;
          }

          if (deltaX > 15 && Math.abs(deltaY) < 65) {
              if (canGoBack) {
                  const indicatorX = Math.min(Math.max(deltaX * 0.45, 12), 48);
                  setSwipeIndicator({ active: true, x: indicatorX });
              }
          }
      };

      const handleTouchEnd = (e: TouchEvent) => {
          if (!isEdgeSwipeActiveRef.current) {
              setSwipeIndicator({ active: false, x: 0 });
              return;
          }

          const touch = e.changedTouches[0];
          const deltaX = touch.clientX - touchStartXRef.current;
          const deltaY = touch.clientY - touchStartYRef.current;
          const duration = Date.now() - touchStartTimeRef.current;

          isEdgeSwipeActiveRef.current = false;
          setSwipeIndicator({ active: false, x: 0 });

          // Condição para acionar o voltar:
          // - Arrasto mínimo de 50px
          // - Movimento predominantemente horizontal (deltaX > |deltaY| * 1.1)
          // - Deslocamento vertical restrito (< 75px)
          // - Tempo razoável (< 800ms)
          if (deltaX >= 50 && deltaX > Math.abs(deltaY) * 1.1 && Math.abs(deltaY) < 75 && duration < 800) {
              handleGoBack();
          }
      };

      const handleTouchCancel = () => {
          isEdgeSwipeActiveRef.current = false;
          setSwipeIndicator({ active: false, x: 0 });
      };

      window.addEventListener('touchstart', handleTouchStart, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });
      window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

      return () => {
          window.removeEventListener('touchstart', handleTouchStart);
          window.removeEventListener('touchmove', handleTouchMove);
          window.removeEventListener('touchend', handleTouchEnd);
          window.removeEventListener('touchcancel', handleTouchCancel);
      };
  }, [canGoBack, currentScreen, activeSecretariat]);

  if (loading) {
     return <SplashScreen isVisible={true} />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case Screen.WELCOME:
        return <WelcomeScreen 
                  onLogin={() => handleNavigate(Screen.LOGIN)} 
                  onRegister={() => handleNavigate(Screen.REGISTER)} 
                  onAdminLogin={handleAdminLoginClick}
                  onGuestLogin={handleGuestLogin}
               />;
      case Screen.LOGIN:
        return <LoginScreen 
                  onBack={handleGoBack}
                  onRegister={() => handleNavigate(Screen.REGISTER)}
                  onLoginSuccess={handleLoginTransition} 
               />;
      case Screen.REGISTER:
        return <RegisterScreen 
                  onBack={handleGoBack}
                  onLogin={() => handleNavigate(Screen.LOGIN)}
                  onRegisterSuccess={handleLoginTransition}
               />;
      
      // --- Admin Routes ---
      case Screen.ADMIN_LOGIN:
        return <AdminLoginScreen 
                  onBack={handleGoBack}
                  onLoginSuccess={handleAdminLoginSuccess}
               />;
      case Screen.ADMIN_DASHBOARD:
        if (!isAdminUser(currentUser)) {
          return <AdminLoginScreen 
                    onBack={handleGoBack}
                    onLoginSuccess={handleAdminLoginSuccess}
                 />;
        }
        return <AdminDashboard onLogout={() => setCurrentScreen(Screen.WELCOME)} />;

      // --- Main Screens & Tabs (with full unmount/mount transitions) ---
      case Screen.HOME:
        return <HomeScreen 
                  onNavigate={handleNavigate} 
                  registerBackHandler={(handler) => { activeBackHandlerRef.current = handler; }}
               />;
      case Screen.INFO_SERVICES:
        return <InfoServicesScreen 
                  onBack={handleGoBack} 
                  onNavigateToTracker={() => handleNavigate(Screen.GARBAGE_TRACKER)}
                  onNavigateToTFD={() => handleNavigate(Screen.TFD_SCHEDULING)}
                  onNavigateToRecycling={() => handleNavigate(Screen.COLETA_SELETIVA)}
                  registerBackHandler={(handler) => { activeBackHandlerRef.current = handler; }}
               />;
      case Screen.SERVICES:
        return <ServicesScreen 
                  onBack={handleGoBack} 
                  onSelectService={handleSelectService}
                  activeSecretariat={activeSecretariat}
                  onSelectSecretariat={setActiveSecretariat}
                  registerBackHandler={(handler) => { activeBackHandlerRef.current = handler; }}
               />;
      case Screen.REQUESTS:
        return <RequestsScreen 
                  onBack={handleGoBack} 
                  onSelectRequest={handleSelectRequest} 
               />;
      case Screen.ALERTS:
        return <AlertsScreen onBack={handleGoBack} />;
      case Screen.EMERGENCY:
        return <EmergencyScreen 
                  onBack={handleGoBack} 
                  isActive={currentScreen === Screen.EMERGENCY}
               />;
      case Screen.PROFILE:
        return <ProfileScreen 
                  onLogout={() => setCurrentScreen(Screen.WELCOME)} 
                  onNavigate={handleNavigate} 
               />;

      // --- Feature & Detail Screens ---
      case Screen.REQUEST_TRACKING:
        if (!selectedRequestId) return <RequestsScreen onBack={handleGoBack} onSelectRequest={handleSelectRequest} />;
        return <RequestTrackingScreen 
                  requestId={selectedRequestId} 
                  onBack={handleGoBack} 
               />;
      case Screen.SERVICE_DETAILS:
        return <ServiceDetailsScreen 
                    onBack={handleGoBack} 
                    service={selectedService}
                    registerBackHandler={(handler) => { activeBackHandlerRef.current = handler; }}
               />;
      case Screen.WEATHER:
        return <WeatherScreen onBack={handleGoBack} />;
      case Screen.DEMOGRAPHICS:
        return <DemographicsScreen onBack={handleGoBack} />;
      case Screen.CITY_GUIDE:
        return <CityGuideScreen onBack={handleGoBack} initialCategory={cityGuideCategory} />;
      case Screen.GARBAGE_TRACKER:
        return <GarbageTrackerScreen onBack={handleGoBack} />;
      case Screen.TFD_SCHEDULING:
        return <TFDSchedulingScreen onBack={handleGoBack} />;
      case Screen.COLETA_SELETIVA:
        return <RecyclingScreen onBack={handleGoBack} />;
        
      default:
        return <WelcomeScreen onLogin={() => handleNavigate(Screen.LOGIN)} onRegister={() => handleNavigate(Screen.REGISTER)} onAdminLogin={handleAdminLoginClick} onGuestLogin={handleGuestLogin} />;
    }
  };

  const isAdminMode = currentScreen === Screen.ADMIN_DASHBOARD || currentScreen === Screen.ADMIN_LOGIN;
  
  const showBottomNav = currentUser && 
                        !isAdminMode &&
                        currentScreen !== Screen.WELCOME && 
                        currentScreen !== Screen.LOGIN && 
                        currentScreen !== Screen.REGISTER && 
                        currentScreen !== Screen.SERVICE_DETAILS &&
                        currentScreen !== Screen.REQUEST_TRACKING &&
                        currentScreen !== Screen.WEATHER &&
                        currentScreen !== Screen.DEMOGRAPHICS &&
                        currentScreen !== Screen.CITY_GUIDE &&
                        currentScreen !== Screen.GARBAGE_TRACKER &&
                        currentScreen !== Screen.TFD_SCHEDULING &&
                        currentScreen !== Screen.COLETA_SELETIVA;

  return (
    <div className="h-[100dvh] bg-gray-100 dark:bg-gray-900 flex justify-center overflow-hidden">
        <AnimatePresence>
            {showSplash && <SplashScreen isVisible={showSplash} />}
        </AnimatePresence>

        {isAdminMode ? (
             <div className="h-full w-full animate-in fade-in duration-500 overflow-y-auto custom-scrollbar bg-[#111a22]">
                {renderScreen()}
            </div>
        ) : (
             <div ref={appContainerRef} className="w-full max-w-md bg-background-light dark:bg-background-dark h-full shadow-2xl overflow-hidden relative flex flex-col">
                {/* Floating Edge-Swipe Back Gesture Indicator */}
                {swipeIndicator.active && canGoBack && (
                    <div 
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none flex items-center pl-1 transition-transform duration-75"
                        style={{ transform: `translate3d(${swipeIndicator.x}px, -50%, 0)` }}
                    >
                        <div className="w-11 h-11 rounded-full bg-white/95 dark:bg-slate-900/95 shadow-[0_8px_30px_rgba(0,0,0,0.3)] border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center text-primary dark:text-blue-400 backdrop-blur-md">
                            <span className="material-symbols-outlined text-[22px] font-bold">arrow_back</span>
                        </div>
                    </div>
                )}

                <div className="flex-1 w-full h-full relative overflow-hidden">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={currentScreen}
                            ref={(el) => {
                                screenContainerRef.current = el;
                                if (el && el.scrollTop !== 0) {
                                    el.scrollTop = 0;
                                }
                            }}
                            initial={{ opacity: 0, y: 14, scale: 0.985 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.985 }}
                            transition={{
                                duration: 0.24,
                                ease: [0.22, 1, 0.36, 1]
                            }}
                            transformTemplate={(_, generated) =>
                                generated === 'none' || generated === 'translateY(0px) scale(1)' ? 'none' : generated
                            }
                            onAnimationStart={() => {
                                if (screenContainerRef.current) {
                                    screenContainerRef.current.scrollTop = 0;
                                }
                            }}
                            className={`absolute inset-0 w-full h-full ${currentScreen === Screen.EMERGENCY ? 'overflow-hidden' : 'overflow-y-auto'} overflow-x-hidden custom-scrollbar pb-20 bg-background-light dark:bg-background-dark screen-stagger-scope`}
                        >
                            {renderScreen()}
                        </motion.div>
                    </AnimatePresence>
                </div>
                {showBottomNav && (
                    <DashboardBottomNav 
                        currentScreen={currentScreen} 
                        onNavigate={handleBottomNavNavigate} 
                        scrollDirection={scrollDirection}
                    />
                )}
            </div>
        )}
    </div>
  );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <ConfigProvider>
                <AlertProvider>
                    <AppContent />
                </AlertProvider>
            </ConfigProvider>
        </AuthProvider>
    );
}

export default App;
