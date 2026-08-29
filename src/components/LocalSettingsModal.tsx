'use client';

import { Bot, Check, Eraser, KeyRound, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  AI_PROVIDERS,
  clearLocalAISettings,
  getLocalAISettings,
  LocalAISettings,
  saveLocalAISettings,
} from '@/lib/ai.settings';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSelector from './LanguageSelector';

interface LocalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LocalSettingsModal({
  isOpen,
  onClose,
}: LocalSettingsModalProps) {
  const { t } = useLanguage();

  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState('custom');
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [model, setModel] = useState('');
  const [tip, setTip] = useState<string | null>(null);

  // 打开弹窗时加载本地保存的 AI 设置
  useEffect(() => {
    if (!isOpen) return;
    const settings = getLocalAISettings();
    if (settings) {
      setEnabled(settings.enabled);
      setProvider(settings.provider);
      setApiKey(settings.apiKey);
      setBaseURL(settings.baseURL);
      setModel(settings.model);
    } else {
      setEnabled(false);
      setProvider('custom');
      setApiKey('');
      setBaseURL('');
      setModel('');
    }
    setTip(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const applyProviderPreset = (key: string) => {
    setProvider(key);
    const preset = AI_PROVIDERS.find((p) => p.key === key);
    if (preset && preset.baseURL) {
      setBaseURL(preset.baseURL);
      if (preset.model) setModel(preset.model);
    }
  };

  const handleSave = () => {
    if (!apiKey.trim() || !baseURL.trim() || !model.trim()) {
      setTip(t('aiNeedAllFields'));
      return;
    }
    const settings: LocalAISettings = {
      enabled,
      provider,
      apiKey: apiKey.trim(),
      baseURL: baseURL.trim().replace(/\/+$/, ''),
      model: model.trim(),
    };
    saveLocalAISettings(settings);
    setTip(t('aiSaved'));
  };

  const handleClear = () => {
    clearLocalAISettings();
    setEnabled(false);
    setProvider('custom');
    setApiKey('');
    setBaseURL('');
    setModel('');
    setTip(t('aiCleared'));
  };

  const inputCls =
    'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-green-500 focus:outline-none';

  return (
    <>
      {/* 全屏透明遮罩，用于点击关闭 */}
      <div className='fixed inset-0 z-[9001]' onClick={onClose} />

      {/* 弹窗主体 - 定位在 Header 下方 */}
      <div
        className='fixed z-[9002] left-0 right-0 bg-white dark:bg-gray-900 shadow-2xl rounded-b-3xl border-t border-gray-100 dark:border-gray-800 animate-slide-down safe-area-inset-x'
        style={{
          // 紧贴 Header 底部 (4rem + safe-area-top)
          top: 'calc(4rem + env(safe-area-inset-top))',
          maxHeight: '78vh', // 限制高度
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-md sticky top-0 z-10'>
          <h3 className='text-lg font-bold text-gray-900 dark:text-white'>
            {t('language')}
          </h3>
          <button
            onClick={onClose}
            className='p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'
          >
            <X className='w-5 h-5 text-gray-500 dark:text-gray-400' />
          </button>
        </div>

        <div className='p-6 space-y-6'>
          {/* 语言设置 */}
          <div>
            <LanguageSelector />
          </div>

          {/* AI 设置 */}
          <div className='pt-5 border-t border-gray-100 dark:border-gray-800'>
            <div className='flex items-center justify-between px-4 pt-1 pb-3'>
              <div className='flex items-center gap-2'>
                <Bot className='w-5 h-5 text-purple-500' />
                <span className='text-base font-semibold text-gray-800 dark:text-gray-200'>
                  {t('aiSettings')}
                </span>
              </div>
              {/* 启用开关 */}
              <button
                onClick={() => setEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'
                }`}
                role='switch'
                aria-checked={enabled}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className='rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 space-y-3'>
              {/* 供应商 */}
              <div>
                <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1.5'>
                  {t('aiProvider')}
                </label>
                <div className='grid grid-cols-3 gap-2'>
                  {AI_PROVIDERS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => applyProviderPreset(p.key)}
                      className={`px-2 py-1.5 text-xs rounded-lg border transition-colors truncate ${
                        provider === p.key
                          ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* API 地址 */}
              <div>
                <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1.5'>
                  {t('aiApiUrl')}
                </label>
                <input
                  type='text'
                  value={baseURL}
                  onChange={(e) => setBaseURL(e.target.value)}
                  placeholder='https://api.openai.com/v1'
                  className={inputCls}
                />
              </div>

              {/* 模型 */}
              <div>
                <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1.5'>
                  {t('aiModelLabel')}
                </label>
                <input
                  type='text'
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder='gpt-4o-mini'
                  className={inputCls}
                />
              </div>

              {/* API Key */}
              <div>
                <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1.5'>
                  {t('aiApiKey')}
                </label>
                <div className='relative'>
                  <KeyRound className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                  <input
                    type='password'
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder='sk-...'
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className='flex items-center gap-2 pt-1'>
                <button
                  onClick={handleSave}
                  className='flex items-center gap-1.5 rounded-lg bg-purple-500 px-4 py-2 text-sm text-white hover:bg-purple-600 transition-colors'
                >
                  <Save className='w-4 h-4' />
                  {t('aiSave')}
                </button>
                <button
                  onClick={handleClear}
                  className='flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                >
                  <Eraser className='w-4 h-4' />
                  {t('aiClear')}
                </button>
              </div>

              {tip && (
                <p className='flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400'>
                  <Check className='w-3.5 h-3.5' />
                  {tip}
                </p>
              )}
              <p className='text-xs text-gray-400 dark:text-gray-500 leading-relaxed'>
                {t('aiSettingsHint')}
              </p>
            </div>
          </div>

          <div className='pt-4 border-t border-gray-100 dark:border-gray-800'>
            <p className='text-xs text-center text-gray-400 dark:text-gray-500'>
              {t('settingsSavedLocal')}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
