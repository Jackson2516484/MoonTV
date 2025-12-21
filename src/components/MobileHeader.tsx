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
  
  // 恢复原版逻辑：非首页显示返回键
  const showBackButton = pathname !== '/';

  return (
    <header 
      // 移除 md:hidden，确保在横屏（可能被识别为 md）下依然显示
      // z-index 设为非常高，防止被视频全屏层遮挡（除非视频是原生全屏）
      className='fixed top-0 left-0 right-0 z-[9999] bg-white/90 backdrop-blur-xl border-b border-gray-200/50 shadow-sm dark:bg-gray-900/90 dark:border-gray-700/50 transition-all duration-300'
      style={{
        paddingTop: 'env(safe-area-inset-top)', // 适配顶部刘海
        height: 'calc(3.5rem + env(safe-area-inset-top))',
        paddingLeft: 'env(safe-area-inset-left)', // 适配横屏左侧安全区
        paddingRight: 'env(safe-area-inset-right)', // 适配横屏右侧安全区
      }}
    >
      <div className='h-14 flex items-center justify-between px-4'>
        {/* 左侧：返回按钮 */}
        <div className='flex items-center gap-2 min-w-[4rem]'>
          {showBackButton && <BackButton />}
        </div>

        {/* 中间：Logo (绝对居中) */}
        <div 
          className='absolute left-1/2 top-1/2 -translate-x-1/2' 
          style={{
             // 由于父容器有 paddingTop，这里的 top-1/2 需要加上 paddingTop 的一半才能视觉居中
             // 或者简单点，直接用 marginTop
             marginTop: 'calc(env(safe-area-inset-top) / 2)' 
          }}
        >
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