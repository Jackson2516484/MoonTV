import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VLC_CANDIDATES = [
  'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
  'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
  '/usr/bin/vlc',
  '/usr/local/bin/vlc',
  '/snap/bin/vlc',
];

function findVlc(): string | null {
  for (const candidate of VLC_CANDIDATES) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch (err) {
      // 忽略
    }
  }
  return null;
}

// 在本地服务（桌面端）直接调用 VLC 播放直播流
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return NextResponse.json({ error: '缺少播放地址' }, { status: 400 });
    }

    const vlcPath = findVlc();
    if (vlcPath) {
      const child = spawn(vlcPath, [url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
      return NextResponse.json({ ok: true });
    }

    // 尝试 PATH 中的 vlc
    const launched = await new Promise<boolean>((resolve) => {
      try {
        const child = spawn('vlc', [url], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        });
        child.once('error', () => resolve(false));
        child.once('spawn', () => {
          child.unref();
          resolve(true);
        });
      } catch (err) {
        resolve(false);
      }
    });
    if (launched) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { ok: false, error: '未找到 VLC，请先安装 VLC 播放器' },
      { status: 404 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '无法启动 VLC',
      },
      { status: 500 },
    );
  }
}

