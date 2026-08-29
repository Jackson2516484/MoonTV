/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { normalizeChannelUrls, parseLiveContent } from '@/lib/live';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const sourceKey = searchParams.get('source') || 'live';
    const ua = searchParams.get('ua') || 'AptvPlayer/1.4.10';

    if (!url) {
      return NextResponse.json({ error: '缺少 m3u 地址参数' }, { status: 400 });
    }

    // 手动实现超时（edge 环境兼容）
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': ua },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `获取直播源失败: HTTP ${response.status}` },
        { status: 502 }
      );
    }

    const content = await response.text();
    const result = parseLiveContent(sourceKey, content);
    const channels = normalizeChannelUrls(result.channels, url);

    return NextResponse.json({
      success: true,
      channels,
      tvgUrl: result.tvgUrl,
    });
  } catch (error) {
    console.error('获取频道信息失败:', error);
    return NextResponse.json({ error: '获取频道信息失败' }, { status: 500 });
  }
}