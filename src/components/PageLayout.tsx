'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
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
  // 默认视为普通用户，不进行身份检查
  const { setIsAdmin } = useUser();
  const [showAd, setShowAd] = useState(true); // 默认显示广告
  const pathname = usePathname();

  useEffect(() => {
    // 强制设置为非管理员
    setIsAdmin(false);
  }, [setIsAdmin]);

  // 如果是登录页（作为隐式管理入口），不显示广告
  useEffect(() => {
    if (pathname === '/login' || pathname.startsWith('/admin')) {
      setShowAd(false);
    }
  }, [pathname]);

  return (
    <div className='flex min-h-screen bg-gray-50 dark:bg-black relative overflow-hidden'>
      <BackButtonHandler />
      
      {/* 开屏广告 - 仅在根路径且非管理页显示 */}
      {showAd && pathname === '/' && (
        <StartupAd onFinish={() => setShowAd(false)} />
      )}

      <Suspense fallback={<div className="hidden md:block w-64 bg-gray-50 dark:bg-black" />}>
        {/* Sidebar for Desktop */}
        <Sidebar activePath={activePath} />
      </Suspense>

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col min-w-0 mb-14 md:mb-0 relative'>
        {/* Mobile Header - 包含返回键逻辑 */}
        <MobileHeader showBackButton={pathname !== '/'} />

        {/* Content */}
        <main
          className={`flex-1 overflow-y-auto overflow-x-hidden ${className} pt-[env(safe-area-inset-top)]`}
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