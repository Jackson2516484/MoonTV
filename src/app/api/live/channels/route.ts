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

    // 不再在此串行抓 EPG：整份 XMLTV 下载+解析曾阻塞频道返回数秒到
    // 20 秒（冷 isolate 更久），表现为“频道列表迟迟不出”。改为只回
    // tvgUrl，客户端拿到频道后另走 /api/live/epg 异步填充节目单。
    return NextResponse.json({
      success: true,
      channels,
      tvgUrl: result.tvgUrl,
      programs: {},
    });
  } catch (error) {
    console.error('获取频道信息失败:', error);
    return NextResponse.json({ error: '获取频道信息失败' }, { status: 500 });
  }
}