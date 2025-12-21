'use client';

import LanguageSelector from './LanguageSelector';
import { ThemeToggle } from './ThemeToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomSheet from './BottomSheet';

interface LocalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LocalSettingsModal({ isOpen, onClose }: LocalSettingsModalProps) {
  const { t } = useLanguage();

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="本地设置"
    >
      <div className="space-y-8 pb-6">
        {/* Language */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
            {t('language')}
          </label>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-2">
             <LanguageSelector />
          </div>
        </div>

        {/* Theme */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
            外观主题
          </label>
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
             <span className="text-sm font-medium text-gray-900 dark:text-gray-200">切换模式</span>
             <ThemeToggle />
          </div>
        </div>

        {/* Note */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4 border border-green-100 dark:border-green-900/20">
            <p className="text-xs text-center text-green-700 dark:text-green-400 font-medium">
              这些设置保存在应用中
            </p>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
