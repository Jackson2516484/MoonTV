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
    const lastAdIndex = parseInt(localStorage.getItem('last_ad_index') || '-1');
    let newIndex = Math.floor(Math.random() * AD_IMAGES.length);
    if (AD_IMAGES.length > 1 && newIndex === lastAdIndex) {
      newIndex = (newIndex + 1) % AD_IMAGES.length;
    }
    setAdIndex(newIndex);
    localStorage.setItem('last_ad_index', newIndex.toString());

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
      <div className="fixed inset-0 z-[20000] bg-white flex flex-col animate-slide-up">
        <button 
          onClick={handleWebViewClose}
          className="absolute top-4 right-4 z-[20001] p-2 bg-black/50 text-white rounded-full backdrop-blur-md safe-area-top-margin"
        >
          <X className="w-6 h-6" />
        </button>
        
        <iframe 
          src={PLAN_URLS[adIndex]} 
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[20000] bg-black">
      <div className="relative w-full h-full">
        <Image
          src={AD_IMAGES[adIndex]}
          alt="Startup Ad"
          fill
          // 改为 object-fill 以强制填满屏幕，不留黑边，不裁剪（可能会变形，符合“填充模式”描述）
          className="object-fill" 
          onClick={handleAdClick}
          priority
        />
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFinish();
          }}
          className="absolute top-4 right-4 z-[20001] bg-black/40 text-white px-3 py-1.5 rounded-full text-sm backdrop-blur-md safe-area-top-margin border border-white/20"
        >
          {t('skipAd')} {countdown}s
        </button>
      </div>
    </div>
  );
}