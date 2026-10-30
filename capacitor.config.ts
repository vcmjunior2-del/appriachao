import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.riachao.cidadao',
  appName: 'Riachão Cidadão',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    FirebaseMessaging: {
      // Com o app aberto, o aviso aparece dentro do app (evita notificação duplicada)
      presentationOptions: []
    }
  }
};

export default config;
