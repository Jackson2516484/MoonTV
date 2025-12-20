/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getStorage } from '@/lib/db';

export const runtime = 'edge';

/**
 * 危险操作：清理全局内容 (播放记录、收藏等)
 */
export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // 仅站长可执行全局清理
  if (authInfo.username !== process.env.USERNAME) {
    return NextResponse.json({ error: '仅限站长操作' }, { status: 401 });
  }

  try {
    const { type } = await request.json() as { type: 'history' | 'favorites' | 'all' };
    const storage = getStorage();
    
    // 如果 D1 支持批量删除
    if (storage && (storage as any).getDb) {
        const db = (storage as any).getDb();
        if (type === 'history' || type === 'all') {
            await db.prepare('DELETE FROM play_records').run();
            await db.prepare('DELETE FROM search_history').run();
        }
        if (type === 'favorites' || type === 'all') {
            await db.prepare('DELETE FROM favorites').run();
        }
    } else {
        return NextResponse.json({ error: '当前存储引擎不支持全局清理' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: '清理失败', details: (error as Error).message }, { status: 500 });
  }
}
