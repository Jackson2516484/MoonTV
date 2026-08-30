'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Loader2, MonitorPlay, Radio, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { castCurrentVideo } from '@/lib/cast';
import {
  castToDlnaDevice,
  DlnaDevice,
  getDlnaServerBase,
  scanDlnaDevices,
  setDlnaServerBase,
} from '@/lib/dlna';
import { useLanguage } from '@/contexts/LanguageContext';

interface CastModalProps {
  open: boolean;
  onClose: () => void;
  getVideo?: () => HTMLVideoElement | undefined;
  buildCastTarget: () => { url: string; title: string } | null;
}

export default function CastModal({
  open,
  onClose,
  getVideo,
  buildCastTarget,
}: CastModalProps) {
  const { t } = useLanguage();

  const [serverBase, setServerBase] = useState('');
  const [devices, setDevices] = useState<DlnaDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [castingTo, setCastingTo] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setServerBase(getDlnaServerBase());
    setDevices([]);
    setStatus(null);
    setError(null);
    setCastingTo(null);
    handleScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setStatus(null);
    try {
      const list = await scanDlnaDevices();
      setDevices(list);
      if (list.length === 0) {
        setStatus(t('castNoDevices'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const handleSaveServer = () => {
    try {
      setDlnaServerBase(serverBase);
      handleScan();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCast = async (device: DlnaDevice) => {
    const target = buildCastTarget();
    if (!target) {
      setError(t('castNoVideo'));
      return;
    }
    setCastingTo(device.friendlyName || device.udn);
    setError(null);
    setStatus(null);
    try {
      await castToDlnaDevice(device, target.url, target.title);
      setStatus(t('casting'));
      window.setTimeout(onClose, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCastingTo(null);
    }
  };

  const handleSystemCast = () => {
    const video = getVideo?.();
    const result = castCurrentVideo(video);
    if (!result.ok && result.message) {
      setError(result.message);
    } else if (result.ok) {
      setStatus(t('casting'));
      window.setTimeout(onClose, 600);
    }
  };

  if (!open) return null;

  return (
    <div
      className='fixed inset-0 z-[11000] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4'
      onClick={onClose}
    >
      <div
        className='w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-gray-200 dark:ring-gray-800 max-h-[85vh] flex flex-col'
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800'>
          <h2 className='text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2'>
            <MonitorPlay className='w-5 h-5 text-green-500' />
            {t('cast')}
          </h2>
          <button
            onClick={onClose}
            className='p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto px-4 py-3 space-y-3'>
          {/* 系统投屏（AirPlay / Chromecast） */}
          <button
            onClick={handleSystemCast}
            className='w-full flex items-center gap-3 rounded-xl bg-green-600 text-white px-4 py-3 text-sm font-medium hover:bg-green-700 transition-colors'
          >
            <Radio className='w-5 h-5' />
            {t('castSystem')}
          </button>

          {/* DLNA 服务地址 */}
          <div className='flex items-center gap-2'>
            <input
              type='text'
              value={serverBase}
              onChange={(e) => setServerBase(e.target.value)}
              placeholder='http://192.168.1.100:7777'
              className='flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-green-500 focus:outline-none'
            />
            <button
              onClick={handleSaveServer}
              disabled={scanning}
              className='flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 flex-shrink-0'
            >
              {scanning ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <Search className='w-4 h-4' />
              )}
              {t('castScan')}
            </button>
          </div>
          <p className='text-xs text-gray-500 dark:text-gray-400 -mt-1'>
            {t('castServerHint')}
          </p>

          {/* 设备列表 */}
          {scanning && (
            <div className='flex items-center justify-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400'>
              <Loader2 className='w-4 h-4 animate-spin' />
              {t('castScanning')}
            </div>
          )}

          {!scanning && devices.length === 0 && !error && !status && (
            <div className='py-6 text-center text-sm text-gray-400'>
              {t('castNoDevices')}
            </div>
          )}

          {devices.length > 0 && (
            <div className='space-y-2'>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400'>
                {t('castDevices')} ({devices.length})
              </p>
              {devices.map((device) => {
                const busy = castingTo === (device.friendlyName || device.udn);
                return (
                  <button
                    key={device.udn || device.controlUrl}
                    onClick={() => handleCast(device)}
                    disabled={busy}
                    className='w-full flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-60'
                  >
                    {device.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={device.iconUrl}
                        alt=''
                        className='w-9 h-9 rounded object-contain bg-white dark:bg-gray-700 flex-shrink-0'
                        loading='lazy'
                      />
                    ) : (
                      <div className='w-9 h-9 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0'>
                        <MonitorPlay className='w-5 h-5 text-green-600 dark:text-green-400' />
                      </div>
                    )}
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-gray-800 dark:text-gray-100 truncate'>
                        {device.friendlyName || t('castUnknownDevice')}
                      </p>
                      <p className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                        {device.modelName || 'DLNA'}
                      </p>
                    </div>
                    {busy && <Loader2 className='w-4 h-4 animate-spin text-green-500 flex-shrink-0' />}
                  </button>
                );
              })}
              <button
                onClick={handleScan}
                className='w-full flex items-center justify-center gap-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              >
                <RefreshCw className='w-3.5 h-3.5' />
                {t('castRescan')}
              </button>
            </div>
          )}

          {status && !scanning && (
            <p className='text-sm text-green-600 dark:text-green-400'>{status}</p>
          )}
          {error && (
            <p className='text-sm text-red-600 dark:text-red-400 break-words'>{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
