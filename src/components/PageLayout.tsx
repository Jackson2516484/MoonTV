'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import MobileHeader from '@/components/MobileHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import Sidebar from '@/components/Sidebar';
import StartupAd from '@/components/StartupAd';
import BackButtonHandler from '@/components/BackButtonHandler';
// 移除 FloatingNavBar 引用

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
  const pathname = usePathname();

  useEffect(() => {
    // 确保广告只在应用会话启动时显示一次
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
        {/* Sidebar for Desktop */}
        <Sidebar activePath={activePath} />
      </Suspense>

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col min-w-0 mb-14 md:mb-0 relative'>
        {/* 恢复原版布局：Fixed Header */}
        <MobileHeader showBackButton={pathname !== '/'} />
        
        {/* 
           由于 MobileHeader 变成了 fixed，我们需要给 main 内容加 padding-top 
           高度计算：3.5rem (Header height) + env(safe-area-inset-top)
        */}
        <main
          className={`flex-1 overflow-y-auto overflow-x-hidden ${className}`}
          style={{
            paddingTop: 'calc(3.5rem + env(safe-area-inset-top))'
          }}
        >
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <Suspense fallback={<div className="md:hidden h-14 bg-white dark:bg-gray-900" />}>
          <MobileBottomNav activePath={activePath} />
        </Suspense>
      </div>
    </div>
  );
}