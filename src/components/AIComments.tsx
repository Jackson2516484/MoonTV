/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

'use client';

import { Bot, RefreshCw, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/contexts/LanguageContext';

interface AIComment {
  id: string;
  userName: string;
  userAvatar: string;
  rating: number | null;
  content: string;
  time: string;
  votes: number;
  isAiGenerated: true;
}

interface AICommentsProps {
  movieName: string;
  movieInfo?: string;
}

export default function AIComments({ movieName, movieInfo }: AICommentsProps) {
  const { t } = useLanguage();
  const [comments, setComments] = useState<AIComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStartedLoading, setHasStartedLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        name: movieName,
        count: '10',
        _t: Date.now().toString(),
      });
      if (movieInfo) params.append('info', movieInfo);

      const response = await fetch(`/api/ai-comments?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '生成AI评论失败');
      }

      const data = await response.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成AI评论失败');
    } finally {
      setLoading(false);
    }
  }, [movieName, movieInfo]);

  useEffect(() => {
    setHasStartedLoading(false);
    setComments([]);
    setLoading(false);
    setError(null);
  }, [movieName]);

  const startLoading = () => {
    setHasStartedLoading(true);
    fetchComments();
  };

  const renderStars = (rating: number | null) => {
    if (rating === null) return null;
    return (
      <div className='flex items-center gap-0.5'>
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className='w-4 h-4'
            fill={star <= rating ? '#3b82f6' : '#e0e0e0'}
            viewBox='0 0 24 24'
          >
            <path d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z' />
          </svg>
        ))}
      </div>
    );
  };

  if (!hasStartedLoading) {
    return (
      <div className='flex flex-col items-center justify-center py-10'>
        <Sparkles className='w-12 h-12 mx-auto mb-3 text-blue-400 opacity-70' />
        <p className='text-center text-gray-600 dark:text-gray-400'>
          {t('generateComments')}
        </p>
        <p className='text-xs text-center mt-1.5 text-gray-400 dark:text-gray-500'>
          基于影片信息和网络资料生成
        </p>
        <button
          onClick={startLoading}
          className='mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2'
        >
          <Bot className='w-4 h-4' />
          {t('generateComments')}
        </button>
      </div>
    );
  }

  if (loading && comments.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-10'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3'></div>
        <span className='text-gray-600 dark:text-gray-400'>
          AI 正在生成评论...
        </span>
        <span className='text-xs text-gray-500 mt-1.5'>这可能需要几秒钟</span>
      </div>
    );
  }

  if (error && comments.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-10'>
        <div className='text-3xl mb-2'>😕</div>
        <p className='text-gray-600 dark:text-gray-400 mb-1'>{error}</p>
        <button
          onClick={startLoading}
          className='mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'
        >
          {t('cancel')} / 重试
        </button>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='text-sm text-gray-600 dark:text-gray-400'>
          已生成 {comments.length} 条AI评论
        </div>
        <button
          onClick={fetchComments}
          disabled={loading}
          className='text-sm px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1'
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '生成中...' : '重新生成'}
        </button>
      </div>

      <div className='space-y-4'>
        {comments.map((comment) => (
          <div
            key={comment.id}
            className='bg-blue-50/50 dark:bg-blue-900/10 rounded-lg p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border border-blue-100 dark:border-blue-900/30'
          >
            <div className='flex items-start gap-3 mb-3'>
              <div className='flex-shrink-0'>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={comment.userAvatar}
                  alt={comment.userName}
                  className='w-10 h-10 rounded-full'
                />
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <span className='font-medium text-gray-900 dark:text-white'>
                    {comment.userName}
                  </span>
                  {renderStars(comment.rating)}
                  <span className='inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs rounded-full'>
                    <Bot className='w-3 h-3' />
                    AI生成
                  </span>
                </div>
                <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  {comment.time}
                </div>
              </div>
              {comment.votes > 0 && (
                <div className='flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400'>
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5'
                    />
                  </svg>
                  <span>{comment.votes}</span>
                </div>
              )}
            </div>
            <div className='text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap'>
              {comment.content}
            </div>
          </div>
        ))}
      </div>

      <div className='text-center text-xs text-gray-500 dark:text-gray-400 py-2 border-t border-gray-200 dark:border-gray-700'>
        以上评论由AI基于影片信息和网络资料生成，仅供参考
      </div>
    </div>
  );
}