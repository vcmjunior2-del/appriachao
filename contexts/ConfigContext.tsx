import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AppConfig } from '../types';

interface ConfigContextType {
  config: AppConfig | null;
  loading: boolean;
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  loading: true,
});

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, "app_config", "general");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setConfig(docSnap.data() as AppConfig);
      }
      setLoading(false);
    }, (error) => {
        console.error("Error fetching app config:", error);
        setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (config) {
      // Update Title
      if (config.appName) {
        document.title = config.appName;
        const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (appleTitle) appleTitle.setAttribute('content', config.appName);
      }

      // Update Icons and Manifest
      if (config.logoUrl) {
        // Update apple-touch-icon
        let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (!appleIcon) {
          appleIcon = document.createElement('link');
          appleIcon.setAttribute('rel', 'apple-touch-icon');
          document.head.appendChild(appleIcon);
        }
        appleIcon.setAttribute('href', config.logoUrl);

        // Update favicon
        let favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.setAttribute('rel', 'icon');
          document.head.appendChild(favicon);
        }
        favicon.setAttribute('href', config.logoUrl);

        // Update manifest dynamically
        const manifest = {
          short_name: config.appName || "Riachão",
          name: config.appName || "Riachão Cidadão",
          icons: [
            {
              src: config.logoUrl,
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: config.logoUrl,
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ],
          start_url: "/",
          display: "standalone",
          theme_color: "#135bec",
          background_color: "#f6f6f8",
          orientation: "portrait"
        };
        
        const manifestDataUri = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(manifest))}`;
        
        let manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
          manifestLink = document.createElement('link');
          manifestLink.setAttribute('rel', 'manifest');
          document.head.appendChild(manifestLink);
        }
        manifestLink.setAttribute('href', manifestDataUri);
      }
    }
  }, [config]);

  const value = {
    config,
    loading,
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};
