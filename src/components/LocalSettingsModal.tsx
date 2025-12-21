'use client';

import { X } from 'lucide-react';
import LanguageSelector from './LanguageSelector';
import { ThemeToggle } from './ThemeToggle';
import { useLanguage } from '@/contexts/LanguageContext';

interface LocalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LocalSettingsModal({ isOpen, onClose }: LocalSettingsModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in safe-area-inset"
      onClick={onClose} // 点击背景关闭
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-scale-in border border-white/20 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} // 阻止冒泡，防止点击内容关闭
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10 backdrop-blur-md">
          <h3 className="text-xl font-black text-gray-900 dark:text-white">
            本地设置
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Language */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('language')}
            </label>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-2">
               <LanguageSelector />
            </div>
          </div>

          {/* Theme */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              外观主题
            </label>
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
               <span className="text-sm font-medium dark:text-gray-200">切换模式</span>
               <ThemeToggle />
            </div>
          </div>

          {/* Note */}
          <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
            <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4 border border-green-100 dark:border-green-900/20">
              <p className="text-xs text-center text-green-700 dark:text-green-400 font-medium">
                这些设置保存在应用中
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
