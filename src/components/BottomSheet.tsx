'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className = '',
}: BottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // 禁用背景滚动
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300); // 等待动画结束
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  return (
    <div className='fixed inset-0 z-[10000] flex flex-col justify-end'>
      {/* 背景遮罩 */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* 弹窗内容 */}
      <div
        className={`relative z-[10001] w-full bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl transform transition-transform duration-300 ease-out flex flex-col max-h-[85vh] ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        } ${className}`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)', // 适配底部安全区
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部把手（可选，用于视觉提示可拖动） */}
        <div className='w-full flex justify-center pt-3 pb-1'>
          <div className='w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full' />
        </div>

        {/* 标题栏 */}
        <div className='flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800'>
          <h3 className='text-lg font-bold text-gray-900 dark:text-white truncate'>
            {title}
          </h3>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
          >
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>

        {/* 内容区域 (可滚动) */}
        <div className='flex-1 overflow-y-auto p-6 overflow-x-hidden'>
          {children}
        </div>
      </div>
    </div>
  );
}
