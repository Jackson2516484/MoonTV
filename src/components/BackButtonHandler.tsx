/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function BackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const isHandlingRef = useRef(false);

  useEffect(() => {
    // 每次路径变化时，确保历史栈中有一个可拦截的状态
    const handlePushState = () => {
      window.history.pushState({ protected: true }, '', window.location.href);
    };

    handlePushState();

    const handlePopState = (event: PopStateEvent) => {
      if (isHandlingRef.current) return;
      
      // 如果不是首页，点击返回时我们尝试回退
      if (pathname !== '/') {
        // 让 Next.js 路由尝试回退
        // 由于我们手动 pushState 了一次，popstate 会先消耗掉那个 state
        // 我们需要再次判断
        isHandlingRef.current = true;
        router.back();
        setTimeout(() => { isHandlingRef.current = false; }, 100);
      } else {
        // 如果是首页，点击返回则重新 pushState，防止应用退出
        handlePushState();
        // 这里可以弹出“再按一次退出”的提示（如果需要）
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [pathname, router]);

  return null;
}