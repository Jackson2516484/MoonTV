/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { Bot, Loader2, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getLocalAISettings } from '@/lib/ai.settings';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context?: {
    title?: string;
    year?: string;
    desc?: string;
    source_name?: string;
  };
  welcomeMessage?: string;
}

const QUICK_PROMPTS = ['推荐一些高分电影', '最近有什么新电影上映？'];

export default function AIChatPanel({
  isOpen,
  onClose,
  context,
  welcomeMessage,
}: AIChatPanelProps) {
  const { t } = useLanguage();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // 初始化欢迎消息
  useEffect(() => {
    if (isOpen) {
      const welcome =
        welcomeMessage ||
        (context?.title
          ? `我正在观看《${context.title}》，可以问我关于这部电影的问题，或推荐类似影片。`
          : '你好！我是AI影视助手，可以为你推荐影片、解答剧情问题。');
      setMessages([{ role: 'assistant', content: welcome }]);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  if (!isOpen) return null;

  const handleSendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content },
    ];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setStreaming(true);

    try {
      const aiSettings = getLocalAISettings();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          context,
          history: messages
            .slice(1)
            .map((m) => ({ role: m.role, content: m.content })),
          aiSettings: aiSettings?.enabled ? aiSettings : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'AI 请求失败');
      }

      const contentType = res.headers.get('content-type') || '';
      let assistantText = '';

      if (contentType.includes('text/event-stream')) {
        // SSE 流式
        setMessages([...nextMessages, { role: 'assistant', content: '' }]);

        const reader = res.body?.getReader();
        if (!reader) throw new Error('无法读取响应流');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              if (typeof json.content === 'string') {
                assistantText = json.content;
                setMessages([
                  ...nextMessages,
                  { role: 'assistant', content: assistantText },
                ]);
              }
            } catch (err) {
              // 忽略
            }
          }
        }
      } else {
        const data = await res.json();
        assistantText = data.content || '';
        setMessages([
          ...nextMessages,
          { role: 'assistant', content: assistantText },
        ]);
      }

      if (!assistantText.trim()) {
        setMessages([
          ...nextMessages,
          { role: 'assistant', content: '（AI 没有返回内容，请重试）' },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 请求失败');
      setMessages((prev) =>
        prev.filter((m) => m.role === 'user' || m.content !== ''),
      );
    } finally {
      setStreaming(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          welcomeMessage ||
          (context?.title
            ? `我正在观看《${context.title}》，可以问我关于这部电影的问题，或推荐类似影片。`
            : '你好！我是AI影视助手，可以为你推荐影片、解答剧情问题。'),
      },
    ]);
  };

  const panel = (
    <div className='fixed inset-0 z-[12000] flex flex-col bg-white dark:bg-gray-950'>
      {/* 头部 */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800'>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center'>
            <Bot size={16} className='text-white' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-gray-900 dark:text-white'>
              {t('aiAsk')}
            </h3>
            {context?.title && (
              <p className='text-xs text-gray-500 dark:text-gray-400 truncate max-w-[60vw]'>
                {context.title}
              </p>
            )}
          </div>
        </div>
        <div className='flex items-center gap-1'>
          <button
            onClick={handleClear}
            className='p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
            title={t('cancel')}
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={onClose}
            className='p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 消息区 */}
      <div className='flex-1 overflow-y-auto px-4 py-4 space-y-4'>
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className='w-8 h-8 shrink-0 rounded-full bg-purple-500 flex items-center justify-center'>
                <Bot size={15} className='text-white' />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                message.role === 'user'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {streaming && (
          <div className='flex justify-start'>
            <div className='flex max-w-[80%] gap-3'>
              <div className='w-8 h-8 shrink-0 rounded-full bg-purple-500 flex items-center justify-center'>
                <Bot size={15} className='text-white' />
              </div>
              <div className='flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2 dark:bg-gray-800'>
                <Loader2 size={15} className='animate-spin text-gray-500' />
                <span className='text-sm text-gray-500 dark:text-gray-400'>
                  AI 正在思考...
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className='text-sm text-red-600 dark:text-red-400 text-center'>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className='border-t border-gray-200 dark:border-gray-800 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]'>
        {messages.length === 1 && !streaming && (
          <div className='flex flex-wrap gap-2 mb-3'>
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSendMessage(prompt)}
                className='rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors'
              >
                {prompt}
              </button>
            ))}
            {context?.title && (
              <button
                onClick={() =>
                  handleSendMessage(`${context.title} 讲的什么故事？`)
                }
                className='rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors'
              >
                剧情介绍
              </button>
            )}
          </div>
        )}
        <div className='flex gap-2'>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={t('aiAsk')}
            disabled={streaming}
            rows={1}
            className='flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50'
            style={{ minHeight: '48px', maxHeight: '120px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || streaming}
            className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors'
          >
            {streaming ? (
              <Loader2 size={20} className='animate-spin' />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof window !== 'undefined'
    ? createPortal(panel, document.body)
    : null;
}
