
import React, { useState, useEffect, useRef } from 'react';
import { Screen, ServiceTypeDefinition, Secretariat } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { AlertProvider, useAlert } from './contexts/AlertContext';
import { auth, db, messaging } from './firebaseConfig';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore'; 
import { getToken } from 'firebase/messaging';
import { AnimatePresence } from 'framer-motion';
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
         if (currentScreen === Screen.ADMIN_DASHBOARD && currentUser) targetScreen = Screen.ADMIN_DASHBOARD;
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

  // --- NOTIFICATION LISTENER (PUSH SIMULATION) ---
  useEffect(() => {
      // 1. Request Permission on App Load/Login
      if (currentUser && 'Notification' in window) {
          Notification.requestPermission().then((permission) => {
              if (permission === 'granted') {
                  getToken(messaging, { vapidKey: 'BK_nOJx0Rd6fW93o0vZxgDTU2QlT7ZoTzXub6524O_aNeIZP8vtmD8SBOjCYeeuu46xoLtMxx_ZtAv6UGoDMbC4' })
                      .then((currentToken) => {
                          if (currentToken) {
                              setDoc(doc(db, "users", currentUser.uid), { fcmToken: currentToken }, { merge: true });
                          }
                      })
                      .catch((err) => console.error('Error getting token:', err));
              }
          });
      }

      if (!currentUser) return;

      // 2. Listen to Notifications Collection
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
                  if (Notification.permission === 'granted') {
                      new Notification(notifData.title || "Nova Atualização", {
                          body: notifData.message || "Você tem uma nova notificação da prefeitura.",
                          icon: '/icon-192.png',
                          tag: 'riachao-app'
                      });
                  }
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
      setCurrentScreen(Screen.ADMIN_LOGIN);
  };

  const handleAdminLoginSuccess = () => {
      setCurrentScreen(Screen.ADMIN_DASHBOARD);
  };

  const handleSelectService = (service: ServiceTypeDefinition) => {
      setSelectedService(service);
      setCurrentScreen(Screen.SERVICE_DETAILS);
  };

  const handleSelectRequest = (requestId: string) => {
      setSelectedRequestId(requestId);
      setCurrentScreen(Screen.REQUEST_TRACKING);
  }

  // Refs for persistent screen containers to manage scroll position
  const screenRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToTop = (screen: Screen) => {
      const scroll = () => {
          const ref = screenRefs.current[screen];
          if (ref) {
              ref.scrollTo({ top: 0, behavior: 'instant' });
              ref.scrollTop = 0;
              
              // If it's the emergency screen, the actual scrollable element is now the first child
              if (screen === Screen.EMERGENCY && ref.firstElementChild) {
                  ref.firstElementChild.scrollTo({ top: 0, behavior: 'instant' });
                  ref.firstElementChild.scrollTop = 0;
              }
          }
      };

      // Attempt immediately
      scroll();

      // Attempt after a short delay (for state updates)
      setTimeout(scroll, 50);

      // Attempt after transition (approx 300ms)
      setTimeout(scroll, 300);
  };

  const handleNavigate = (screen: Screen, params?: any) => {
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

      setCurrentScreen(screen);
  };

  const handleBottomNavNavigate = (screen: Screen) => {
      // If clicking the active tab, scroll to top
      if (currentScreen === screen) {
          scrollToTop(screen);
      } else {
          handleNavigate(screen);
      }
  };

  if (loading) {
     return <SplashScreen isVisible={true} />;
  }

  const isTabScreen = (screen: Screen) => {
      return [Screen.HOME, Screen.INFO_SERVICES, Screen.SERVICES, Screen.EMERGENCY, Screen.PROFILE, Screen.REQUESTS, Screen.ALERTS].includes(screen);
  }

  const getPersistentScreenClass = (screen: Screen) => {
      const isActive = currentScreen === screen;
      // Remove overflow-y-auto for EMERGENCY so it can handle its own scrolling if needed,
      // or keep it but ensure we target the right element.
      const overflowClass = screen === Screen.EMERGENCY ? 'overflow-hidden' : 'overflow-y-auto';
      
      return `absolute inset-0 w-full h-full ${overflowClass} overflow-x-hidden custom-scrollbar pb-20 bg-background-light dark:bg-background-dark transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isActive ? 'opacity-100 z-10 scale-100 translate-y-0' : 'opacity-0 z-0 pointer-events-none scale-[0.95] translate-y-4'}`;
  }

  const renderPersistentScreens = () => {
      if (!currentUser) return null;
      return (
        <>
            <div 
                ref={(el) => { if (el) screenRefs.current[Screen.HOME] = el; }}
                className={getPersistentScreenClass(Screen.HOME)}
            >
                <HomeScreen onNavigate={handleNavigate} />
            </div>
            <div 
                ref={(el) => { if (el) screenRefs.current[Screen.INFO_SERVICES] = el; }}
                className={getPersistentScreenClass(Screen.INFO_SERVICES)}
            >
                <InfoServicesScreen 
                  onBack={() => handleNavigate(Screen.HOME)} 
                  onNavigateToTracker={() => handleNavigate(Screen.GARBAGE_TRACKER)}
                />
            </div>
            <div 
                ref={(el) => { if (el) screenRefs.current[Screen.SERVICES] = el; }}
                className={getPersistentScreenClass(Screen.SERVICES)}
            >
                <ServicesScreen 
                  onBack={() => handleNavigate(Screen.HOME)} 
                  onSelectService={handleSelectService}
                  activeSecretariat={activeSecretariat}
                  onSelectSecretariat={setActiveSecretariat}
               />
            </div>
            <div 
                ref={(el) => { if (el) screenRefs.current[Screen.REQUESTS] = el; }}
                className={getPersistentScreenClass(Screen.REQUESTS)}
            >
                <RequestsScreen 
                  onBack={() => handleNavigate(returnScreen)} 
                  onSelectRequest={handleSelectRequest} 
               />
            </div>
            <div 
                ref={(el) => { if (el) screenRefs.current[Screen.ALERTS] = el; }}
                className={getPersistentScreenClass(Screen.ALERTS)}
            >
                <AlertsScreen onBack={() => handleNavigate(returnScreen)} />
            </div>
            <div 
                id="emergency-screen-scroll-container"
                ref={(el) => { if (el) screenRefs.current[Screen.EMERGENCY] = el; }}
                className={getPersistentScreenClass(Screen.EMERGENCY)}
            >
                <EmergencyScreen 
                    onBack={() => handleNavigate(Screen.HOME)} 
                    isActive={currentScreen === Screen.EMERGENCY}
                />
            </div>
            <div 
                ref={(el) => { if (el) screenRefs.current[Screen.PROFILE] = el; }}
                className={getPersistentScreenClass(Screen.PROFILE)}
            >
                <ProfileScreen 
                  onLogout={() => setCurrentScreen(Screen.WELCOME)} 
                  onNavigate={handleNavigate} 
               />
            </div>
        </>
      );
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case Screen.WELCOME:
        return <WelcomeScreen 
                  onLogin={() => setCurrentScreen(Screen.LOGIN)} 
                  onRegister={() => setCurrentScreen(Screen.REGISTER)} 
                  onAdminLogin={handleAdminLoginClick}
                  onGuestLogin={handleGuestLogin}
               />;
      case Screen.LOGIN:
        return <LoginScreen 
                  onBack={() => setCurrentScreen(Screen.WELCOME)}
                  onRegister={() => setCurrentScreen(Screen.REGISTER)}
                  onLoginSuccess={handleLoginTransition} 
               />;
      case Screen.REGISTER:
        return <RegisterScreen 
                  onBack={() => setCurrentScreen(Screen.WELCOME)}
                  onLogin={() => setCurrentScreen(Screen.LOGIN)}
                  onRegisterSuccess={handleLoginTransition}
               />;
      
      // --- Admin Routes ---
      case Screen.ADMIN_LOGIN:
        return <AdminLoginScreen 
                  onBack={() => setCurrentScreen(Screen.WELCOME)}
                  onLoginSuccess={handleAdminLoginSuccess}
               />;
      case Screen.ADMIN_DASHBOARD:
        return <AdminDashboard onLogout={() => setCurrentScreen(Screen.WELCOME)} />;

      // --- Persistent Tabs (Handled by renderPersistentScreens) ---
      case Screen.HOME:
      case Screen.SERVICES:
      case Screen.INFO_SERVICES: 
      case Screen.REQUESTS:
      case Screen.PROFILE:
      case Screen.ALERTS:
      case Screen.EMERGENCY:
        return null;

      // --- Transient Screens ---
      case Screen.REQUEST_TRACKING:
        if (!selectedRequestId) return <RequestsScreen onBack={() => setCurrentScreen(returnScreen)} onSelectRequest={handleSelectRequest} />;
        return <RequestTrackingScreen 
                  requestId={selectedRequestId} 
                  onBack={() => setCurrentScreen(Screen.REQUESTS)} 
               />;
      case Screen.SERVICE_DETAILS:
        return <ServiceDetailsScreen 
                    onBack={() => setCurrentScreen(Screen.SERVICES)} 
                    service={selectedService}
               />;
      case Screen.WEATHER:
        return <WeatherScreen onBack={() => setCurrentScreen(Screen.HOME)} />;
      case Screen.DEMOGRAPHICS:
        return <DemographicsScreen onBack={() => setCurrentScreen(Screen.HOME)} />;
      case Screen.CITY_GUIDE:
        return <CityGuideScreen onBack={() => setCurrentScreen(Screen.HOME)} initialCategory={cityGuideCategory} />;
      case Screen.GARBAGE_TRACKER:
        return <GarbageTrackerScreen onBack={() => setCurrentScreen(Screen.INFO_SERVICES)} />;
        
      default:
        return <WelcomeScreen onLogin={() => setCurrentScreen(Screen.LOGIN)} onRegister={() => setCurrentScreen(Screen.REGISTER)} onAdminLogin={handleAdminLoginClick} onGuestLogin={handleGuestLogin} />;
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
                        currentScreen !== Screen.GARBAGE_TRACKER;

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
             <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full shadow-2xl overflow-hidden relative flex flex-col">
                <div className="flex-1 w-full h-full relative overflow-hidden">
                    {renderPersistentScreens()}
                    <div className={`absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar pb-20 ${!isTabScreen(currentScreen) ? 'z-20' : 'z-0 pointer-events-none'}`}>
                        {renderScreen()}
                    </div>
                </div>
                {showBottomNav && (
                    <DashboardBottomNav 
                        currentScreen={currentScreen} 
                        onNavigate={handleBottomNavNavigate} 
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
