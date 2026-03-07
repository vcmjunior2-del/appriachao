import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.riachao.cidadao',
  appName: 'Riachão Cidadão',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
