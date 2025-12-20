/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console, @next/next/no-img-element */

'use client';

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { Media } from '@capacitor-community/media';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { Film, Heart } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import {
  deleteFavorite,
  deletePlayRecord,
  deleteSkipConfig,
  generateStorageKey,
  getAllPlayRecords,
  getSkipConfig,
  isFavorited,
  saveFavorite,
  savePlayRecord,
  saveSkipConfig,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8, processImageUrl } from '@/lib/utils';

import EpisodeSelector from '@/components/EpisodeSelector';
import PageLayout from '@/components/PageLayout';

// Removed global declaration to avoid conflicts
// Use type assertion (video as any).remote instead

const DEMO_4K_SOURCES: SearchResult[] = [
  {
    id: 'cctv-4k-live',
    title: 'CCTV-4K 超高清直播',
    source: 'public_iptv_cn',
    source_name: '央视4K',
    poster: 'https://upload.wikimedia.org/wikipedia/zh/0/08/CCTV-4K_Ultra_HD_Channel_logo.svg',
    year: 'Live',
    episodes: ['http://39.134.115.163:8080/PLTV/88888888/224/3221225618/index.m3u8'],
    type_name: '4K直播',
    class: 'Live',
    desc: 'CCTV-4K 超高清频道 (国内直连)'
  },
  {
    id: 'bj-4k-live',
    title: '北京卫视 4K',
    source: 'public_iptv_cn',
    source_name: '卫视4K',
    poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/BTV_Beijing_Satellite_TV_Logo.svg/1200px-BTV_Beijing_Satellite_TV_Logo.svg.png',
    year: 'Live',
    episodes: ['http://39.135.138.60:18890/PLTV/88888888/224/3221225624/index.m3u8'],
    type_name: '4K直播',
    class: 'Live',
    desc: '北京卫视 4K 超高清频道'
  },
  {
    id: 'doc-4k-china',
    title: '4K演示片 - 烤鸭',
    source: 'demo_cn',
    source_name: '演示片',
    poster: 'https://img9.doubanio.com/view/photo/l/public/p2508892695.jpg',
    year: '2020',
    episodes: ['http://clips.vorwaerts-gmbh.de/big_buck_bunny.mp4'], // 替换为国内可访问的测试源，暂用 BBB 占位，建议替换为自建 NAS 或 OSS 地址
    type_name: '演示',
    class: 'Demo',
    desc: '4K 超高清演示片段'
  }
];

function PlayPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<'searching' | 'preferring' | 'fetching' | 'ready'>('searching');
  const [loadingMessage, setLoadingMessage] = useState('正在搜索播放源...');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SearchResult | null>(null);
  const [favorited, setFavorited] = useState(false);
  
  const [backgroundPlay, setBackgroundPlay] = useState(true);
  const backgroundPlayRef = useRef(backgroundPlay);
  
  const [screenLocked, setScreenLocked] = useState(false);

  const [skipConfig, setSkipConfig] = useState({
    enable: false,
    intro_time: 0,
    outro_time: 0,
  });
  
  const skipConfigRef = useRef(skipConfig);
  
  const [downloadInfo, setDownloadInfo] = useState({ href: '', disabled: false, filename: '' });
  const [downloadProgress, setDownloadProgress] = useState<string>('');

  const lastSkipCheckRef = useRef(0);
  const [blockAdEnabled, setBlockAdEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('enable_blockad');
      if (v !== null) return v === 'true';
    }
    return true;
  });
  const blockAdEnabledRef = useRef(blockAdEnabled);

  const [videoTitle, setVideoTitle] = useState(searchParams.get('title') || '');
  const [videoYear, setVideoYear] = useState(searchParams.get('year') || '');
  const [videoCover, setVideoCover] = useState('');
  const [currentSource, setCurrentSource] = useState(searchParams.get('source') || '');
  const [currentId, setCurrentId] = useState(searchParams.get('id') || '');
  const [searchTitle] = useState(searchParams.get('stitle') || '');
  const [searchType] = useState(searchParams.get('stype') || '');
  const [needPrefer, setNeedPrefer] = useState(searchParams.get('prefer') === 'true');
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);

  const currentSourceRef = useRef(currentSource);
  const currentIdRef = useRef(currentId);
  const videoTitleRef = useRef(videoTitle);
  const videoYearRef = useRef(videoYear);
  const detailRef = useRef<SearchResult | null>(detail);
  const currentEpisodeIndexRef = useRef(currentEpisodeIndex);
  const needPreferRef = useRef(needPrefer);

  const [videoUrl, setVideoUrl] = useState('');
  const totalEpisodes = detail?.episodes?.length || 0;
  const resumeTimeRef = useRef<number | null>(null);
  const lastVolumeRef = useRef<number>(0.7);
  const lastPlaybackRateRef = useRef<number>(1.0);

  const [availableSources, setAvailableSources] = useState<SearchResult[]>([]);
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [sourceSearchError, setSourceSearchError] = useState<string | null>(null);
  const [optimizationEnabled] = useState<boolean>(true);
  const [precomputedVideoInfo, setPrecomputedVideoInfo] = useState<Map<string, any>>(new Map());
  const [isEpisodeSelectorCollapsed, setIsEpisodeSelectorCollapsed] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoLoadingStage, setVideoLoadingStage] = useState<'initing' | 'sourceChanging'>('initing');
  
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const artPlayerRef = useRef<any>(null);
  const artRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    skipConfigRef.current = skipConfig;
  }, [skipConfig]);

  useEffect(() => {
    if (Capacitor.isNativePlatform() && videoTitle && currentSource) {
      Media.init({
        title: videoTitle,
        artist: currentSource,
        album: videoYear,
        artwork: videoCover
      }).catch(e => console.error('Media Session Init Failed', e));
    }
    
    return () => { 
        if (Capacitor.isNativePlatform()) {
            Media.release().catch(() => {}); 
        }
    };
  }, [videoTitle, currentSource, videoYear, videoCover]);

  useEffect(() => {
    backgroundPlayRef.current = backgroundPlay;
  }, [backgroundPlay]);

  useEffect(() => {
    blockAdEnabledRef.current = blockAdEnabled;
  }, [blockAdEnabled]);

  useEffect(() => {
    needPreferRef.current = needPrefer;
  }, [needPrefer]);

  useEffect(() => {
    currentSourceRef.current = currentSource;
    currentIdRef.current = currentId;
    detailRef.current = detail;
    currentEpisodeIndexRef.current = currentEpisodeIndex;
    videoTitleRef.current = videoTitle;
    videoYearRef.current = videoYear;
  }, [currentSource, currentId, detail, currentEpisodeIndex, videoTitle, videoYear]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      ScreenOrientation.unlock();
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    }
  }, []);

  const calculateSourceScore = (testResult: any, maxSpeed: number, minPing: number, maxPing: number) => {
    let score = 0;
    const qualityScore = (() => {
      switch (testResult.quality) {
        case '4K': return 100;
        case '2K': return 85;
        case '1080p': return 75;
        case '720p': return 60;
        case '480p': return 40;
        case 'SD': return 20;
        default: return 0;
      }
    })();
    score += qualityScore * 0.4;
    
    const speedScore = (() => {
       const speedStr = testResult.loadSpeed;
       if (speedStr === '未知' || speedStr === '测量中...') return 30;
       const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
       if (!match) return 30;
       const value = parseFloat(match[1]);
       const unit = match[2];
       const speedKBps = unit === 'MB/s' ? value * 1024 : value;
       const speedRatio = speedKBps / maxSpeed;
       return Math.min(100, Math.max(0, speedRatio * 100));
    })();
    score += speedScore * 0.4;

    const pingScore = (() => {
       const ping = testResult.pingTime;
       if (ping <= 0) return 0;
       if (maxPing === minPing) return 100;
       const pingRatio = (maxPing - ping) / (maxPing - minPing);
       return Math.min(100, Math.max(0, pingRatio * 100));
    })();
    score += pingScore * 0.2;
    return Math.round(score * 100) / 100;
  };

  const preferBestSource = async (sources: SearchResult[]): Promise<SearchResult> => {
    if (sources.length === 1) return sources[0];
    const batchSize = Math.ceil(sources.length / 2);
    const allResults: any[] = [];

    for (let start = 0; start < sources.length; start += batchSize) {
      const batchSources = sources.slice(start, start + batchSize);
      const batchResults = await Promise.all(
        batchSources.map(async (source) => {
          try {
            if (!source.episodes || source.episodes.length === 0) return null;
            const episodeUrl = source.episodes.length > 1 ? source.episodes[1] : source.episodes[0];
            const testResult = await getVideoResolutionFromM3u8(episodeUrl);
            return { source, testResult };
          } catch (error) { return null; }
        })
      );
      allResults.push(...batchResults);
    }

    const newVideoInfoMap = new Map();
    allResults.forEach((result, index) => {
        if (result) newVideoInfoMap.set(`${sources[index].source}-${sources[index].id}`, result.testResult);
    });
    setPrecomputedVideoInfo(newVideoInfoMap);
    const successfulResults = allResults.filter(Boolean);

    if (successfulResults.length === 0) return sources[0];

    const validSpeeds = successfulResults.map((r: any) => {
        const match = r.testResult.loadSpeed.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
        return match ? (match[2] === 'MB/s' ? parseFloat(match[1]) * 1024 : parseFloat(match[1])) : 0;
    }).filter(s => s > 0);
    const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024;

    const validPings = successfulResults.map((r: any) => r.testResult.pingTime).filter(p => p > 0);
    const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
    const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

    const resultsWithScore = successfulResults.map((result: any) => ({
      ...result,
      score: calculateSourceScore(result.testResult, maxSpeed, minPing, maxPing),
    }));
    resultsWithScore.sort((a: any, b: any) => b.score - a.score);
    return resultsWithScore[0].source;
  };

  const updateVideoUrl = (detailData: SearchResult | null, episodeIndex: number) => {
    if (!detailData || !detailData.episodes || episodeIndex >= detailData.episodes.length) {
      setVideoUrl(''); return;
    }
    const newUrl = detailData?.episodes[episodeIndex] || '';
    if (newUrl !== videoUrl) setVideoUrl(newUrl);
  };

  const ensureVideoSource = (video: HTMLVideoElement | null, url: string) => {
    if (!video || !url) return;
    const sources = Array.from(video.getElementsByTagName('source'));
    if (!sources.some((s) => s.src === url)) {
      sources.forEach((s) => s.remove());
      const sourceEl = document.createElement('source');
      sourceEl.src = url;
      video.appendChild(sourceEl);
    }
    (video as any).disableRemotePlayback = false;
    if (video.hasAttribute('disableRemotePlayback')) video.removeAttribute('disableRemotePlayback');
  };

  function filterAdsFromM3U8(m3u8Content: string): string {
    if (!m3u8Content) return '';
    const lines = m3u8Content.split('\n');
    return lines.filter(line => !line.includes('#EXT-X-DISCONTINUITY')).join('\n');
  }

  const handleSkipConfigChange = async (newConfig: { enable: boolean; intro_time: number; outro_time: number }) => {
    if (!currentSourceRef.current || !currentIdRef.current) return;
    try {
      setSkipConfig(newConfig);
      if (!newConfig.enable && !newConfig.intro_time && !newConfig.outro_time) {
        await deleteSkipConfig(currentSourceRef.current, currentIdRef.current);
        artPlayerRef.current?.setting.update({
             name: '跳过片头片尾',
             switch: false,
        });
      } else {
        await saveSkipConfig(currentSourceRef.current, currentIdRef.current, newConfig);
      }
    } catch (err) { console.error(err); }
  };

  const formatTime = (seconds: number): string => {
    if (seconds === 0) return '00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.round(seconds % 60);
    if (hours === 0) return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
    constructor(config: any) {
      super(config);
      const load = this.load.bind(this);
      this.load = function (context: any, config: any, callbacks: any) {
        if ((context as any).type === 'manifest' || (context as any).type === 'level') {
          const onSuccess = callbacks.onSuccess;
          callbacks.onSuccess = function (response: any, stats: any, context: any) {
            if (response.data && typeof response.data === 'string') {
              response.data = filterAdsFromM3U8(response.data);
            }
            return onSuccess(response, stats, context, null);
          };
        }
        load(context, config, callbacks);
      };
    }
  }

  useEffect(() => {
    updateVideoUrl(detail, currentEpisodeIndex);
  }, [detail, currentEpisodeIndex]);

  useEffect(() => {
    const localPath = searchParams.get('path');
    if (localPath) {
        setVideoUrl(Capacitor.convertFileSrc(localPath));
        setVideoTitle(searchParams.get('title') || '本地视频');
        setLoading(false);
        setLoadingStage('ready');
        setDetail({
            id: 'local',
            title: searchParams.get('title') || '本地视频',
            episodes: [Capacitor.convertFileSrc(localPath)],
            source: 'local',
            year: '',
            poster: '',
            desc: '本地视频文件',
            type_name: '本地',
            class: '本地'
        } as any);
        return;
    }

    const fetchSourceDetail = async (source: string, id: string): Promise<SearchResult[]> => {
      if (source === '4k_demo') {
        const demo = DEMO_4K_SOURCES.find(s => s.id === id);
        return demo ? [demo] : [];
      }
      try {
        const res = await fetch(`https://moon.wangzhiwei05.dpdns.org/api/detail?source=${source}&id=${id}`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        return [data];
      } catch (e) { return []; }
    };

    const fetchSourcesData = async (query: string): Promise<SearchResult[]> => {
      try {
        const res = await fetch(`https://moon.wangzhiwei05.dpdns.org/api/search?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        let results = data.results.filter((r: any) => 
             r.title.replaceAll(' ','').toLowerCase() === videoTitleRef.current.replaceAll(' ','').toLowerCase()
        );
        results = [...results, ...DEMO_4K_SOURCES];
        setAvailableSources(results);
        return results;
      } catch (e) { 
          setSourceSearchError('搜索失败'); 
          setAvailableSources(DEMO_4K_SOURCES); // Fallback to demos on error
          return DEMO_4K_SOURCES; 
      }
    };

    const initAll = async () => {
      if (!currentSource && !currentId && !videoTitle && !searchTitle) {
        setError('缺少必要参数'); setLoading(false); return;
      }
      setLoading(true); setLoadingStage(currentSource && currentId ? 'fetching' : 'searching');
      setLoadingMessage(currentSource && currentId ? '🎬 正在获取视频详情...' : '🔍 正在搜索播放源...');

      let sourcesInfo = await fetchSourcesData(searchTitle || videoTitle);
      if (currentSource && currentId && !sourcesInfo.some(s => s.source === currentSource && s.id === currentId)) {
         const detail = await fetchSourceDetail(currentSource, currentId);
         if (detail.length > 0) sourcesInfo = [...sourcesInfo, ...detail];
      }
      if (sourcesInfo.length === 0) { setError('未找到匹配结果'); setLoading(false); return; }

      let detailData = sourcesInfo[0];
      if (currentSource && currentId && !needPreferRef.current) {
        const target = sourcesInfo.find(s => s.source === currentSource && s.id === currentId);
        if (target) detailData = target;
      }

      if ((!currentSource || !currentId || needPreferRef.current) && optimizationEnabled) {
        setLoadingStage('preferring'); setLoadingMessage('⚡ 正在优选最佳播放源...');
        detailData = await preferBestSource(sourcesInfo);
      }

      setNeedPrefer(false); setCurrentSource(detailData.source); setCurrentId(detailData.id);
      setVideoYear(detailData.year); setVideoTitle(detailData.title || videoTitleRef.current);
      setVideoCover(detailData.poster); setDetail(detailData);
      if (currentEpisodeIndex >= detailData.episodes.length) setCurrentEpisodeIndex(0);

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', detailData.source);
      newUrl.searchParams.set('id', detailData.id);
      window.history.replaceState({}, '', newUrl.toString());

      setLoadingStage('ready'); setLoadingMessage('✨ 准备就绪...');
      setTimeout(() => setLoading(false), 1000);
    };

    initAll();
  }, []);

  const saveCurrentPlayProgress = async () => {
    if (!artPlayerRef.current || !currentSourceRef.current || !currentIdRef.current) return;
    const player = artPlayerRef.current;
    if (player.currentTime < 1) return;
    try {
      await savePlayRecord(currentSourceRef.current, currentIdRef.current, {
        title: videoTitleRef.current,
        source_name: detailRef.current?.source_name || '',
        year: detailRef.current?.year || '',
        cover: detailRef.current?.poster || '',
        index: currentEpisodeIndexRef.current + 1,
        total_episodes: detailRef.current?.episodes.length || 1,
        play_time: Math.floor(player.currentTime),
        total_time: Math.floor(player.duration),
        save_time: Date.now(),
        search_title: searchTitle,
      });
      lastSaveTimeRef.current = Date.now();
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const initFromHistory = async () => {
      if (!currentSource || !currentId) return;
      try {
        const allRecords = await getAllPlayRecords();
        const key = generateStorageKey(currentSource, currentId);
        const record = allRecords[key];
        if (record) {
          if (record.index - 1 !== currentEpisodeIndex) setCurrentEpisodeIndex(record.index - 1);
          resumeTimeRef.current = record.play_time;
        }
      } catch (err) { console.error(err); }
    };
    initFromHistory();
  }, []);

  useEffect(() => {
    const initSkipConfig = async () => {
      if (!currentSource || !currentId) return;
      try {
        const config = await getSkipConfig(currentSource, currentId);
        if (config) setSkipConfig(config);
      } catch (err) { console.error(err); }
    };
    initSkipConfig();
  }, []);

  const handleSourceChange = async (newSource: string, newId: string, newTitle: string) => {
    setIsVideoLoading(true); setVideoLoadingStage('sourceChanging');
    if (currentSourceRef.current && currentIdRef.current) {
        try { await deletePlayRecord(currentSourceRef.current, currentIdRef.current); } catch(e){}
    }
    const newDetail = availableSources.find(s => s.source === newSource && s.id === newId);
    if (!newDetail) { setError('未找到匹配结果'); return; }
    
    let targetIndex = currentEpisodeIndex;
    if (!newDetail.episodes || targetIndex >= newDetail.episodes.length) targetIndex = 0;
    
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('source', newSource);
    newUrl.searchParams.set('id', newId);
    window.history.replaceState({}, '', newUrl.toString());

    setVideoTitle(newDetail.title || newTitle); setVideoYear(newDetail.year);
    setVideoCover(newDetail.poster); setCurrentSource(newSource);
    setCurrentId(newId); setDetail(newDetail); setCurrentEpisodeIndex(targetIndex);
    setIsVideoLoading(false);
  };

  const handlePreviousEpisode = () => {
    if (detailRef.current && currentEpisodeIndexRef.current > 0) {
      if (artPlayerRef.current && !artPlayerRef.current.paused) saveCurrentPlayProgress();
      setCurrentEpisodeIndex(currentEpisodeIndexRef.current - 1);
    }
  };

  const handleNextEpisode = () => {
    if (detailRef.current && currentEpisodeIndexRef.current < detailRef.current.episodes.length - 1) {
      if (artPlayerRef.current && !artPlayerRef.current.paused) saveCurrentPlayProgress();
      setCurrentEpisodeIndex(currentEpisodeIndexRef.current + 1);
    }
  };

  // 快捷键处理函数
  const handleKeyboardShortcuts = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

    if (e.altKey && e.key === 'ArrowLeft') {
       handlePreviousEpisode(); e.preventDefault();
    }
    if (e.altKey && e.key === 'ArrowRight') {
       handleNextEpisode(); e.preventDefault();
    }
    if (!e.altKey && e.key === 'ArrowLeft') {
       if (artPlayerRef.current) artPlayerRef.current.currentTime -= 10;
       e.preventDefault();
    }
    if (!e.altKey && e.key === 'ArrowRight') {
       if (artPlayerRef.current) artPlayerRef.current.currentTime += 10;
       e.preventDefault();
    }
    if (e.key === ' ') {
       if (artPlayerRef.current) artPlayerRef.current.toggle();
       e.preventDefault();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => document.removeEventListener('keydown', handleKeyboardShortcuts);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentPlayProgress();
        if (!backgroundPlayRef.current && artPlayerRef.current) {
           artPlayerRef.current.pause();
        }
      }
    };
    window.addEventListener('beforeunload', () => saveCurrentPlayProgress());
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
       document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    return () => { if (saveIntervalRef.current) clearInterval(saveIntervalRef.current); };
  }, []);

  useEffect(() => {
    if (!currentSource || !currentId) return;
    isFavorited(currentSource, currentId).then(setFavorited).catch(console.error);
    return subscribeToDataUpdates('favoritesUpdated', (favs: any) => {
       const key = generateStorageKey(currentSource, currentId);
       setFavorited(!!favs[key]);
    });
  }, [currentSource, currentId]);

  const handleToggleFavorite = async () => {
      if (!videoTitleRef.current || !detailRef.current) return;
      try {
          if (favorited) {
              await deleteFavorite(currentSourceRef.current, currentIdRef.current);
              setFavorited(false);
          } else {
              await saveFavorite(currentSourceRef.current, currentIdRef.current, {
                  title: videoTitleRef.current,
                  source_name: detailRef.current.source_name,
                  year: detailRef.current.year || '',
                  cover: detailRef.current.poster,
                  total_episodes: detailRef.current.episodes.length,
                  save_time: Date.now(),
                  search_title: searchTitle
              });
              setFavorited(true);
          }
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (videoUrl) {
       const urlParts = videoUrl.split('/');
       setDownloadInfo({ href: videoUrl, disabled: false, filename: urlParts[urlParts.length - 1] || 'video.m3u8' });
    }
    
    if (!Artplayer || !Hls || !videoUrl || loading || !artRef.current) return;

    if (artPlayerRef.current) {
        artPlayerRef.current.destroy();
        artPlayerRef.current = null;
    }

    const isWebkit = typeof window !== 'undefined' && typeof (window as any).webkitConvertPointFromNodeToPage === 'function';

    try {
      Artplayer.PLAYBACK_RATE = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
      Artplayer.USE_RAF = true;

      artPlayerRef.current = new Artplayer({
        container: artRef.current,
        url: videoUrl,
        poster: videoCover,
        volume: 0.7,
        isLive: false,
        muted: false,
        autoplay: true,
        pip: true,
        autoSize: false,
        autoMini: true,
        setting: true,
        fullscreen: true,
        fullscreenWeb: true,
        mutex: true,
        playsInline: true,
        autoPlayback: false,
        airplay: true,
        theme: '#22c55e',
        lang: 'zh-cn',
        autoOrientation: false,
        lock: true,
        moreVideoAttr: { crossOrigin: 'anonymous', 'x-webkit-airplay': 'allow' } as any,
        customType: {
          m3u8: function (video: any, url: any) {
            if (!Hls) return;
            if ((video as any).hls) (video as any).hls.destroy();
            const hls = new Hls({ debug: false, enableWorker: true, loader: blockAdEnabledRef.current ? CustomHlsJsLoader : Hls.DefaultConfig.loader });
            hls.loadSource(url); hls.attachMedia(video); (video as any).hls = hls;
            ensureVideoSource(video, url);
            hls.on(Hls.Events.ERROR, function(event: any, data: any) {
                if(data.fatal) {
                    if(data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
                    else if(data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
                    else hls.destroy();
                }
            });
          },
        },
        settings: [
          {
            name: 'background-play',
            html: '后台播放',
            switch: backgroundPlayRef.current,
            onSwitch: function (item: any) { setBackgroundPlay(!item.switch); return !item.switch; },
          },
          {
             name: 'download-video',
             html: downloadProgress ? `下载中 ${downloadProgress}` : '下载视频',
             tooltip: '保存到本地视频库',
             click: async () => {
                 if (downloadProgress) return;
                 try {
                     if (Capacitor.isNativePlatform()) {
                        // 检查并请求权限
                        const perm = await Filesystem.checkPermissions();
                        if (perm.publicStorage !== 'granted') {
                            const req = await Filesystem.requestPermissions();
                            if (req.publicStorage !== 'granted') {
                                alert('未获得存储权限，无法下载');
                                return;
                            }
                        }

                        setDownloadProgress('0%');
                        // 尝试在 External (Android/data/...) 创建 movies 目录
                        try { await Filesystem.mkdir({ path: 'movies', directory: Directory.External, recursive: true }); } catch(e){}
                        
                        const content = `#EXTM3U\n#EXTINF:-1,${videoTitleRef.current}\n${videoUrl}`;
                        await Filesystem.writeFile({
                            path: `movies/${videoTitleRef.current}.m3u8`,
                            data: content,
                            directory: Directory.External,
                            encoding: Encoding.UTF8
                        });
                        setDownloadProgress('100%');
                        setTimeout(() => setDownloadProgress(''), 2000);
                        alert('已保存到 Android/data/com.wangzhiwei05.moontv/files/movies');
                     } else { window.open(videoUrl, '_blank'); }
                 } catch(e:any) { setDownloadProgress(''); alert('下载失败:' + e.message); }
             },
          },
          {
             html: '去广告',
             icon: '<text x="50%" y="50%" font-size="20" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#ffffff">AD</text>',
             tooltip: blockAdEnabled ? '已开启' : '已关闭',
             onClick: function() {
                 const v = !blockAdEnabled;
                 localStorage.setItem('enable_blockad', String(v));
                 setBlockAdEnabled(v);
                 // Reload player to apply loader
                 if (artPlayerRef.current) {
                     resumeTimeRef.current = artPlayerRef.current.currentTime;
                     const videoEl = artPlayerRef.current.video as any;
                     if(videoEl && videoEl.hls) videoEl.hls.destroy();
                     if(artPlayerRef.current.destroy) artPlayerRef.current.destroy();
                     artPlayerRef.current = null;
                 }
                 return v ? '开启' : '关闭';
             }
          },
          {
            name: '跳过片头片尾',
            html: '跳过片头片尾',
            selector: [
              {
                default: true,
                html: '开关: ' + (skipConfigRef.current.enable ? '开启' : '关闭'),
                switch: skipConfigRef.current.enable,
                onSwitch: function (item: any) {
                  const newConfig = { ...skipConfigRef.current, enable: !item.switch };
                  handleSkipConfigChange(newConfig);
                  return !item.switch;
                },
              },
              {
                default: true,
                html: '片头秒数: ' + skipConfigRef.current.intro_time + 's',
                selector: [
                   { html: '0s', time: 0 },
                   { html: '30s', time: 30 },
                   { html: '45s', time: 45 },
                   { html: '60s', time: 60 },
                   { html: '90s', time: 90 },
                   { html: '120s', time: 120 },
                   { html: '自定义', time: -1 }
                ].map(opt => ({
                    html: opt.html,
                    click: function(subItem: any) {
                        let time = opt.time;
                        if (time === -1) {
                            const input = prompt('请输入片头跳过秒数:', String(skipConfigRef.current.intro_time));
                            if (input === null) return;
                            time = parseInt(input) || 0;
                        }
                        handleSkipConfigChange({ ...skipConfigRef.current, intro_time: time });
                        item.html = '片头秒数: ' + time + 's';
                        artPlayerRef.current.setting.update(item); 
                        return true; 
                    }
                }))
              },
              {
                html: '片尾秒数: ' + skipConfigRef.current.outro_time + 's',
                selector: [
                   { html: '0s', time: 0 },
                   { html: '30s', time: 30 },
                   { html: '45s', time: 45 },
                   { html: '60s', time: 60 },
                   { html: '90s', time: 90 },
                   { html: '120s', time: 120 },
                   { html: '自定义', time: -1 }
                ].map(opt => ({
                    html: opt.html,
                    click: function(subItem: any) {
                        let time = opt.time;
                        if (time === -1) {
                            const input = prompt('请输入片尾跳过秒数:', String(skipConfigRef.current.outro_time));
                            if (input === null) return;
                            time = parseInt(input) || 0;
                        }
                        handleSkipConfigChange({ ...skipConfigRef.current, outro_time: time });
                        item.html = '片尾秒数: ' + time + 's';
                        artPlayerRef.current.setting.update(item);
                        return true;
                    }
                }))
              }
            ],
          },
        ],
        controls: [
           {
             position: 'left',
             index: 10,
             html: '<i class="art-icon flex" title="旋转锁定"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg></i>',
             click: function(item: any) {
                 if (!Capacitor.isNativePlatform()) return;
                 const newLocked = !screenLocked;
                 setScreenLocked(newLocked);
                 if (newLocked) ScreenOrientation.lock({ orientation: 'portrait' }).catch(()=>{});
                 else ScreenOrientation.unlock().catch(()=>{});
                 item.html = newLocked ? 
                    '<i class="art-icon flex" style="color: #22c55e"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><path d="M12 12v6"></path><path d="M12 18h.01"></path></svg></i>' :
                    '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg></i>';
                 return item.html;
             }
           },
           {
             position: 'right',
             html: '<i class="art-icon flex" title="投屏"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><line x1="2" x2="2.01" y1="20" y2="20"/></svg></i>',
             click: function () {
                const videoEl = artPlayerRef.current?.video as any;
                // 优先尝试标准 Remote Playback API (支持 Android Chrome/WebView)
                if (videoEl?.remote) {
                    videoEl.remote.prompt().catch(() => {
                        // 失败回退到 Webkit (iOS)
                        if (videoEl?.webkitShowPlaybackTargetPicker) {
                            videoEl.webkitShowPlaybackTargetPicker();
                        } else {
                            alert('请使用系统控制中心的投屏/屏幕镜像功能');
                        }
                    });
                } else if (videoEl?.webkitShowPlaybackTargetPicker) {
                    videoEl.webkitShowPlaybackTargetPicker();
                } else {
                    alert('当前环境不支持直接唤起投屏，请使用系统屏幕镜像');
                }
             },
           },
           {
            position: 'left',
            index: 13,
            html: '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/></svg></i>',
            tooltip: '播放下一集',
            click: function () { handleNextEpisode(); },
           },
        ]
      });

      artPlayerRef.current.on('fullscreen', (state: boolean) => {
         if (!Capacitor.isNativePlatform()) return;
         if (state) { 
             // 进入全屏：强制横屏
             ScreenOrientation.lock({ orientation: 'landscape' }).catch(()=>{});
         } else { 
             // 退出全屏：跟随系统或竖屏
             ScreenOrientation.unlock().catch(()=>{}); 
         } 
      });
      
      artPlayerRef.current.on('video:canplay', () => {
          if (resumeTimeRef.current && resumeTimeRef.current > 0) {
              const dur = artPlayerRef.current.duration || 0;
              let target = resumeTimeRef.current;
              if (dur && target >= dur - 2) target = Math.max(0, dur - 5);
              artPlayerRef.current.currentTime = target;
          }
          resumeTimeRef.current = null;
          setTimeout(() => {
              if (Math.abs(artPlayerRef.current.volume - lastVolumeRef.current) > 0.01) artPlayerRef.current.volume = lastVolumeRef.current;
              setIsVideoLoading(false);
          }, 0);
      });
      
      artPlayerRef.current.on('video:ended', () => {
          if (detailRef.current && currentEpisodeIndexRef.current < detailRef.current.episodes.length - 1) {
              setTimeout(() => setCurrentEpisodeIndex(currentEpisodeIndexRef.current + 1), 1000);
          }
      });
      
      artPlayerRef.current.on('video:volumechange', () => { lastVolumeRef.current = artPlayerRef.current.volume; });

      if (artPlayerRef.current?.video) ensureVideoSource(artPlayerRef.current.video as HTMLVideoElement, videoUrl);

    } catch (err) { setError('播放器初始化失败'); }
  }, [Artplayer, Hls, videoUrl, loading, blockAdEnabled]);

  if (loading) {
     return (
        <PageLayout activePath='/play'>
            <div className='flex flex-col items-center justify-center min-h-screen bg-transparent'>
               <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mb-4'></div>
               <h2 className='text-xl text-gray-800 dark:text-gray-200 animate-pulse'>{loadingMessage}</h2>
            </div>
        </PageLayout>
     );
  }

  if (error) {
     return (
        <PageLayout activePath='/play'>
            <div className='flex flex-col items-center justify-center min-h-screen bg-transparent'>
                <div className='text-red-500 mb-4 text-xl'>{error}</div>
                <button onClick={()=>window.location.reload()} className='px-4 py-2 bg-gray-200 rounded'>重试</button>
            </div>
        </PageLayout>
     );
  }

  return (
    <PageLayout activePath='/play'>
      <div className='flex flex-col gap-3 py-4 px-5 lg:px-[3rem] 2xl:px-20'>
        <div className='py-1'>
          <h1 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
            {videoTitle || '影片标题'}
            {totalEpisodes > 1 && <span className='text-gray-500 dark:text-gray-400'> {` > 第 ${currentEpisodeIndex + 1} 集`}</span>}
          </h1>
        </div>
        <div className='space-y-2'>
          <div className='hidden lg:flex justify-end'>
            <button
              onClick={() => setIsEpisodeSelectorCollapsed(!isEpisodeSelectorCollapsed)}
              className='text-xs px-2 py-1 bg-gray-100 rounded'
            >
              {isEpisodeSelectorCollapsed ? '显示选集' : '隐藏选集'}
            </button>
          </div>

          <div className={`grid gap-4 lg:h-[500px] xl:h-[650px] 2xl:h-[750px] transition-all duration-300 ease-in-out ${isEpisodeSelectorCollapsed ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-4'}`}>
            <div className={`h-full transition-all duration-300 ease-in-out rounded-xl border border-white/0 dark:border-white/30 ${isEpisodeSelectorCollapsed ? 'col-span-1' : 'md:col-span-3'}`}>
              <div className='relative w-full h-[300px] lg:h-full'>
                <div ref={artRef} className='bg-black w-full h-full rounded-xl overflow-hidden shadow-lg'></div>
                {isVideoLoading && <div className='absolute inset-0 bg-black/80 flex items-center justify-center text-white'>加载中...</div>}
              </div>
            </div>

            <div className={`h-[300px] lg:h-full md:overflow-hidden transition-all duration-300 ease-in-out ${isEpisodeSelectorCollapsed ? 'md:col-span-1 lg:hidden lg:opacity-0 lg:scale-95' : 'md:col-span-1 lg:opacity-100 lg:scale-100'}`}>
              <EpisodeSelector
                totalEpisodes={totalEpisodes}
                value={currentEpisodeIndex + 1}
                onChange={(idx) => { 
                    if(artPlayerRef.current && !artPlayerRef.current.paused) saveCurrentPlayProgress();
                    setCurrentEpisodeIndex(idx); 
                }}
                onSourceChange={handleSourceChange}
                currentSource={currentSource}
                currentId={currentId}
                videoTitle={searchTitle || videoTitle}
                availableSources={availableSources}
                sourceSearchLoading={sourceSearchLoading}
                sourceSearchError={sourceSearchError}
                precomputedVideoInfo={precomputedVideoInfo}
              />
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='md:col-span-3'>
            <div className='p-6 flex flex-col min-h-0'>
              <h1 className='text-3xl font-bold mb-2 tracking-wide flex items-center flex-shrink-0 text-center md:text-left w-full'>
                {videoTitle || '影片标题'}
                <button onClick={(e) => { e.stopPropagation(); handleToggleFavorite(); }} className='ml-3 flex-shrink-0 hover:opacity-80 transition-opacity'>
                  <FavoriteIcon filled={favorited} />
                </button>
                <Link href='/library' className='ml-3 flex-shrink-0 hover:opacity-80 transition-opacity text-gray-500 hover:text-green-600' title='视频库'>
                  <Film className='w-6 h-6' />
                </Link>
              </h1>
              <div className='flex flex-wrap items-center gap-3 text-base mb-4 opacity-80 flex-shrink-0'>
                {detail?.class && <span className='text-green-600 font-semibold'>{detail.class}</span>}
                {(detail?.year || videoYear) && <span>{detail?.year || videoYear}</span>}
                {detail?.source_name && <span className='border border-gray-500/60 px-2 py-[1px] rounded'>{detail.source_name}</span>}
              </div>
              {detail?.desc && <div className='mt-0 text-base leading-relaxed opacity-90 overflow-y-auto pr-2 flex-1 min-h-0 scrollbar-hide' style={{ whiteSpace: 'pre-line' }}>{detail.desc}</div>}
            </div>
          </div>
          <div className='hidden md:block md:col-span-1 md:order-first'>
            <div className='pl-0 py-4 pr-6'>
              <div className='bg-gray-300 dark:bg-gray-700 aspect-[2/3] flex items-center justify-center rounded-xl overflow-hidden'>
                {videoCover ? <img src={processImageUrl(videoCover)} alt={videoTitle} className='w-full h-full object-cover' /> : <span className='text-gray-600 dark:text-gray-400'>封面图片</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

const FavoriteIcon = ({ filled }: { filled: boolean }) => {
  if (filled) {
    return (
      <svg className='h-7 w-7' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
        <path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' fill='#ef4444' stroke='#ef4444' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    );
  }
  return <Heart className='h-7 w-7 stroke-[1] text-gray-600 dark:text-gray-300' />;
};

export default function PlayPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlayPageClient />
    </Suspense>
  );
}
