'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, ExternalLink, Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import Swal from 'sweetalert2';

const PLANS = [
  {
    id: 1,
    image: '/ads/ad1.jpg',
    url: 'https://wx.51haoka.cc/order/index.php?uid=cU40V2t2aGlvZFk9&pid=2018',
    key: 'plan1' as const,
    desc: '超大流量，极速体验。月租低至19元，包含100G通用流量+30G定向流量（30G流量是参加活动领取）。首月免月租，激活即送话费。',
  },
  {
    id: 2,
    image: '/ads/ad2.jpg',
    url: 'https://wx.51haoka.cc/order/index.php?uid=cU40V2t2aGlvZFk9&pid=2017',
    key: 'plan2' as const,
    desc: '性价比之王。24元/月，畅享150G全通用流量+30G（参加活动领取），不限速，不虚量。支持5G网络，全国通用。',
  },
  {
    id: 3,
    image: '/ads/ad3.jpg',
    url: 'https://wx.51haoka.cc/order/index?uid=cU40V2t2aGlvZFk9&pid=1982',
    key: 'plan3' as const,
    desc: '长期套餐首选。38元/月，360G通用流量+30G定向流量（定向：学习强国、直播中国、芒果TV、百视TV）。自动续约，长期有效，无语音通话时长。',
  },
];

export default function WatchArtifact() {
  const { t } = useLanguage();
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  const handleDetails = (plan: typeof PLANS[0]) => {
    Swal.fire({
      title: t(plan.key),
      text: plan.desc,
      icon: 'info',
      confirmButtonText: t('confirm'),
      confirmButtonColor: '#22c55e',
    });
  };

  const handleApply = (url: string) => {
    setActiveUrl(url);
  };

  if (activeUrl) {
    return (
      <div className="fixed inset-0 z-[2000] bg-white dark:bg-black flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm safe-area-top">
          <h3 className="font-bold text-lg text-gray-800 dark:text-white">{t('handle')}</h3>
          <button 
            onClick={() => setActiveUrl(null)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        <div className="flex-1 w-full h-full relative bg-gray-50 dark:bg-gray-900">
           <iframe 
             src={activeUrl} 
             className="w-full h-full border-0"
             sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
           />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-4 px-4 space-y-8 min-h-screen">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">{t('watchArtifact')}</h1>
      
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {PLANS.map((plan) => (
          <div key={plan.id} className="flex flex-col items-center group">
            {/* Card Container */}
            <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 bg-gray-100 dark:bg-gray-800">
              <Image
                src={plan.image}
                alt={t(plan.key)}
                fill
                className="object-cover"
              />
              
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />

              {/* Buttons on Image */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center gap-3">
                {/* Details Button */}
                <button
                  onClick={() => handleDetails(plan)}
                  className="flex items-center gap-1 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Info className="w-4 h-4" />
                  {t('details')}
                </button>

                {/* Apply Button */}
                <button
                  onClick={() => handleApply(plan.url)}
                  className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transform active:scale-95 transition-all"
                >
                  {t('handle')}
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Plan Name Below Card */}
            <h2 className="mt-4 text-lg font-bold text-gray-800 dark:text-gray-200 group-hover:text-green-500 transition-colors">
              {t(plan.key)}
            </h2>
          </div>
        ))}
      </div>
    </div>
  );
}