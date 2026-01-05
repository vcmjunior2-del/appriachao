
import React, { useState, useEffect, useRef } from 'react';
import { Screen, ServiceTypeDefinition, Secretariat } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { auth, db } from './firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore'; 
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
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.WELCOME);
  const [selectedService, setSelectedService] = useState<ServiceTypeDefinition | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [activeSecretariat, setActiveSecretariat] = useState<Secretariat | null>(null);
  const [cityGuideCategory, setCityGuideCategory] = useState<string | undefined>(undefined);
  
  // State for the Splash Screen
  const [showSplash, setShowSplash] = useState(true);
  const isFirstLoad = useRef(true);

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
          if (Notification.permission === 'default') {
              Notification.requestPermission();
          }
      }

      if (!currentUser) return;

      // 2. Listen to Notifications Collection
      const q = query(
          collection(db, "notifications"),
          where("userId", "in", [currentUser.uid, "all"])
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
          // Skip the first snapshot (initial load of existing data)
          if (isFirstLoad.current) {
              isFirstLoad.current = false;
              return;
          }

          snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                  const notifData = change.doc.data();
                  // Check if browser notifications are allowed
                  if (Notification.permission === 'granted') {
                      new Notification(notifData.title || "Nova Atualização", {
                          body: notifData.message || "Você tem uma nova notificação da prefeitura.",
                          icon: '/icon-192.png', // Fallback icon path (browser default if not found)
                          tag: 'riachao-app'
                      });
                  }
              }
          });
      });

      return () => unsubscribe();
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
            alert("Login anônimo não habilitado no Firebase Console.");
        } else {
            alert("Erro ao entrar como convidado. Tente novamente.");
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

  const handleNavigate = (screen: Screen, params?: any) => {
      if (screen === Screen.CITY_GUIDE && params) {
          setCityGuideCategory(params);
      }
      setCurrentScreen(screen);
  };

  if (loading) {
     return <SplashScreen isVisible={true} />;
  }

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

      // --- App Routes ---
      case Screen.HOME:
        return <HomeScreen onNavigate={handleNavigate} />;
      case Screen.SERVICES:
        return <ServicesScreen 
                  onBack={() => setCurrentScreen(Screen.HOME)} 
                  onSelectService={handleSelectService}
                  activeSecretariat={activeSecretariat}
                  onSelectSecretariat={setActiveSecretariat}
               />;
      case Screen.INFO_SERVICES: 
        return <InfoServicesScreen 
                  onBack={() => setCurrentScreen(Screen.HOME)} 
                  onNavigateToTracker={() => setCurrentScreen(Screen.GARBAGE_TRACKER)}
               />;
      case Screen.REQUESTS:
        return <RequestsScreen 
                  onBack={() => setCurrentScreen(Screen.HOME)} 
                  onSelectRequest={handleSelectRequest} 
               />;
      case Screen.REQUEST_TRACKING:
        if (!selectedRequestId) return <RequestsScreen onBack={() => setCurrentScreen(Screen.HOME)} onSelectRequest={handleSelectRequest} />;
        return <RequestTrackingScreen 
                  requestId={selectedRequestId} 
                  onBack={() => setCurrentScreen(Screen.REQUESTS)} 
               />;
      case Screen.PROFILE:
        return <ProfileScreen onLogout={() => setCurrentScreen(Screen.WELCOME)} />;
      case Screen.SERVICE_DETAILS:
        return <ServiceDetailsScreen 
                    onBack={() => setCurrentScreen(Screen.SERVICES)} 
                    service={selectedService}
               />;
      case Screen.ALERTS:
        return <AlertsScreen onBack={() => setCurrentScreen(Screen.HOME)} />;
      case Screen.EMERGENCY:
        return <EmergencyScreen onBack={() => setCurrentScreen(Screen.HOME)} />;
        
      // New Routes
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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex justify-center">
        {showSplash && <SplashScreen isVisible={showSplash} />}

        {isAdminMode ? (
             <div className="min-h-screen bg-[#111a22] w-full animate-in fade-in duration-500">
                {renderScreen()}
            </div>
        ) : (
             <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen shadow-2xl overflow-hidden relative flex flex-col">
                <div key={currentScreen} className="page-enter flex-1 flex flex-col w-full h-full">
                    {renderScreen()}
                </div>
                {showBottomNav && (
                    <DashboardBottomNav 
                        currentScreen={currentScreen} 
                        onNavigate={setCurrentScreen} 
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
                <AppContent />
            </ConfigProvider>
        </AuthProvider>
    );
}

export default App;
