'use client'; // 👈 这一行非常重要，表示这是客户端组件

import { useEffect } from 'react';
import { ScreenOrientation } from '@capacitor/screen-orientation';

export default function OrientationManager() {
  useEffect(() => {
    // 定义监听函数
    const handleFullscreenChange = async () => {
      // 🕵️ 检测：现在是不是全屏？
      const isFullscreen = !!document.fullscreenElement;

      if (isFullscreen) {
        // 🚨 触发特权：哪怕用户锁了屏，我也要强制横过来！
        try {
          await ScreenOrientation.lock({ orientation: 'landscape' });
        } catch (e) {
          console.log('锁定横屏失败 (可能是浏览器不支持)', e);
        }
      } else {
        // 🕊️ 恢复自由：交还给系统，用户锁了就竖，没锁就转
        try {
          await ScreenOrientation.unlock();
        } catch (e) {
          console.log('解锁方向失败', e);
        }
      }
    };

    // 👂 开始监听网页的全屏事件
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    // 兼容 Safari/iOS
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // 组件卸载时取消监听
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  return null; // 这个组件不显示任何东西，只在后台干活
}