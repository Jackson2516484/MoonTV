'use client';

import { Film, FolderOpen, Play, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import PageLayout from '@/components/PageLayout';
import { processImageUrl } from '@/lib/utils';

// Mock data to simulate downloaded videos
// In a real implementation, this would come from a local database or file system scan
const INITIAL_VIDEOS = [
  {
    id: 'local-1',
    title: '示例本地视频 - 这里的黎明静悄悄',
    cover: '',
    path: 'file:///storage/emulated/0/Android/data/com.wangzhiwei05.moontv/files/视频库/video1.mp4',
    size: '1.2GB',
    date: '2025-12-18',
    duration: '02:15:00',
  },
];

export default function LibraryPage() {
  const [videos, setVideos] = useState(INITIAL_VIDEOS);

  const handleScan = () => {
    // This would trigger a native file scan in a real app
    alert('正在扫描本地视频... (模拟)');
    // Simulate finding a new video
    setTimeout(() => {
      setVideos((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          title: '新扫描的视频.mp4',
          cover: '',
          path: 'file:///storage/.../new_video.mp4',
          size: '800MB',
          date: new Date().toISOString().split('T')[0],
          duration: '00:45:00',
        },
      ]);
    }, 1000);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个视频吗？')) {
      setVideos(videos.filter((v) => v.id !== id));
    }
  };

  return (
    <PageLayout activePath='/library'>
      <div className='flex flex-col gap-6 py-6 px-5 lg:px-[3rem] 2xl:px-20 min-h-screen'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2'>
            <Film className='w-8 h-8 text-green-600' />
            视频库
          </h1>
          <button
            onClick={handleScan}
            className='flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-sm'
          >
            <FolderOpen className='w-4 h-4' />
            <span>扫描本地视频</span>
          </button>
        </div>

        {/* Video Grid */}
        {videos.length > 0 ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
            {videos.map((video) => (
              <div
                key={video.id}
                className='bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow border border-gray-100 dark:border-gray-700 flex flex-col'
              >
                {/* Thumbnail Area */}
                <div className='relative aspect-video bg-gray-200 dark:bg-gray-900 flex items-center justify-center group'>
                  {video.cover ? (
                    <img
                      src={processImageUrl(video.cover)}
                      alt={video.title}
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    <Film className='w-12 h-12 text-gray-400' />
                  )}
                  <div className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
                    <Link
                      href={`/play?local=true&path=${encodeURIComponent(
                        video.path
                      )}&title=${encodeURIComponent(video.title)}`}
                      className='p-3 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-green-600 transition-colors'
                    >
                      <Play className='w-8 h-8 fill-current' />
                    </Link>
                  </div>
                  <span className='absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded'>
                    {video.duration}
                  </span>
                </div>

                {/* Info Area */}
                <div className='p-4 flex-1 flex flex-col justify-between'>
                  <div>
                    <h3 className='font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 mb-2'>
                      {video.title}
                    </h3>
                    <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
                      <span>{video.size}</span>
                      <span>{video.date}</span>
                    </div>
                  </div>
                  
                  <div className='mt-4 flex justify-end'>
                    <button
                      onClick={() => handleDelete(video.id)}
                      className='p-2 text-gray-400 hover:text-red-500 transition-colors'
                      title='删除'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center flex-1 py-20 text-gray-400'>
            <FolderOpen className='w-20 h-20 mb-4 opacity-50' />
            <p className='text-lg'>暂无本地视频</p>
            <p className='text-sm mt-2'>点击右上角“扫描”按钮添加视频</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
