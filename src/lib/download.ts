/* eslint-disable no-console */

// 获取原始地址的 Referer（默认用其自身域名，规避防盗链）
function getReferer(url: string): string {
  try {
    return new URL(url).origin;
  } catch (err) {
    return '';
  }
}

// 构建下载代理地址
function getDownloadProxyUrl(
  url: string,
  referer: string,
  mode: 'segments' | 'raw' = 'raw',
): string {
  const params = new URLSearchParams({ url, mode });
  if (referer) params.set('referer', referer);
  return `/api/download?${params.toString()}`;
}

// 带重试的请求
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError || new Error('下载失败');
}

// 下载 m3u8 视频（分片经服务端代理拉取，规避 CORS / 防盗链 / 混合内容限制）
export async function downloadM3u8(
  m3u8Url: string,
  title: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const referer = getReferer(m3u8Url);

  // 1. 服务端解析播放列表，返回可下载的同源分片地址
  const listResponse = await fetch(
    getDownloadProxyUrl(m3u8Url, referer, 'segments'),
    { cache: 'no-store' },
  );
  if (!listResponse.ok) {
    const data = await listResponse.json().catch(() => ({}));
    throw new Error(
      (data && (data as any).error) ||
        `获取播放列表失败: HTTP ${listResponse.status}`,
    );
  }
  const data = await listResponse.json();
  const segments: string[] = Array.isArray(data.segments) ? data.segments : [];
  if (segments.length === 0) {
    throw new Error('播放列表中没有找到分片');
  }

  // 2. 逐片下载并合并
  const chunks: BlobPart[] = [];
  let downloaded = 0;

  for (let i = 0; i < segments.length; i++) {
    const response = await fetchWithRetry(segments[i]);
    const buffer = await response.arrayBuffer();
    chunks.push(buffer);
    downloaded += buffer.byteLength;
    onProgress?.(i + 1, segments.length);
  }

  const blob = new Blob(chunks, { type: 'video/mp2t' });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `${title}.ts`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}

// 普通视频直接下载（浏览器导航下载，不受 CORS 限制）
export function downloadDirect(url: string, title: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = title;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function isM3u8Url(url: string): boolean {
  return /\.m3u8?($|\?)/i.test(url);
}
