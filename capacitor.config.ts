
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sooqsy.app',
  appName: 'Sooq.Sy',
  webDir: 'dist',
  plugins: {
    LiveUpdate: {
      readyTimeout: 10000,
      autoBlockRolledBackBundles: true,
    },
  },
};

export default config;
