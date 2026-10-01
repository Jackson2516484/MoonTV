'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import { useEffect, useRef, useState } from 'react';

import { generatePairCode, MiniMqtt } from '@/lib/mqtt';
import { useLanguage } from '@/contexts/LanguageContext';

let Hls: any = null;
let Mpegts: any = null;

const CMD_TOPIC = (code: string) => `moontv/tv/${code}/cmd`;
const STATUS_TOPIC = (code: string) => `moontv/tv/${code}/status`;

export default function TvPage() {
  const { t } = useLanguage();
  const [code] = useState(() => generatePairCode());
  const [mqttState, setMqttState] = useState<'connecting' | 'online'>(
    'connecting',
  );
  const [title, setTitle] = useState<string>('');
  const [hint, setHint] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const mpegtsRef = useRef<any>(null);
  const mqttRef = useRef<MiniMqtt | null>(null);

  const cleanupPlayer = () => {
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        // 忽略
      }
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      try {
        mpegtsRef.current.unload?.();
        mpegtsRef.current.destroy?.();
      } catch {
        // 忽略
      }
      mpegtsRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
      } catch {
        // 忽略
      }
      video.removeAttribute('src');
      video.load();
    }
  };

  const playUrl = (url: string, name: string) => {
    const video = videoRef.current;
    if (!video || !url) return;
    cleanupPlayer();
    setTitle(name || '');
    setHint(null);
    const isM3u8 = /\.m3u8?($|\?)/i.test(url);
    const isFlvTs =
      /\.(flv|ts)($|\?)|x-flv/i.test(url) || /\/udp\//i.test(url);
    try {
      if (isM3u8 && Hls && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (data?.fatal) setHint(t('tvPlayFailed'));
        });
        video.play().catch(() => {});
      } else if (
        isFlvTs &&
        Mpegts &&
        typeof Mpegts.isSupported === 'function' &&
        Mpegts.isSupported()
      ) {
        const player = Mpegts.createPlayer(
          { type: 'mpegts', isLive: true, url, cors: true },
          { enableWorker: true, enableStashBuffer: true, isLive: true },
        );
        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();
        video.play().catch(() => {});
        player.play?.();
      } else {
        video.src = url;
        video.play().catch(() => {});
      }
    } catch (err) {
      console.error('电视端播放失败:', err);
      setHint(t('tvPlayFailed'));
    }
  };

  useEffect(() => {
    import('hls.js').then((mod) => {
      Hls = mod.default;
    });
    import('mpegts.js').then((mod) => {
      Mpegts = mod.default || mod;
    });

    const mqtt = new MiniMqtt();
    mqttRef.current = mqtt;
    mqtt.onMessage((topic, payload) => {
      if (topic !== CMD_TOPIC(code)) return;
      let cmd: any = null;
      try {
        cmd = JSON.parse(payload);
      } catch {
        return;
      }
      const video = videoRef.current;
      switch (cmd.type) {
        case 'play':
          if (typeof cmd.url === 'string') {
            playUrl(cmd.url, cmd.title || '');
          }
          break;
        case 'pause':
          video?.pause();
          break;
        case 'resume':
          video?.play().catch(() => {});
          break;
        case 'toggle':
          if (video) {
            if (video.paused) video.play().catch(() => {});
            else video.pause();
          }
          break;
        case 'volume':
          if (video && typeof cmd.value === 'number') {
            video.volume = Math.max(0, Math.min(1, cmd.value));
            video.muted = video.volume === 0;
          }
          break;
        case 'volumeUp':
          if (video) {
            video.muted = false;
            video.volume = Math.max(0, Math.min(1, video.volume + 0.1));
          }
          break;
        case 'volumeDown':
          if (video) {
            video.volume = Math.max(0, Math.min(1, video.volume - 0.1));
            if (video.volume === 0) video.muted = true;
          }
          break;
        case 'mute':
          if (video) video.muted = true;
          break;
        case 'unmute':
          if (video) video.muted = false;
          break;
        default:
          break;
      }
    });
    mqtt.onConnect = () => {
      setMqttState('online');
      mqtt.subscribe(CMD_TOPIC(code));
      // 上线广播，手机端可感知
      window.setTimeout(() => {
        mqtt.publish(
          STATUS_TOPIC(code),
          JSON.stringify({ online: true, ts: Date.now() }),
        );
      }, 500);
    };
    mqtt.connect();

    return () => {
      mqtt.publish(STATUS_TOPIC(code), JSON.stringify({ online: false }));
      mqtt.close();
      mqttRef.current = null;
      cleanupPlayer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setHint(t('copied'));
      window.setTimeout(() => setHint(null), 2000);
    } catch {
      // 忽略
    }
  };

  return (
    <div className='min-h-screen bg-black text-white flex flex-col'>
      {/* 播放区 */}
      <div className='relative flex-1 bg-black min-h-[40vh]'>
        <video
          ref={videoRef}
          className='absolute inset-0 w-full h-full'
          controls
          playsInline
          autoPlay
        />
        {!title && (
          <div className='absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center'>
            <p className='text-gray-400 text-lg'>{t('tvWaiting')}</p>
            <button
              onClick={copyCode}
              className='text-7xl font-mono font-bold tracking-[0.3em] text-green-400 hover:text-green-300 transition-colors'
              title={t('tvTapToCopy')}
            >
              {code}
            </button>
            <div className='text-gray-400 text-sm leading-relaxed'>
              <p>
                {t('tvPairCode')}:{' '}
                <span className='text-green-400 font-mono text-base'>
                  {code}
                </span>
              </p>
              <p className='mt-2'>{t('tvOpenHint')}</p>
              <p className='mt-1 text-xs text-gray-500'>
                {mqttState === 'online' ? t('tvConnected') : t('tvConnecting')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 底部信息条 */}
      <div className='flex items-center justify-between px-6 py-4 bg-gray-950 border-t border-gray-800'>
        <div className='min-w-0'>
          <p className='text-sm text-gray-500'>{t('tvNowPlayingLabel')}</p>
          <p className='text-lg font-medium truncate'>
            {title || t('tvWaiting')}
          </p>
        </div>
        <button
          onClick={copyCode}
          className='flex-shrink-0 ml-4 rounded-xl bg-green-600 hover:bg-green-700 px-6 py-3 font-mono text-2xl font-bold tracking-[0.2em] transition-colors'
        >
          {code}
        </button>
      </div>

      {hint && (
        <div className='fixed bottom-24 left-1/2 -translate-x-1/2 rounded-lg bg-gray-800 px-4 py-2 text-sm'>
          {hint}
        </div>
      )}
    </div>
  );
}
