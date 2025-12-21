'use client';

import Link from 'next/link';
import { useSite } from './SiteProvider';

// 纯展示用的 Header，不包含交互按钮
const MobileHeader = () => {
  const { siteName } = useSite();
  return (
    <header className='md:hidden relative w-full bg-white/80 backdrop-blur-2xl border-b border-gray-200/50 shadow-sm dark:bg-gray-900/80 dark:border-gray-700/50 z-[3000]'>
      <div 
        className='h-14 flex items-center justify-center px-4 relative'
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(3.5rem + env(safe-area-inset-top))',
        }}
      >
        <Link
          href='/'
          className='text-2xl font-black text-green-600 tracking-tighter hover:opacity-80 transition-opacity drop-shadow-sm whitespace-nowrap'
        >
          {siteName}
        </Link>
      </div>
    </header>
  );
};

export default MobileHeader;