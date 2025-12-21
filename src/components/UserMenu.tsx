'use client';

import { Menu, Transition } from '@headlessui/react';
import {
  LogOut,
  Settings,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie, removeAuthInfo } from '@/lib/auth';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSelector from './LanguageSelector';

export default function UserMenu() {
  const { t } = useLanguage();
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();

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
    router.push('/login');
  };

  return (
    <Menu as='div' className='relative inline-block text-left'>
      <div>
        <Menu.Button className='flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500'>
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
        <Menu.Items className='absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-gray-700 rounded-xl bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50'>
          <div className='px-4 py-3'>
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              {username ? `Hi, ${username}` : t('guestAccess')}
            </p>
          </div>
          
          <div className='px-1 py-1'>
             <LanguageSelector />
          </div>

          <div className='px-1 py-1'>
            {username ? (
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={handleLogout}
                    className={`${
                      active
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                        : 'text-gray-700 dark:text-gray-200'
                    } group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`}
                  >
                    <LogOut className='mr-2 h-4 w-4' />
                    {t('logout')}
                  </button>
                )}
              </Menu.Item>
            ) : (
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => router.push('/login')}
                    className={`${
                      active
                        ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                        : 'text-gray-700 dark:text-gray-200'
                    } group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`}
                  >
                    <User className='mr-2 h-4 w-4' />
                    {t('login')}
                  </button>
                )}
              </Menu.Item>
            )}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}