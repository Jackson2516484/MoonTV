'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface StartupAdProps {
  onFinish: () => void;
}

const AD_IMAGES = [
  '/ads/ad1.jpg',
  '/ads/ad2.jpg',
  '/ads/ad3.jpg',
];

const PLAN_URLS = [
  'https://wx.51haoka.cc/order/index.php?uid=cU40V2t2aGlvZFk9&pid=2018',
  'https://wx.51haoka.cc/order/index.php?uid=cU40V2t2aGlvZFk9&pid=2017',
  'https://wx.51haoka.cc/order/index?uid=cU40V2t2aGlvZFk9&pid=1982',
];

export default function StartupAd({ onFinish }: StartupAdProps) {
  const { t } = useLanguage();
  const [countdown, setCountdown] = useState(5);
  const [adIndex, setAdIndex] = useState(0);
  const [showWebView, setShowWebView] = useState(false);

  useEffect(() => {
    // Randomly select an ad, but try to be different from last time
    const lastAdIndex = parseInt(localStorage.getItem('last_ad_index') || '-1');
    let newIndex = Math.floor(Math.random() * AD_IMAGES.length);
    
    // Simple logic to avoid repeat if possible
    if (AD_IMAGES.length > 1 && newIndex === lastAdIndex) {
      newIndex = (newIndex + 1) % AD_IMAGES.length;
    }
    
    setAdIndex(newIndex);
    localStorage.setItem('last_ad_index', newIndex.toString());

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!showWebView) { 
             onFinish();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onFinish, showWebView]);

  const handleAdClick = () => {
    setShowWebView(true);
  };

  const handleWebViewClose = () => {
    setShowWebView(false);
    onFinish(); 
  };

  if (showWebView) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white dark:bg-black flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur safe-area-top">
          <h3 className="font-bold text-lg">{t('details')}</h3>
          <button 
            onClick={handleWebViewClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 w-full h-full relative">
           <iframe 
             src={PLAN_URLS[adIndex]} 
             className="w-full h-full border-0"
             sandbox="allow-same-origin allow-scripts allow-forms"
           />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9000] bg-black flex items-center justify-center">
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        {/* 使用 object-contain 确保完整显示，bg-black 填充留白 */}
        <Image
          src={AD_IMAGES[adIndex]}
          alt="Startup Ad"
          fill
          className="object-contain"
          onClick={handleAdClick}
          priority
        />
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFinish();
          }}
          className="absolute top-4 right-4 z-[9001] bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-md safe-area-top-margin border border-white/20"
        >
          {t('skipAd')} {countdown}s
        </button>
      </div>
    </div>
  );
}