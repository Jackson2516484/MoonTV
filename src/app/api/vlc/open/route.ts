import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Cloudflare Pages 仅支持 Edge Runtime，无法在服务端拉起本机进程，
// 统一返回 vlc:// 协议地址，由浏览器在本机唤起 VLC 播放器
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return NextResponse.json({ error: '缺少播放地址' }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: false,
        vlcUrl: `vlc://${url}`,
        error: '请在本地安装 VLC，并通过 vlc:// 协议打开播放地址',
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '无法打开 VLC',
      },
      { status: 500 },
    );
  }
}
