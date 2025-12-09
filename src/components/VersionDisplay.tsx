/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { checkForUpdates, CURRENT_VERSION, UpdateStatus } from '@/lib/version';

export function VersionDisplay({ className }: { className?: string }) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const status = await checkForUpdates();
        setUpdateStatus(status);
      } catch (_) {
        // do nothing
      } finally {
        setIsChecking(false);
      }
    };
    checkUpdate();
  }, []);

  return (
    <>
      <button
        onClick={() => setIsDonateModalOpen(true)}
        className={
          className ||
          'absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 transition-colors cursor-pointer'
        }
      >
        <span className='font-mono'>v{CURRENT_VERSION}</span>
        {!isChecking && updateStatus !== UpdateStatus.FETCH_FAILED && (
          <div
            className={`flex items-center gap-1.5 ${
              updateStatus === UpdateStatus.HAS_UPDATE
                ? 'text-yellow-600 dark:text-yellow-400'
                : updateStatus === UpdateStatus.NO_UPDATE
                ? 'text-green-600 dark:text-green-400'
                : ''
            }`}
          >
            {updateStatus === UpdateStatus.HAS_UPDATE && (
              <>
                <AlertCircle className='w-3.5 h-3.5' />
                <span className='font-semibold text-xs'>有新版本</span>
              </>
            )}
            {updateStatus === UpdateStatus.NO_UPDATE && (
              <>
                <CheckCircle className='w-3.5 h-3.5' />
                <span className='font-semibold text-xs'>已是最新</span>
              </>
            )}
          </div>
        )}
      </button>

      {isDonateModalOpen && (
        <div
          onClick={() => setIsDonateModalOpen(false)}
          className='fixed inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-50 backdrop-blur-sm'
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className='bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 md:p-8'
          >
            <h3 className='text-center text-lg font-bold text-gray-800 dark:text-gray-200 mb-4'>
              感谢支持！
            </h3>
            <div className='flex flex-col md:flex-row gap-6 md:gap-8'>
              <div className='flex flex-col items-center gap-2'>
                <Image
                  src='/wechat_donate.jpg'
                  alt='WeChat Donate QR Code'
                  width={224}
                  height={224}
                  className='rounded-lg object-cover'
                />
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  WeChat Donate QR Code
                </p>
              </div>
              <div className='flex flex-col items-center gap-2'>
                <Image
                  src='/alipay_donate.jpg'
                  alt='AliPay Donate QR Code'
                  width={224}
                  height={224}
                  className='rounded-lg object-cover'
                />
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  AliPay Donate QR Code
                </p>
              </div>
            </div>
            <p className='text-center text-xs text-gray-500 mt-6'>
              点击任意位置关闭
            </p>
          </div>
        </div>
      )}
    </>
  );
}
