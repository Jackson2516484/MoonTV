/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

'use client';

import { Eye, EyeOff, Lock, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { useLanguage } from '@/contexts/LanguageContext';
import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

function RegisterPageClient() {
  const { t } = useLanguage();
  const { siteName } = useSite();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const runtimeConfig = (window as any).RUNTIME_CONFIG;
      if (runtimeConfig && runtimeConfig.STORAGE_TYPE === 'localstorage') {
        setError(t('aiNotEnabled'));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError(t('username'));
      return;
    }
    if (!password) {
      setError(t('password'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('confirmPassword'));
      return;
    }
    if (password.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || '注册失败');
      }

      window.dispatchEvent(new CustomEvent('moontv:user-changed'));
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex flex-col bg-gray-50 dark:bg-black'>
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
          <div className='text-center mb-8'>
            <h1 className='text-3xl font-black text-green-600 tracking-tighter'>
              {siteName}
            </h1>
            <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>
              {t('registerTitle')}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className='space-y-4 rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl dark:shadow-none dark:ring-1 dark:ring-gray-800'
          >
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
                  autoComplete='new-password'
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

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                {t('confirmPassword')}
              </label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete='new-password'
                  className='w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20'
                  placeholder={t('confirmPassword')}
                />
              </div>
            </div>

            {error && (
              <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
            )}

            <button
              type='submit'
              disabled={!username || !password || !confirmPassword || loading}
              className='w-full rounded-lg bg-green-600 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50'
            >
              {loading ? '...' : t('register')}
            </button>

            <div className='text-center'>
              <Link
                href='/login'
                className='text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors'
              >
                {t('haveAccount')}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterPageClient />
    </Suspense>
  );
}