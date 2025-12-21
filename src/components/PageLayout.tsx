'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
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
  const [showIdentityCheck, setShowIdentityCheck] = useState(false);
  const [showAd, setShowAd] = useState(false);

  // 初始身份检查
  useEffect(() => {
    if (!hasCheckedIdentity) {
      setShowIdentityCheck(true);
    }
  }, [hasCheckedIdentity]);

  const handleIdentitySelection = (isUserAdmin: boolean) => {
    setHasCheckedIdentity(true);
    setShowIdentityCheck(false);
    
    if (isUserAdmin) {
      router.push('/login');
    } else {
      setIsAdmin(false);
      // 普通用户显示广告
      setShowAd(true);
    }
  };

  return (
    <div className='flex min-h-screen bg-gray-50 dark:bg-black'>
      <BackButtonHandler />
      
      {/* 身份询问 Modal */}
      {showIdentityCheck && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6 animate-scale-in">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('areYouAdmin')}</h2>
            <div className="grid gap-4">
              <button
                onClick={() => handleIdentitySelection(true)}
                className="w-full py-3.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-medium transition-colors"
              >
                {t('adminLogin')}
              </button>
              <button
                onClick={() => handleIdentitySelection(false)}
                className="w-full py-3.5 px-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-500/30 transition-all transform active:scale-95"
              >
                {t('guestAccess')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 开屏广告 */}
      {showAd && !isAdmin && (
        <StartupAd onFinish={() => setShowAd(false)} />
      )}

      <Suspense fallback={<div className="hidden md:block w-64 bg-gray-50 dark:bg-black" />}>
        {/* Sidebar for Desktop */}
        <Sidebar activePath={activePath} />
      </Suspense>

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col min-w-0 mb-14 md:mb-0 relative'>
        {/* Mobile Header */}
        <MobileHeader />

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