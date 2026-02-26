import React, { createContext, useContext, useState, useCallback } from 'react';

interface AlertOptions {
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onConfirm?: () => void;
}

interface AlertContextType {
  showAlert: (options: AlertOptions | string) => void;
}

const AlertContext = createContext<AlertContextType>({
  showAlert: () => {},
});

export const useAlert = () => useContext(AlertContext);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alertData, setAlertData] = useState<AlertOptions | null>(null);

  const showAlert = useCallback((options: AlertOptions | string) => {
    if (typeof options === 'string') {
      setAlertData({ message: options, type: 'info' });
    } else {
      setAlertData({ type: 'info', ...options });
    }
    setIsOpen(true);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    if (alertData?.onConfirm) {
      alertData.onConfirm();
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {isOpen && alertData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              {alertData.type === 'success' && (
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-4xl text-green-600 dark:text-green-400">check_circle</span>
                </div>
              )}
              {alertData.type === 'error' && (
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-4xl text-red-600 dark:text-red-400">error</span>
                </div>
              )}
              {alertData.type === 'warning' && (
                <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-4xl text-yellow-600 dark:text-yellow-400">warning</span>
                </div>
              )}
              {alertData.type === 'info' && (
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-4xl text-blue-600 dark:text-blue-400">info</span>
                </div>
              )}
              
              {alertData.title && (
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{alertData.title}</h3>
              )}
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                {alertData.message}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleClose}
                className="w-full py-3 px-4 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl transition-colors active:scale-[0.98]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};
