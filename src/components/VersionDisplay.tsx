/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
'use client';

import { AlertCircle, CheckCircle, X } from 'lucide-react';
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
        <>
          {/* 遮罩 */}
          <div 
            className='fixed inset-0 z-[9001] bg-black/50 backdrop-blur-sm'
            onClick={() => setIsDonateModalOpen(false)}
          />
          
          {/* 弹窗 - 定位在 Header 下方 */}
          <div
            onClick={(e) => e.stopPropagation()}
            className='fixed z-[9002] left-0 right-0 bg-white dark:bg-zinc-800 shadow-2xl rounded-b-3xl border-t border-white/10 flex flex-col animate-slide-down safe-area-inset-x'
            style={{
              top: 'calc(4rem + env(safe-area-inset-top))',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
          >
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-zinc-800/50 sticky top-0 z-10 backdrop-blur-md">
              <h3 className='text-lg font-bold text-gray-800 dark:text-gray-200'>
                感谢支持！
              </h3>
              <button 
                onClick={() => setIsDonateModalOpen(false)}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className='p-6 md:p-8 flex flex-col items-center gap-6'>
              {/* 响应式布局：横屏左右排，竖屏上下排 */}
              <div className='flex flex-col sm:flex-row gap-6 w-full justify-center'>
                <div className='flex flex-col items-center gap-3 flex-1 min-w-[120px]'>
                  <div className="relative aspect-square w-full max-w-[180px] rounded-xl overflow-hidden shadow-lg bg-gray-100">
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
                  <div className="relative aspect-square w-full max-w-[180px] rounded-xl overflow-hidden shadow-lg bg-gray-100">
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
              <p className='text-center text-xs text-gray-400 mt-2'>
                点击空白处关闭
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}