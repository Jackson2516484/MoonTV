'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import MobileHeader from '@/components/MobileHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import Sidebar from '@/components/Sidebar';
import StartupAd from '@/components/StartupAd';
import BackButtonHandler from '@/components/BackButtonHandler';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
  className?: string;
}

export default function PageLayout({
  children,
  activePath,
  className = '',
}: PageLayoutProps) {
  const [showAd, setShowAd] = useState(false);
  const adShownRef = useRef(false);

  useEffect(() => {
    // 仅在会话启动时显示一次广告
    const hasShown = sessionStorage.getItem('ad_shown');
    if (!hasShown && !adShownRef.current) {
      setShowAd(true);
      adShownRef.current = true;
      sessionStorage.setItem('ad_shown', 'true');
    }
  }, []);

  return (
    <div className='flex min-h-screen bg-gray-50 dark:bg-black relative overflow-hidden'>
      <BackButtonHandler />
      
      {/* 开屏广告 */}
      {showAd && (
        <StartupAd onFinish={() => setShowAd(false)} />
      )}

      <Suspense fallback={<div className="hidden md:block w-64 bg-gray-50 dark:bg-black" />}>
        <Sidebar activePath={activePath} />
      </Suspense>

      <div className='flex-1 flex flex-col min-w-0 mb-14 md:mb-0 relative'>
        {/* Mobile Header: 负责顶部导航、返回键、个人图标 */}
        <MobileHeader />
        
        {/* 内容区域：需要给顶部留出空间 (Header高度 + 安全区) */}
        <main
          className={`flex-1 overflow-y-auto overflow-x-hidden ${className}`}
          style={{
            paddingTop: 'calc(3.5rem + env(safe-area-inset-top))'
          }}
        >
          {children}
        </main>

        <Suspense fallback={<div className="md:hidden h-14 bg-white dark:bg-gray-900" />}>
          <MobileBottomNav activePath={activePath} />
        </Suspense>
      </div>
    </div>
  );
}
