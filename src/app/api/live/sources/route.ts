import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'edge';

export async function GET() {
  try {
    const config = await getConfig();
    const liveSources = (config.LiveConfig || []).filter((s) => !s.disabled);
    return NextResponse.json({ success: true, data: liveSources });
  } catch (error) {
    console.error('获取直播源失败:', error);
    return NextResponse.json({ success: false, data: [] });
  }
}