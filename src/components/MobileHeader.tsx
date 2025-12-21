'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { BackButton } from './BackButton';
import { useSite } from './SiteProvider';
import UserMenu from './UserMenu';

interface MobileHeaderProps {
  showBackButton?: boolean;
}

const MobileHeader = ({ showBackButton = false }: MobileHeaderProps) => {
  const { siteName } = useSite();
  const pathname = usePathname();
  
  // 始终在非首页显示返回键，即使是横屏
  const shouldShowBack = showBackButton || (pathname !== '/' && pathname !== '/login');

  return (
    <header className='md:hidden relative w-full bg-white/80 backdrop-blur-2xl border-b border-gray-200/50 shadow-sm dark:bg-gray-900/80 dark:border-gray-700/50 z-[5000]'>
      <div 
        className='flex items-center justify-between px-4'
        style={{
          // 适配刘海屏和横屏安全区
          height: '3.5rem',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        {/* 左侧：返回按钮 */}
        <div className='flex items-center w-12'>
          {shouldShowBack && <BackButton />}
        </div>

        {/* 中间：Logo（绝对居中） */}
        <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'>
          <Link
            href='/'
            className='text-2xl font-black text-green-600 tracking-tighter hover:opacity-80 transition-opacity drop-shadow-sm whitespace-nowrap'
          >
            {siteName}
          </Link>
        </div>

        {/* 右侧按钮 */}
        <div className='flex items-center w-12 justify-end'>
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
