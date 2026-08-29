/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

'use client';

import { Eye, EyeOff, Lock, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { useLanguage } from '@/contexts/LanguageContext';
import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

function LoginPageClient() {
  const { t } = useLanguage();
  const { siteName } = useSite();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [askUsername, setAskUsername] = useState(true);
  const [allowRegister, setAllowRegister] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const runtimeConfig = (window as any).RUNTIME_CONFIG;
      if (runtimeConfig) {
        setAskUsername(runtimeConfig.STORAGE_TYPE !== 'localstorage');
        setAllowRegister(runtimeConfig.ENABLE_REGISTER === true);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (askUsername && !username.trim()) {
      setError(t('username') + ' ' + t('password'));
      return;
    }
    if (!password) {
      setError(t('password'));
      return;
    }

    setLoading(true);
    try {
      const body = askUsername ? { username: username.trim(), password } : { password };
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || '登录失败');
      }

      window.dispatchEvent(new CustomEvent('moontv:user-changed'));
      const redirect = searchParams.get('redirect') || '/';
      router.replace(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex flex-col bg-gray-50 dark:bg-black'>
      {/* 顶部：返回 + 主题切换 */}
      <div className='flex items-center justify-between px-4 py-3'>
        <Link
          href='/'
          className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
        >
          ←
        </Link>
        <ThemeToggle />
      </div>

      <div className='flex-1 flex items-center justify-center px-4 pb-16'>
        <div className='w-full max-w-sm'>
          {/* Logo / 站点名 */}
          <div className='text-center mb-8'>
            <h1 className='text-3xl font-black text-green-600 tracking-tighter'>
              {siteName}
            </h1>
            <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>
              {t('loginTitle')}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className='space-y-4 rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl dark:shadow-none dark:ring-1 dark:ring-gray-800'
          >
            {askUsername && (
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                  {t('username')}
                </label>
                <div className='relative'>
                  <User className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                  <input
                    type='text'
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete='username'
                    className='w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20'
                    placeholder={t('username')}
                  />
                </div>
              </div>
            )}

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                {t('password')}
              </label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete='current-password'
                  className='w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-10 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20'
                  placeholder={t('password')}
                />
                <button
                  type='button'
                  onClick={() => setShowPassword((v) => !v)}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                </button>
              </div>
            </div>

            {error && (
              <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
            )}

            <button
              type='submit'
              disabled={!password || loading || (askUsername && !username)}
              className='w-full rounded-lg bg-green-600 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50'
            >
              {loading ? '...' : t('login')}
            </button>

            {allowRegister && (
              <div className='text-center'>
                <Link
                  href='/register'
                  className='text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors'
                >
                  {t('noAccount')}
                </Link>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageClient />
    </Suspense>
  );
}