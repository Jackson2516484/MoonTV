import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wangzhiwei05.moontv',  // 👈 必须是这个！不能是 com.example.app
  appName: 'MoonTv',                  // 👈 名字
  webDir: 'out',
  server: {
    url: 'https://moon.wangzhiwei05.dpdns.org', // 👈 你的网址
    cleartext: true
  }
};

export default config;