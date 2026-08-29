/* eslint-disable no-console */

// 直播播放代理（服务端使用）：解决 CORS、混合内容、防盗链导致的无法播放问题

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export function isM3u8Url(url: string): boolean {
  return /\.m3u8?($|\?)/i.test(url);
}

function resolveUrl(baseUrl: string, relativePath: string): string {
  try {
    if (/^https?:\/\//i.test(relativePath)) return relativePath;
    if (relativePath.startsWith('//')) {
      const base = new URL(baseUrl);
      return base.protocol + relativePath;
    }
    return new URL(relativePath, baseUrl).href;
  } catch {
    return relativePath;
  }
}

// 获取播放列表所在目录（用于解析相对分片地址）
function getPlaylistBase(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const idx = path.lastIndexOf('/');
    return u.origin + (idx >= 0 ? path.slice(0, idx + 1) : '/');
  } catch {
    return url.endsWith('/') ? url : url + '/';
  }
}

function buildProxiedUrl(
  target: string,
  playlistBase: string,
  proxyPath: string,
  params: { ua?: string; referer?: string },
): string {
  const absolute = resolveUrl(playlistBase, target);
  const search = new URLSearchParams({ url: absolute });
  if (params.ua) search.set('ua', params.ua);
  if (params.referer) search.set('referer', params.referer);
  return `${proxyPath}?${search.toString()}`;
}

// 重写播放列表：把变体 / 分片 / key / map 地址全部指向本代理（同源）
export function rewritePlaylist(
  text: string,
  playlistBase: string,
  proxyPath: string,
  params: { ua?: string; referer?: string },
): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }

    // 变体列表：保留 EXT-X-STREAM-INF，下一行为变体地址
    if (trimmed.startsWith('#EXT-X-STREAM-INF:')) {
      out.push(line);
      const variant = lines[i + 1]?.trim();
      if (variant && !variant.startsWith('#')) {
        out.push(buildProxiedUrl(variant, playlistBase, proxyPath, params));
        i++;
      }
      continue;
    }

    // 带 URI 属性的标签（key / map / 备用媒体）
    if (
      trimmed.startsWith('#EXT-X-KEY:') ||
      trimmed.startsWith('#EXT-X-MAP:') ||
      trimmed.startsWith('#EXT-X-MEDIA:')
    ) {
      out.push(
        trimmed.replace(
          /URI="([^"]*)"/g,
          (_match, uri: string) =>
            `URI="${buildProxiedUrl(uri, playlistBase, proxyPath, params)}"`,
        ),
      );
      continue;
    }

    // 其他注释标签
    if (trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }

    // 分片等资源行
    out.push(buildProxiedUrl(trimmed, playlistBase, proxyPath, params));
  }

  return out.join('\n');
}

// 统一的代理入口：m3u8 播放列表重写为同源地址，其余资源直接透传
export async function proxyLiveStream(
  request: Request,
  proxyPath: string,
): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const ua = searchParams.get('ua') || undefined;
    const referer = searchParams.get('referer') || undefined;

    if (!url) {
      return jsonResponse({ error: '缺少 url 参数' }, 400);
    }

    const headers: Record<string, string> = {
      'User-Agent': ua || DEFAULT_UA,
      Accept: '*/*',
    };
    const refererValue = referer || getOrigin(url);
    if (refererValue) headers.Referer = refererValue;

    const range = request.headers.get('range');
    if (range) headers.Range = range;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let response: Response;
    try {
      response = await fetch(url, { headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok && response.status !== 206) {
      return jsonResponse(
        { error: `获取直播流失败: HTTP ${response.status}` },
        response.status,
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const isPlaylist =
      isM3u8Url(url) ||
      /mpegurl|apple|vnd\.apple|audio\/x-mpeg/i.test(contentType);

    if (isPlaylist) {
      const text = await response.text();
      const playlistBase = getPlaylistBase(url);
      const rewritten = rewritePlaylist(text, playlistBase, proxyPath, {
        ua,
        referer: refererValue,
      });
      return new Response(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // 原始流透传（ts / mp4 / flv / key 等）
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
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
    responseHeaders.set('Cache-Control', 'no-store');
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('直播代理失败:', error);
    return jsonResponse({ error: '直播代理失败' }, 500);
  }
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
