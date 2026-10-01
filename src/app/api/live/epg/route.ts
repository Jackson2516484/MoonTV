/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { buildChannelPrograms, fetchEpgData } from '@/lib/epg';

export const runtime = 'edge';

// GET /api/live/epg?url=<epg xml 地址>&channels=<id,tvgId,name;...>（可选）
// 不带 channels 时返回全量 epg 频道名映射；带 channels 时返回各频道的 now/next
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }

    const epg = await fetchEpgData(url);
    if (!epg) {
      return NextResponse.json({ error: 'EPG 获取失败' }, { status: 502 });
    }

    const channelsParam = searchParams.get('channels');
    if (!channelsParam) {
      // 返回频道名映射，供客户端自行匹配
      const channelNames: Record<string, string[]> = {};
      epg.channels.forEach((names, id) => {
        channelNames[id] = names;
      });
      return NextResponse.json({ success: true, channelNames });
    }

    const channels = channelsParam.split(';').map((part) => {
      const [id, tvgId, name] = part.split(',');
      return { id: id || '', tvgId: tvgId || '', name: name || '' };
    });
    const programs = buildChannelPrograms(epg, channels);
    return NextResponse.json({ success: true, programs });
  } catch (error) {
    console.error('EPG 接口异常:', error);
    return NextResponse.json({ error: 'EPG 接口异常' }, { status: 500 });
  }
}

// POST /api/live/epg  body: { url, channels: [{id, tvgId, name}] }
// 频道较多时用 POST，避免 GET 参数超长
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = body.url as string | undefined;
    if (!url) {
      return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }
    const epg = await fetchEpgData(url);
    if (!epg) {
      return NextResponse.json({ error: 'EPG 获取失败' }, { status: 502 });
    }
    const channels = Array.isArray(body.channels) ? body.channels : [];
    const programs = buildChannelPrograms(epg, channels);
    return NextResponse.json({ success: true, programs });
  } catch (error) {
    console.error('EPG 接口异常:', error);
    return NextResponse.json({ error: 'EPG 接口异常' }, { status: 500 });
  }
}
