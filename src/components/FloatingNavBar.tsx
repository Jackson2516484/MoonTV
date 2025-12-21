'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BackButton } from './BackButton';
import UserMenu from './UserMenu';

/**
 * 悬浮导航栏：只包含返回键和用户图标
 * 位于标题栏下方，内容层上方，左右分布
 */
const FloatingNavBar = () => {
  const pathname = usePathname();
  // 首页不显示返回键
  const showBackButton = pathname !== '/';

  return (
    <>
      {/* 返回键 - 左侧悬浮 */}
      {showBackButton && (
        <div 
          className="md:hidden fixed z-[4000] top-16 left-4"
          style={{ 
            top: 'calc(3.5rem + env(safe-area-inset-top) + 10px)', // 位于 Header 下方
            left: 'max(1rem, env(safe-area-inset-left))' 
          }}
        >
          <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-full shadow-lg p-1 border border-gray-200/50 dark:border-gray-700/50">
            <BackButton />
          </div>
        </div>
      )}

      {/* 用户图标 - 右侧悬浮 */}
      <div 
        className="md:hidden fixed z-[4000] top-16 right-4"
        style={{ 
          top: 'calc(3.5rem + env(safe-area-inset-top) + 10px)', // 位于 Header 下方
          right: 'max(1rem, env(safe-area-inset-right))' 
        }}
      >
        <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-full shadow-lg border border-gray-200/50 dark:border-gray-700/50">
          <UserMenu />
        </div>
      </div>
    </>
  );
};

export default FloatingNavBar;
