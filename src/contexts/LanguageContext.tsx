'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, translations } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string; // 扩展为 string 以支持动态映射
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 扩展翻译字典映射（针对 API 返回的动态字段）
const dynamicMappings: Record<Language, Record<string, string>> = {
  'zh-CN': {},
  'zh-TW': {
    '动作片': '動作片',
    '喜剧片': '喜劇片',
    '爱情片': '愛情片',
    '科幻片': '科幻片',
    '恐怖片': '恐怖片',
    '剧情片': '劇情片',
    '战争片': '戰爭片',
    '记录片': '紀錄片',
    '动画片': '動畫片',
    '换源': '換源',
    '选集': '選集',
    '正在搜索播放源...': '正在搜索播放源...',
  },
  'en': {
    '动作片': 'Action',
    '喜剧片': 'Comedy',
    '爱情片': 'Romance',
    '科幻片': 'Sci-Fi',
    '恐怖片': 'Horror',
    '剧情片': 'Drama',
    '战争片': 'War',
    '记录片': 'Documentary',
    '动画片': 'Animation',
    '换源': 'Sources',
    '选集': 'Episodes',
    '正在搜索播放源...': 'Searching sources...',
  },
  'ja': {
    '动作片': 'アクション',
    '喜剧片': 'コメディ',
    '爱情片': 'ロマンス',
    '科幻片': 'SF',
    '恐怖片': 'ホラー',
    '剧情片': 'ドラマ',
    '战争片': '戦争',
    '记录片': 'ドキュメンタリー',
    '动画片': 'アニメ',
    '换源': 'ソース切り替え',
    '选集': 'エピソード',
  },
  'ar': {
    '动作片': 'أكشن',
    '喜剧片': 'كوميدي',
    '爱情片': 'رومانسي',
    '科幻片': 'خيال علمي',
    '剧情片': 'دراما',
    '动画片': 'أنمي',
    '换源': 'تغيير المصدر',
    '选集': 'الحلقات',
  },
  'fr': {
    '动作片': 'Action',
    '喜剧片': 'Comédie',
    '爱情片': 'Romance',
    '科幻片': 'Sci-Fi',
    '剧情片': 'Drame',
    '动画片': 'Animation',
    '换源': 'Changer de source',
    '选集': 'Épisodes',
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('zh-CN');

  useEffect(() => {
    const savedLang = localStorage.getItem('app_language') as Language;
    if (savedLang && translations[savedLang]) {
      setLanguage(savedLang);
    }
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('app_language', lang);
    if (lang === 'ar') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  };

  const t = (key: string) => {
    // 1. 尝试从静态字典查找
    const staticResult = (translations[language] as any)[key];
    if (staticResult) return staticResult;

    // 2. 尝试从动态映射查找 (用于 API 字段)
    const dynamicResult = dynamicMappings[language][key];
    if (dynamicResult) return dynamicResult;

    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}