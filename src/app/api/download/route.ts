/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

// 解析相对 URL 为绝对 URL
function resolveSegmentUrl(base: string, segment: string): string {
  try {
    return new URL(segment, base).href;
  } catch (err) {
    return segment;
  }
}

function getBaseUrl(m3u8Url: string): string {
  try {
    const url = new URL(m3u8Url);
    if (url.pathname.endsWith('.m3u8')) {
      url.pathname = url.pathname.substring(
        0,
        url.pathname.lastIndexOf('/') + 1,
      );
    } else if (!url.pathname.endsWith('/')) {
      url.pathname += '/';
    }
    return url.protocol + '//' + url.host + url.pathname;
  } catch (err) {
    return m3u8Url.endsWith('/') ? m3u8Url : m3u8Url + '/';
  }
}

interface PlaylistResult {
  text: string;
  ok: boolean;
  status: number;
}

async function fetchPlaylist(
  url: string,
  referer: string | undefined,
): Promise<PlaylistResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_UA,
      Accept: '*/*',
    };
    const refererValue = referer || getOrigin(url);
    if (refererValue) headers.Referer = refererValue;

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    return { text, ok: response.ok, status: response.status };
  } finally {
    clearTimeout(timer);
  }
}

function isPlaylistText(text: string): boolean {
  return /#EXTM3U|#EXT-X-STREAM-INF|#EXTINF|#EXT-X-TARGETDURATION|#EXT-X-MEDIA-SEQUENCE/.test(
    text,
  );
}

// 解析 m3u8 播放列表，返回所有分片
// 主列表从最后一个变体开始尝试（通常码率最高），失败则自动回退到前一个
async function fetchAllSegments(
  m3u8Url: string,
  referer: string | undefined,
): Promise<string[]> {
  const resolve = (seg: string) => resolveSegmentUrl(getBaseUrl(m3u8Url), seg);

  const first = await fetchPlaylist(m3u8Url, referer);
  if (!first.ok) {
    throw new Error(`获取播放列表失败: HTTP ${first.status}`);
  }
  const lines = first.text.split(/\r?\n/);

  // 主列表：收集变体
  const variantUrls: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const next = lines[i + 1]?.trim();
      if (next && !next.startsWith('#')) {
        variantUrls.push(resolve(next));
      }
    }
  }
  if (variantUrls.length > 0) {
    let lastError: Error | null = null;
    for (let i = variantUrls.length - 1; i >= 0; i--) {
      try {
        const segments = await fetchAllSegments(variantUrls[i], referer);
        if (segments.length > 0) return segments;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError || new Error('所有变体均无法解析');
  }

  // 媒体列表：校验内容后收集分片
  if (!isPlaylistText(first.text)) {
    throw new Error('播放列表内容无效（可能被服务器拦截或需要防盗链信息）');
  }
  const segments: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    segments.push(resolve(line));
  }
  if (segments.length === 0) {
    throw new Error('播放列表中没有找到分片');
  }
  return segments;
}

// 原始资源透传（分片 / key / 直链文件）
async function proxyRaw(
  url: string,
  referer: string | undefined,
  request: NextRequest,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_UA,
      Accept: '*/*',
    };
    const refererValue = referer || getOrigin(url);
    if (refererValue) headers.Referer = refererValue;

    const range = request.headers.get('range');
    if (range) headers.Range = range;

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: `下载分片失败: HTTP ${response.status}` },
        { status: response.status },
      );
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    const contentType = response.headers.get('content-type');
    if (contentType) responseHeaders.set('Content-Type', contentType);
    for (const key of [
      'content-range',
      'accept-ranges',
      'content-length',
      'content-disposition',
    ]) {
      const value = response.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    responseHeaders.set('Cache-Control', 'public, max-age=120, s-maxage=120');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const referer = searchParams.get('referer') || undefined;
    const mode = searchParams.get('mode') || 'raw';

    if (!url) {
      return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }

    if (mode === 'segments') {
      // 服务端解析播放列表，返回经代理的同源分片地址，规避 CORS / 防盗链
      const segments = await fetchAllSegments(url, referer);
      const proxyPath = request.nextUrl.pathname;
      const proxiedSegments = segments.map(
        (segment) =>
          `${proxyPath}?mode=raw&url=${encodeURIComponent(segment)}${
            referer ? `&referer=${encodeURIComponent(referer)}` : ''
          }`,
      );
      return NextResponse.json({ segments: proxiedSegments });
    }

    return await proxyRaw(url, referer, request);
  } catch (error) {
    console.error('下载代理失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '下载代理失败',
      },
      { status: 500 },
    );
  }
}

