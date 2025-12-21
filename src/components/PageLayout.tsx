'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { t } = useLanguage();
  const { isAdmin, hasCheckedIdentity, setHasCheckedIdentity, setIsAdmin } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [showIdentityCheck, setShowIdentityCheck] = useState(false);
  const [showAd, setShowAd] = useState(false);

  // 初始身份检查：如果未检查身份且不在登录页，则显示弹窗
  useEffect(() => {
    if (!hasCheckedIdentity && pathname !== '/login') {
      setShowIdentityCheck(true);
    } else {
      setShowIdentityCheck(false);
    }
  }, [hasCheckedIdentity, pathname]);

  const handleIdentitySelection = (isUserAdmin: boolean) => {
    setHasCheckedIdentity(true);
    setShowIdentityCheck(false);
    
    if (isUserAdmin) {
      // 如果选择是管理员，跳转到登录页
      router.push('/login');
    } else {
      setIsAdmin(false);
      // 普通用户进入应用后显示 5s 广告
      setShowAd(true);
    }
  };

  return (
    <div className='flex min-h-screen bg-gray-50 dark:bg-black relative overflow-hidden'>
      <BackButtonHandler />
      
      {/* 身份询问 Modal - 确保在最高层 */}
      {showIdentityCheck && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-8 animate-scale-in border border-gray-100 dark:border-gray-800">
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                {t('areYouAdmin')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                请选择您的身份以继续
              </p>
            </div>
            <div className="grid gap-4">
              <button
                onClick={() => handleIdentitySelection(true)}
                className="w-full py-4 px-6 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-bold transition-all transform active:scale-95 border border-gray-200 dark:border-gray-700"
              >
                {t('adminLogin')}
              </button>
              <button
                onClick={() => handleIdentitySelection(false)}
                className="w-full py-4 px-6 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold shadow-xl shadow-green-500/40 transition-all transform active:scale-95"
              >
                {t('guestAccess')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 开屏广告 - 全屏 object-contain */}
      {showAd && !isAdmin && (
        <StartupAd onFinish={() => setShowAd(false)} />
      )}

      <Suspense fallback={<div className="hidden md:block w-64 bg-gray-50 dark:bg-black" />}>
        {/* Sidebar for Desktop */}
        <Sidebar activePath={activePath} />
      </Suspense>

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col min-w-0 mb-14 md:mb-0 relative'>
        {/* Mobile Header - 包含返回键逻辑 */}
        <MobileHeader showBackButton={pathname !== '/' && pathname !== '/login'} />

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
