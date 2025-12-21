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
    // 强制清理 auth
    if (typeof document !== 'undefined') {
      document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }

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
      
      {showAd && (
        <StartupAd onFinish={() => setShowAd(false)} />
      )}

      <Suspense fallback={<div className="hidden md:block w-64 bg-gray-50 dark:bg-black" />}>
        <Sidebar activePath={activePath} />
      </Suspense>

      <div className='flex-1 flex flex-col min-w-0 mb-14 md:mb-0 relative'>
        <MobileHeader />
        
        {/* 内容区域：Top Padding 增加适配新的 Header 高度 (4rem) */}
        <main
          className={`flex-1 overflow-y-auto overflow-x-hidden ${className}`}
          style={{
            paddingTop: 'calc(4rem + env(safe-area-inset-top))'
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
