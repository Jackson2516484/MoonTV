'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { Menu } from '@headlessui/react';
import { Globe } from 'lucide-react';

export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  const languages = [
    { code: 'zh-CN', label: '中文 (简体)' },
    { code: 'zh-TW', label: '中文 (繁體)' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
    { code: 'ar', label: 'العربية' },
    { code: 'fr', label: 'Français' },
  ] as const;

  return (
    <div className="px-4 py-3">
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
        {t('language')}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
              language === lang.code
                ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
