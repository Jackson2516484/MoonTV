/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { Loader2, Plus, Radio, Trash2, Upload, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { LiveChannel, LiveSource, parseLiveContent } from '@/lib/live';
import { castCurrentVideo } from '@/lib/cast';

import PageLayout from '@/components/PageLayout';
import { useLanguage } from '@/contexts/LanguageContext';

// 动态导入浏览器专用库
let Artplayer: any = null;
let Hls: any = null;

declare global {
  interface HTMLVideoElement {
    hls?: any;
  }
}

const CUSTOM_SOURCES_KEY = 'moontv_live_custom_sources';
const CHANNEL_CACHE_KEY = 'moontv_live_channel_cache';

function loadCustomSources(): LiveSource[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SOURCES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function saveCustomSources(sources: LiveSource[]) {
  localStorage.setItem(CUSTOM_SOURCES_KEY, JSON.stringify(sources));
}

function loadChannelCache(): Record<string, { channels: LiveChannel[]; fetchedAt: number }> {
  try {
    const raw = localStorage.getItem(CHANNEL_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function saveChannelCache(
  cache: Record<string, { channels: LiveChannel[]; fetchedAt: number }>
) {
  localStorage.setItem(CHANNEL_CACHE_KEY, JSON.stringify(cache));
}

function LivePageClient() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const artRef = useRef<HTMLDivElement | null>(null);
  const artPlayerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 直播源
  const [configSources, setConfigSources] = useState<LiveSource[]>([]);
  const [customSources, setCustomSources] = useState<LiveSource[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);

  // 当前源 / 频道
  const [currentSource, setCurrentSource] = useState<LiveSource | null>(null);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [currentChannel, setCurrentChannel] = useState<LiveChannel | null>(null);

  // 分组 / 搜索
  const [selectedGroup, setSelectedGroup] = useState<string>('全部');
  const [keyword, setKeyword] = useState('');

  // 导入
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // 播放
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  const allSources = [...configSources, ...customSources];

  // 加载播放器库 + 直播源
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('artplayer').then((mod) => {
        Artplayer = mod.default;
      });
      import('hls.js').then((mod) => {
        Hls = mod.default;
      });
      setCustomSources(loadCustomSources());
    }

    const fetchSources = async () => {
      try {
        const res = await fetch('/api/live/sources');
        if (res.ok) {
          const data = await res.json();
          setConfigSources(Array.isArray(data.data) ? data.data : []);
        }
      } catch (err) {
        console.error('获取直播源失败:', err);
      } finally {
        setSourcesLoaded(true);
      }
    };

    fetchSources();

    return () => {
      if (artPlayerRef.current) {
        artPlayerRef.current.destroy();
        artPlayerRef.current = null;
      }
    };
  }, []);

  // URL 参数自动播放
  useEffect(() => {
    if (!sourcesLoaded || allSources.length === 0) return;
    const sourceKey = searchParams.get('source');
    const channelId = searchParams.get('id');
    if (sourceKey && channelId) {
      const source = allSources.find((s) => s.key === sourceKey);
      if (source) {
        handleSourceSelect(source, channelId);
      }
    }
  }, [sourcesLoaded, configSources.length, customSources.length]);

  // 选择直播源：加载频道列表
  const handleSourceSelect = async (
    source: LiveSource,
    autoChannelId?: string
  ) => {
    setCurrentSource(source);
    setCurrentChannel(null);
    setChannels([]);
    setChannelError(null);

    // 文件导入的源已内嵌频道
    if (Array.isArray((source as any).channels) && (source as any).channels.length > 0) {
      setChannels((source as any).channels as LiveChannel[]);
      if (autoChannelId) {
        const found = (source as any).channels.find(
          (ch: LiveChannel) => ch.id === autoChannelId
        );
        if (found) handleChannelSelect(found);
      }
      return;
    }

    // URL 源：优先使用缓存
    const cache = loadChannelCache();
    const cached = cache[source.key];
    if (cached && Date.now() - cached.fetchedAt < 30 * 60 * 1000) {
      setChannels(cached.channels);
      if (autoChannelId) {
        const found = cached.channels.find((ch) => ch.id === autoChannelId);
        if (found) handleChannelSelect(found);
      }
      return;
    }

    setChannelLoading(true);
    try {
      const params = new URLSearchParams({
        url: source.url,
        source: source.key,
      });
      if (source.ua) params.set('ua', source.ua);

      const res = await fetch(`/api/live/channels?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '加载频道失败');
      }

      const nextChannels: LiveChannel[] = Array.isArray(data.channels) ? data.channels : [];
      setChannels(nextChannels);

      const nextCache = loadChannelCache();
      nextCache[source.key] = { channels: nextChannels, fetchedAt: Date.now() };
      saveChannelCache(nextCache);

      if (autoChannelId) {
        const found = nextChannels.find((ch) => ch.id === autoChannelId);
        if (found) handleChannelSelect(found);
      }
    } catch (err) {
      setChannelError(err instanceof Error ? err.message : '加载频道失败');
    } finally {
      setChannelLoading(false);
    }
  };

  // 分组列表
  const groups = ['全部', ...Array.from(new Set(channels.map((ch) => ch.group)))];

  const filteredChannels = channels.filter((ch) => {
    const groupOk = selectedGroup === '全部' || ch.group === selectedGroup;
    const keywordOk =
      !keyword || ch.name.toLowerCase().includes(keyword.toLowerCase());
    return groupOk && keywordOk;
  });

  // 选择频道播放
  const handleChannelSelect = (channel: LiveChannel) => {
    setCurrentChannel(channel);
    setPlayError(null);

    if (artPlayerRef.current) {
      artPlayerRef.current.destroy();
      artPlayerRef.current = null;
    }

    setIsVideoLoading(true);

    // 等待容器渲染
    setTimeout(() => {
      try {
        if (!Artplayer || !artRef.current) {
          setIsVideoLoading(false);
          setPlayError('播放器加载中，请稍后再试');
          return;
        }

        Artplayer.PLAYBACK_RATE = [0.5, 0.75, 1, 1.25, 1.5, 2];
        artPlayerRef.current = new Artplayer({
          container: artRef.current,
          url: channel.url,
          volume: 0.8,
          isLive: true,
          muted: false,
          autoplay: true,
          pip: true,
          autoSize: false,
          autoMini: false,
          screenshot: false,
          setting: false,
          loop: false,
          flip: false,
          playbackRate: true,
          aspectRatio: false,
          fullscreen: true,
          fullscreenWeb: true,
          mutex: true,
          playsInline: true,
          airplay: true,
          theme: '#22c55e',
          lang: 'zh-cn',
          hotkey: false,
          moreVideoAttr: {
            crossOrigin: 'anonymous',
          },
          customType: {
            m3u8: function (video: HTMLVideoElement, url: string) {
              if (!Hls) {
                console.error('HLS.js 未加载');
                return;
              }
              if (video.hls) {
                video.hls.destroy();
              }
              const hls = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: true,
                maxBufferLength: 30,
                backBufferLength: 30,
                maxBufferSize: 60 * 1000 * 1000,
              });
              hls.loadSource(url);
              hls.attachMedia(video);
              video.hls = hls;

              hls.on(Hls.Events.ERROR, function (event: any, data: any) {
                if (data.fatal) {
                  switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      hls.startLoad();
                      break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      hls.recoverMediaError();
                      break;
                    default:
                      hls.destroy();
                      break;
                  }
                }
              });
            },
          },
        });

        artPlayerRef.current.on('ready', () => {
          setIsVideoLoading(false);
        });
        artPlayerRef.current.on('error', () => {
          setIsVideoLoading(false);
          setPlayError('播放失败，请尝试其他频道');
        });
        artPlayerRef.current.on('video:error', () => {
          setIsVideoLoading(false);
          setPlayError('播放失败，请尝试其他频道');
        });
      } catch (err) {
        console.error('创建播放器失败:', err);
        setIsVideoLoading(false);
        setPlayError('播放器创建失败');
      }
    }, 50);
  };

  const handleCast = () => {
    const video = artPlayerRef.current?.video as HTMLVideoElement | undefined;
    const result = castCurrentVideo(video);
    if (!result.ok && result.message) {
      setPlayError(result.message);
    }
  };

  // 通过 URL 导入
  const handleImportByUrl = async () => {
    if (!newSourceName.trim() || !newSourceUrl.trim()) {
      setImportError('请输入名称和地址');
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      // 先验证并获取频道数
      const params = new URLSearchParams({
        url: newSourceUrl.trim(),
        source: `custom-${Date.now()}`,
      });
      const res = await fetch(`/api/live/channels?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '导入失败');
      }

      const source: LiveSource = {
        key: `custom-${Date.now()}`,
        name: newSourceName.trim(),
        url: newSourceUrl.trim(),
        from: 'custom',
        channelNumber: Array.isArray(data.channels) ? data.channels.length : 0,
      };

      const next = [...loadCustomSources(), source];
      saveCustomSources(next);
      setCustomSources(next);
      setShowAddForm(false);
      setNewSourceName('');
      setNewSourceUrl('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  // 通过文件导入（客户端解析）
  const handleFileImport = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = String(reader.result || '');
        const sourceKey = `custom-${Date.now()}`;
        const result = parseLiveContent(sourceKey, content);
        if (result.channels.length === 0) {
          setImportError('文件中没有解析到频道');
          return;
        }
        const source: LiveSource = {
          key: sourceKey,
          name: file.name.replace(/\.(m3u|m3u8|txt)$/i, '') || '文件导入',
          url: '',
          from: 'custom',
          channelNumber: result.channels.length,
          // 内嵌频道（文件导入不需要服务器）
          channels: result.channels as any,
        };
        const next = [...loadCustomSources(), source];
        saveCustomSources(next);
        setCustomSources(next);
        setShowAddForm(false);
        setImportError(null);
      } catch (err) {
        setImportError('文件解析失败');
      }
    };
    reader.onerror = () => setImportError('文件读取失败');
    reader.readAsText(file);
  };

  const handleDeleteSource = (source: LiveSource) => {
    if (source.from !== 'custom') return;
    const next = loadCustomSources().filter((s) => s.key !== source.key);
    saveCustomSources(next);
    setCustomSources(next);
    if (currentSource?.key === source.key) {
      setCurrentSource(null);
      setCurrentChannel(null);
      setChannels([]);
      if (artPlayerRef.current) {
        artPlayerRef.current.destroy();
        artPlayerRef.current = null;
      }
    }
  };

  return (
    <PageLayout activePath='/live'>
      <div className='pb-24 pt-4 px-3 sm:px-6 space-y-4'>
        {/* 标题 */}
        <div className='flex items-center justify-between px-1'>
          <h1 className='text-2xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2'>
            <Radio className='w-6 h-6 text-green-500' />
            {t('liveTitle')}
          </h1>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className='flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 transition-colors'
          >
            <Plus className='w-4 h-4' />
            {t('importM3u')}
          </button>
        </div>

        {/* 导入表单 */}
        {showAddForm && (
          <div className='rounded-xl bg-white dark:bg-gray-900 p-4 shadow ring-1 ring-gray-200/60 dark:ring-gray-800 space-y-3'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <input
                type='text'
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder={t('sourceName')}
                className='w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-green-500 focus:outline-none'
              />
              <input
                type='text'
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder={t('sourceUrl')}
                className='w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-green-500 focus:outline-none'
              />
            </div>
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              {t('m3uImportHint')}
            </p>
            <div className='flex flex-wrap items-center gap-2'>
              <button
                onClick={handleImportByUrl}
                disabled={importing}
                className='flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50'
              >
                {importing ? <Loader2 className='w-4 h-4 animate-spin' /> : <Plus className='w-4 h-4' />}
                {t('addByUrl')}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className='flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              >
                <Upload className='w-4 h-4' />
                {t('addByFile')}
              </button>
              <input
                ref={fileInputRef}
                type='file'
                accept='.m3u,.m3u8,.txt'
                className='hidden'
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileImport(file);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setImportError(null);
                }}
                className='flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              >
                <X className='w-4 h-4' />
                {t('cancel')}
              </button>
            </div>
            {importError && (
              <p className='text-sm text-red-600 dark:text-red-400'>{importError}</p>
            )}
          </div>
        )}

        {/* 直播源选择 */}
        {sourcesLoaded && (
          <div className='flex gap-2 overflow-x-auto scrollbar-hide pb-1'>
            {allSources.map((source) => {
              const active = currentSource?.key === source.key;
              return (
                <button
                  key={source.key}
                  onClick={() => handleSourceSelect(source)}
                  className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-green-600 text-white'
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {source.name}
                  {source.channelNumber ? ` (${source.channelNumber})` : ''}
                  {source.from === 'custom' && (
                    <Trash2
                      className='w-3.5 h-3.5 opacity-60 hover:opacity-100'
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSource(source);
                      }}
                    />
                  )}
                </button>
              );
            })}
            {allSources.length === 0 && (
              <p className='text-sm text-gray-500 dark:text-gray-400 py-2'>
                {t('noSources')}
              </p>
            )}
          </div>
        )}

        {/* 播放器 */}
        {(currentChannel || isVideoLoading) && (
          <div className='relative'>
            <div
              ref={artRef}
              className='w-full aspect-video bg-black rounded-xl overflow-hidden'
            />
            {isVideoLoading && (
              <div className='absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl'>
                <Loader2 className='w-8 h-8 animate-spin text-green-500' />
              </div>
            )}
            {playError && (
              <div className='absolute inset-x-0 bottom-0 bg-red-600/90 text-white text-xs px-3 py-2'>
                {playError}
              </div>
            )}
          </div>
        )}

        {/* 当前频道信息 */}
        {currentChannel && (
          <div className='flex items-center justify-between px-1'>
            <div className='flex items-center gap-2 min-w-0'>
              {currentChannel.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentChannel.logo}
                  alt={currentChannel.name}
                  className='w-8 h-8 rounded object-contain bg-gray-200 dark:bg-gray-800'
                  loading='lazy'
                />
              ) : (
                <Radio className='w-5 h-5 text-gray-400' />
              )}
              <div className='min-w-0'>
                <p className='text-sm font-medium text-gray-800 dark:text-gray-200 truncate'>
                  {currentChannel.name}
                </p>
                <p className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                  {currentSource?.name} {'>'} {currentChannel.group}
                </p>
              </div>
            </div>
            <button
              onClick={handleCast}
              className='flex-shrink-0 flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'
            >
              <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6' />
                <circle cx='2' cy='20' r='1' />
              </svg>
              {t('cast')}
            </button>
          </div>
        )}

        {/* 频道列表 */}
        <div className='rounded-xl bg-white dark:bg-gray-900 shadow ring-1 ring-gray-200/60 dark:ring-gray-800 overflow-hidden'>
          {/* 搜索 */}
          <div className='p-3 border-b border-gray-100 dark:border-gray-800'>
            <input
              type='text'
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('searchChannels')}
              className='w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-green-500 focus:outline-none'
            />
          </div>

          {/* 分组 */}
          {channels.length > 0 && (
            <div className='flex gap-2 overflow-x-auto scrollbar-hide px-3 py-2 border-b border-gray-100 dark:border-gray-800'>
              {groups.map((group) => (
                <button
                  key={group}
                  onClick={() => setSelectedGroup(group)}
                  className={`flex-shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${
                    selectedGroup === group
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          )}

          {/* 频道 */}
          <div className='max-h-[50vh] overflow-y-auto'>
            {channelLoading ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='w-6 h-6 animate-spin text-gray-400' />
              </div>
            ) : channelError ? (
              <div className='px-4 py-8 text-center text-sm text-red-600 dark:text-red-400'>
                {channelError}
              </div>
            ) : !currentSource ? (
              <div className='px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400'>
                {t('noSources')}
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className='px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400'>
                {t('noChannels')}
              </div>
            ) : (
              <ul>
                {filteredChannels.map((channel) => {
                  const active = currentChannel?.id === channel.id;
                  return (
                    <li key={channel.id}>
                      <button
                        onClick={() => handleChannelSelect(channel)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          active
                            ? 'bg-green-50 dark:bg-green-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                        }`}
                      >
                        {channel.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={channel.logo}
                            alt={channel.name}
                            className='w-9 h-9 rounded object-contain bg-gray-100 dark:bg-gray-800 flex-shrink-0'
                            loading='lazy'
                          />
                        ) : (
                          <div className='w-9 h-9 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0'>
                            <Radio className='w-4 h-4 text-gray-400' />
                          </div>
                        )}
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm text-gray-800 dark:text-gray-200 truncate'>
                            {channel.name}
                          </p>
                          <p className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                            {channel.group}
                          </p>
                        </div>
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LivePageClient />
    </Suspense>
  );
}