import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wangzhiwei05.moontv',
  appName: 'MoonTv',
  webDir: 'out',
  // server 配置已移除，强制加载本地 Web 资源
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK'
    }
  }
};

export default config;