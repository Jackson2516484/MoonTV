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
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in safe-area-inset"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-scale-in border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-md">
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

        {/* Content */}
        <div className="p-6">
           <LanguageSelector />
           
           <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                设置将保存在应用中
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
