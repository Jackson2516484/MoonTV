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
  
  // 原项目逻辑：非首页显示返回键
  const showBackButton = pathname !== '/';

  return (
    <header 
      className='md:hidden fixed top-0 left-0 right-0 z-[5000] bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm dark:bg-gray-900/80 dark:border-gray-700/50 transition-transform duration-300'
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        height: 'calc(3.5rem + env(safe-area-inset-top))',
      }}
    >
      <div className='h-14 flex items-center justify-between px-4'>
        {/* 左侧：返回按钮 */}
        <div className='flex items-center gap-2 min-w-[2.5rem]'>
          {showBackButton && <BackButton />}
        </div>

        {/* 中间：Logo (绝对居中) */}
        <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pt-[env(safe-area-inset-top)]'>
          <Link
            href='/'
            className='text-2xl font-black text-green-600 tracking-tighter hover:opacity-80 transition-opacity drop-shadow-sm whitespace-nowrap'
          >
            {siteName}
          </Link>
        </div>

        {/* 右侧：主题切换 + 用户菜单 (恢复原项目布局) */}
        <div className='flex items-center justify-end gap-3 min-w-[2.5rem]'>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;