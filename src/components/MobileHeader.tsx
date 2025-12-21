'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BackButton } from './BackButton';
import { useSite } from './SiteProvider';
import UserMenu from './UserMenu';

interface MobileHeaderProps {
  showBackButton?: boolean;
}

const MobileHeader = ({ showBackButton = false }: MobileHeaderProps) => {
  const { siteName } = useSite();
  const pathname = usePathname();
  
  // 恢复原版逻辑：由传入 props 或路径决定是否显示返回
  // 但为了横屏体验，我们在非首页都显示
  const shouldShowBack = showBackButton || (pathname !== '/');

  return (
    <header 
      className='md:hidden fixed top-0 left-0 right-0 z-[5000] bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm dark:bg-gray-900/80 dark:border-gray-700/50 transition-transform duration-300'
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        height: 'calc(3.5rem + env(safe-area-inset-top))',
      }}
    >
      <div className='h-14 flex items-center justify-between px-4'>
        {/* 左侧：返回按钮 (原版位置) */}
        <div className='flex items-center gap-2 min-w-[2.5rem]'>
          {shouldShowBack && <BackButton />}
        </div>

        {/* 中间：Logo (原版位置，绝对居中) */}
        <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pt-[env(safe-area-inset-top)]'>
          <Link
            href='/'
            className='text-2xl font-black text-green-600 tracking-tighter hover:opacity-80 transition-opacity drop-shadow-sm whitespace-nowrap'
          >
            {siteName}
          </Link>
        </div>

        {/* 右侧：用户菜单 (原版位置) */}
        <div className='flex items-center justify-end gap-2 min-w-[2.5rem]'>
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
