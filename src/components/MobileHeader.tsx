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
      // 增加 z-index 到极高值，确保横屏时不被覆盖
      className='md:hidden fixed top-0 left-0 right-0 z-[9000] bg-white/95 backdrop-blur-xl border-b border-gray-200/50 shadow-sm dark:bg-gray-900/95 dark:border-gray-700/50 transition-all duration-300'
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        // 增加高度：原 3.5rem (56px) -> 4rem (64px)，相当于增加了约 8mm (实际上是 8px，视觉上更宽)
        height: 'calc(4rem + env(safe-area-inset-top))',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className='h-full flex items-center justify-between px-4'>
        {/* 左侧：返回按钮 */}
        <div className='flex items-center gap-2 min-w-[4rem]'>
          {showBackButton && <BackButton />}
        </div>

        {/* 中间：Logo */}
        <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pt-[env(safe-area-inset-top)]'>
          <Link
            href='/'
            className='text-2xl font-black text-green-600 tracking-tighter hover:opacity-80 transition-opacity drop-shadow-sm whitespace-nowrap'
          >
            {siteName}
          </Link>
        </div>

        {/* 右侧：主题切换 + 用户菜单 */}
        <div className='flex items-center justify-end gap-3 min-w-[4rem]'>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;