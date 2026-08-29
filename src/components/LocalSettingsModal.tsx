'use client';

import { X } from 'lucide-react';
import LanguageSelector from './LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';

interface LocalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LocalSettingsModal({ isOpen, onClose }: LocalSettingsModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <>
      {/* 全屏透明遮罩，用于点击关闭 */}
      <div 
        className="fixed inset-0 z-[9001]" 
        onClick={onClose}
      />
      
      {/* 弹窗主体 - 定位在 Header 下方 */}
      <div 
        className="fixed z-[9002] left-0 right-0 bg-white dark:bg-gray-900 shadow-2xl rounded-b-3xl border-t border-gray-100 dark:border-gray-800 animate-slide-down safe-area-inset-x"
        style={{
          // 紧贴 Header 底部 (4rem + safe-area-top)
          top: 'calc(4rem + env(safe-area-inset-top))',
          maxHeight: '70vh', // 限制高度
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-md sticky top-0 z-10">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('language')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6">
           <LanguageSelector />
           
           <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                设置将保存在应用中
              </p>
           </div>
        </div>
      </div>
    </>
  );
}
