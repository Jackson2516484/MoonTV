'use client';

import { Menu, Transition } from '@headlessui/react';
import {
  Settings,
  User,
  ShieldCheck,
  KeyRound,
  LogOut
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie, removeAuthInfo } from '@/lib/auth';
import { useLanguage } from '@/contexts/LanguageContext';
import { VersionDisplay } from '@/components/VersionDisplay';
import LocalSettingsModal from './LocalSettingsModal';

export default function UserMenu() {
  const { t } = useLanguage();
  const [username, setUsername] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const router = useRouter();

  // 即使有用户名，也不再特别显示“管理员”标签给普通用户看，
  // 除非确实是登录状态。但在新的逻辑下，默认大家都一样，只有隐式登录。
  // 我们只保留逻辑上的 isAdmin 用于显示管理入口。
  const isAdmin = !!username;

  useEffect(() => {
    const info = getAuthInfoFromBrowserCookie();
    if (info) {
      setUsername(info.username || null);
    }
  }, []);

  const handleLogout = () => {
    removeAuthInfo();
    setUsername(null);
    router.refresh();
    router.push('/');
    window.location.reload();
  };

  return (
    <>
      <LocalSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
      
      <Menu as='div' className='relative inline-block text-left z-[1000]'>
        <div>
          <Menu.Button className='flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 z-[1000]'>
            <User className='w-5 h-5 text-gray-600 dark:text-gray-300' />
          </Menu.Button>
        </div>
        <Transition
          as={Fragment}
          enter='transition ease-out duration-100'
          enterFrom='transform opacity-0 scale-95'
          enterTo='transform opacity-100 scale-100'
          leave='transition ease-in duration-75'
          leaveFrom='transform opacity-100 scale-100'
          leaveTo='transform opacity-0 scale-95'
        >
          <Menu.Items className='absolute right-0 mt-2 w-64 origin-top-right divide-y divide-gray-100 dark:divide-gray-700 rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none z-[2000]'>
            {/* 仅管理员显示头部，普通用户直接显示菜单 */}
            {isAdmin && (
              <div className='px-4 py-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-t-2xl'>
                <p className='text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider'>
                  管理员账户
                </p>
                <p className='text-base font-bold text-gray-900 dark:text-white mt-1 truncate'>
                  {username}
                </p>
              </div>
            )}
            
            {/* 主要功能区 */}
            <div className='p-1.5'>
              {/* 本地设置 (所有人) */}
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className={`${
                      active
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'text-gray-700 dark:text-gray-200'
                    } group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all`}
                  >
                    <Settings className='mr-3 h-5 w-5 text-gray-400 group-hover:text-green-500' />
                    本地设置
                  </button>
                )}
              </Menu.Item>

              {/* 管理员专有区 */}
              {isAdmin && (
                <>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => router.push('/admin')}
                        className={`${
                          active
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                            : 'text-gray-700 dark:text-gray-200'
                        } group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all`}
                      >
                        <ShieldCheck className='mr-3 h-5 w-5 text-gray-400 group-hover:text-green-500' />
                        管理面板
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => router.push('/admin/password')} 
                        className={`${
                          active
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                            : 'text-gray-700 dark:text-gray-200'
                        } group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all`}
                      >
                        <KeyRound className='mr-3 h-5 w-5 text-gray-400 group-hover:text-green-500' />
                        修改密码
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleLogout}
                        className={`${
                          active
                            ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                            : 'text-gray-700 dark:text-gray-200'
                        } group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all`}
                      >
                        <LogOut className='mr-3 h-5 w-5 text-gray-400 group-hover:text-red-500' />
                        {t('logout')}
                      </button>
                    )}
                  </Menu.Item>
                </>
              )}
            </div>

            {/* 版本展示 (所有人) */}
            <div className='p-2 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-2xl'>
               <VersionDisplay className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-mono text-gray-400 dark:text-gray-500 hover:text-green-500 transition-colors cursor-pointer" />
            </div>
          </Menu.Items>
        </Transition>
      </Menu>
    </>
  );
}
