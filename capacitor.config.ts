import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wangzhiwei05.moontv',
  appName: 'MoonTv',
  webDir: 'out',
  server: {
    // Android 允许 http 明文流量：直播/下载国内 http 源时可直接访问
    cleartext: true,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK'
    }
  }
};

export default config;