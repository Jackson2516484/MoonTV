'use client';

import { Filesystem, Directory, ReaddirResult } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Film, FolderOpen, Play, Trash2, FileVideo, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';

import PageLayout from '@/components/PageLayout';
import { processImageUrl } from '@/lib/utils';

interface LocalVideo {
  id: string;
  title: string;
  path: string;
  size: string;
  date: string;
}

function LibraryPageClient() {
  const [videos, setVideos] = useState<LocalVideo[]>([]);
  const [scanning, setScanning] = useState(false);

  const scanVideos = async () => {
    setScanning(true);
    const newVideos: LocalVideo[] = [];

    if (Capacitor.isNativePlatform()) {
      try {
        // 尝试读取 Documents/视频库
        try {
            const result = await Filesystem.readdir({
                path: '视频库',
                directory: Directory.Documents
            });
            
            for (const file of result.files) {
                if (file.name.endsWith('.m3u8') || file.name.endsWith('.mp4')) {
                   newVideos.push({
                       id: file.uri,
                       title: file.name,
                       path: file.uri, // file:// path
                       size: file.size ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : '未知',
                       date: new Date(file.mtime || Date.now()).toLocaleDateString()
                   });
                }
            }
        } catch (e) {
            console.log('视频库目录可能不存在');
        }

      } catch (e) {
        console.error('扫描失败', e);
        alert('扫描失败: ' + (e as any).message);
      }
    } else {
        // Mock for Web
        newVideos.push({
            id: 'mock-1',
            title: '示例本地视频 (Web模拟).mp4',
            path: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
            size: '0 MB',
            date: '2025-12-20'
        });
    }

    setVideos(newVideos);
    setScanning(false);
  };

  useEffect(() => {
    scanVideos();
  }, []);

  const handleDelete = async (video: LocalVideo) => {
    if (!confirm(`确定要删除 ${video.title} 吗？`)) return;
    
    if (Capacitor.isNativePlatform()) {
        try {
            await Filesystem.deleteFile({
                path: '视频库/' + video.title,
                directory: Directory.Documents
            });
            scanVideos();
        } catch (e) {
            alert('删除失败');
        }
    } else {
        setVideos(videos.filter(v => v.id !== video.id));
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
            <span className='text-sm font-normal text-gray-500 ml-2'>
                (存储在 文档/视频库)
            </span>
          </h1>
          <button
            onClick={scanVideos}
            disabled={scanning}
            className='flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50'
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? '扫描中...' : '刷新列表'}</span>
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
                  <FileVideo className='w-12 h-12 text-gray-400' />
                  <div className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
                    <Link
                      href={`/play?local=true&path=${encodeURIComponent(video.path)}&title=${encodeURIComponent(video.title)}`}
                      className='p-3 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-green-600 transition-colors'
                    >
                      <Play className='w-8 h-8 fill-current' />
                    </Link>
                  </div>
                </div>

                {/* Info Area */}
                <div className='p-4 flex-1 flex flex-col justify-between'>
                  <div>
                    <h3 className='font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 mb-2 break-all'>
                      {video.title}
                    </h3>
                    <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
                      <span>{video.size}</span>
                      <span>{video.date}</span>
                    </div>
                  </div>
                  
                  <div className='mt-4 flex justify-end'>
                    <button
                      onClick={() => handleDelete(video)}
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
            <p className='text-sm mt-2'>视频文件将存储在 内部存储/Documents/视频库</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function LibraryPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LibraryPageClient />
        </Suspense>
    );
}
