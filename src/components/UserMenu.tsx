'use client';

import { Menu, Transition } from '@headlessui/react';
import {
  Settings,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
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
      
      <Menu as='div' className='relative inline-block text-left'>
        <div>
          <Menu.Button className='flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none'>
            <User className='w-6 h-6 text-gray-600 dark:text-gray-300' />
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
          <Menu.Items className='absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-gray-700 rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none z-[5000]'>
            
            {/* 主要功能区 */}
            <div className='p-1.5'>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className={`${
                      active
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'text-gray-700 dark:text-gray-200'
                    } group flex w-full items-center rounded-xl px-3 py-3 text-sm font-medium transition-all`}
                  >
                    <Settings className='mr-3 h-5 w-5 text-gray-400 group-hover:text-green-500' />
                    本地设置
                  </button>
                )}
              </Menu.Item>
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