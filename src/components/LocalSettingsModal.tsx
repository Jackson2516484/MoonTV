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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            本地设置
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Language */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('language')}
            </label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
               <LanguageSelector />
            </div>
          </div>

          {/* Theme */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              主题
            </label>
            <div className="flex justify-start">
               <ThemeToggle />
            </div>
          </div>

          {/* Note */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-center text-gray-400 dark:text-gray-500">
              这些设置保存在应用中
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
