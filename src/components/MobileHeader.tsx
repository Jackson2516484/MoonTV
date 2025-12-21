'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BackButton } from './BackButton';
import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import UserMenu from './UserMenu';

const MobileHeader = () => {
  const { siteName } = useSite();
  const pathname = usePathname();
  const showBackButton = pathname !== '/';

  return (
    <header 
      className='md:hidden fixed top-0 left-0 right-0 z-[5000] bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm dark:bg-gray-900/80 dark:border-gray-700/50 transition-transform duration-300'
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        // 高度减小：3rem (约48px) + 安全区
        height: 'calc(3rem + env(safe-area-inset-top))',
      }}
    >
      <div className='h-12 flex items-center justify-between px-4'>
        {/* 左侧：返回按钮 */}
        <div className='flex items-center gap-2 min-w-[4rem]'>
          {showBackButton && <BackButton />}
        </div>

        {/* 中间：Logo (绝对居中，且上移与按钮对齐) */}
        <div 
          className='absolute left-1/2 -translate-x-1/2 flex items-center justify-center'
          style={{
            top: 'calc(env(safe-area-inset-top) + 1.5rem)', // 垂直居中于内容区
            transform: 'translate(-50%, -50%)'
          }}
        >
          <Link
            href='/'
            className='text-xl font-black text-green-600 tracking-tighter hover:opacity-80 transition-opacity drop-shadow-sm whitespace-nowrap'
          >
            {siteName}
          </Link>
        </div>

        {/* 右侧：主题 + 用户菜单 */}
        <div className='flex items-center justify-end gap-3 min-w-[4rem]'>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
