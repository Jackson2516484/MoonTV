/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { checkForUpdates, CURRENT_VERSION, UpdateStatus } from '@/lib/version';
import BottomSheet from './BottomSheet';

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

      {/* 支付/捐赠弹窗 - 使用 BottomSheet */}
      <BottomSheet
        isOpen={isDonateModalOpen}
        onClose={() => setIsDonateModalOpen(false)}
        title="感谢支持"
      >
        <div className='flex flex-col items-center gap-8 pb-8'>
          <div className='flex flex-row gap-6 w-full justify-center'>
            <div className='flex flex-col items-center gap-3 flex-1 min-w-[120px]'>
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-lg bg-gray-100 border border-gray-200">
                <Image
                  src='/wechat_donate.jpg'
                  alt='WeChat'
                  fill
                  className='object-cover'
                />
              </div>
              <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                微信支付
              </p>
            </div>
            <div className='flex flex-col items-center gap-3 flex-1 min-w-[120px]'>
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-lg bg-gray-100 border border-gray-200">
                <Image
                  src='/alipay_donate.jpg'
                  alt='AliPay'
                  fill
                  className='object-cover'
                />
              </div>
              <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                支付宝
              </p>
            </div>
          </div>
          <p className='text-center text-xs text-gray-400'>
            您的支持是我们更新的动力 ❤️
          </p>
        </div>
      </BottomSheet>
    </>
  );
}