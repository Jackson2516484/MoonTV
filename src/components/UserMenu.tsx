'use client';

import { Menu, Transition } from '@headlessui/react';
import { Settings, User, Globe } from 'lucide-react'; // 引入 Globe 图标
import { Fragment, useState } from 'react';

import { useLanguage } from '@/contexts/LanguageContext';
import { VersionDisplay } from '@/components/VersionDisplay';
import LocalSettingsModal from './LocalSettingsModal';

export default function UserMenu() {
  const { t } = useLanguage();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <LocalSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
      
      <Menu as='div' className='relative inline-block text-left z-[5001]'>
        <div>
          <Menu.Button className='flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500'>
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
          <Menu.Items className='absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-gray-700 rounded-xl bg-white dark:bg-gray-900 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-[5002]'>
            
            <div className='p-1'>
              {/* 语言设置 - 直接作为菜单项 */}
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => setIsSettingsOpen(true)} // 复用 SettingModal，或者可以新建一个专门选语言的
                    className={`${
                      active
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'text-gray-700 dark:text-gray-200'
                    } group flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all`}
                  >
                    <Globe className='mr-3 h-4 w-4 text-gray-400 group-hover:text-green-500' />
                    {t('language')}
                  </button>
                )}
              </Menu.Item>
            </div>

            {/* 版本展示 - 点击弹出二维码 */}
            <div className='p-2 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-xl'>
               <VersionDisplay className="w-full flex items-center justify-center gap-2 py-1 text-[10px] font-mono text-gray-400 dark:text-gray-500 hover:text-green-500 transition-colors cursor-pointer" />
            </div>
          </Menu.Items>
        </Transition>
      </Menu>
    </>
  );
}
