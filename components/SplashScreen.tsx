
import React from 'react';
import { motion } from 'framer-motion';
import { useConfig } from '../contexts/ConfigContext';

interface SplashScreenProps {
  isVisible: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ isVisible }) => {
  const { config } = useConfig();
  
  // Show a simple loading spinner while config is loading
  if (!config) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background-light dark:bg-background-dark">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const logoUrl = config.logoUrl || "https://i.imgur.com/8Q5Z5Z5.png";

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ 
        opacity: 0,
        transition: { duration: 0.8, ease: [0.43, 0.13, 0.23, 0.96] }
      }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background-light dark:bg-background-dark overflow-hidden"
    >
          
          {/* Background Gradient Blob effect */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [0.8, 1.2, 1],
              opacity: [0, 0.5, 0.3],
            }}
            transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 rounded-full blur-3xl"
          ></motion.div>

          {/* Main Content Container */}
          <div className="relative z-10 flex flex-col items-center">
            
            {/* Logo Container with Zoom-in Animation */}
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ 
                scale: 15, 
                opacity: 0,
                transition: { duration: 1, ease: "easeInOut" }
              }}
              className="relative mb-6"
            >
                {/* Circular Logo Container */}
                <div className="w-28 h-28 bg-white dark:bg-[#1e293b] rounded-full shadow-2xl flex items-center justify-center border-4 border-white dark:border-gray-800 overflow-hidden relative">
                     <img 
                        src={logoUrl} 
                        alt="Logo" 
                        className="w-full h-full object-contain p-0 scale-120 transition-all duration-500 opacity-100"
                        referrerPolicy="no-referrer"
                     />
                </div>
                
                {/* Refined Loading Ring */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-2 border-2 border-primary/10 border-t-primary rounded-full"
                ></motion.div>
            </motion.div>

            {/* Text */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-1"
            >
                <h2 className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-[0.4em] ml-[0.4em]">
                    {config?.municipalityName || "Prefeitura de"}
                </h2>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {config?.appName || "Riachão"}
                </h1>
            </motion.div>

          </div>

          {/* Bottom version text */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-12 text-gray-400 dark:text-gray-500 text-[10px] font-medium tracking-widest uppercase"
          >
            Carregando serviços...
          </motion.div>
        </motion.div>
  );
};

export default SplashScreen;
