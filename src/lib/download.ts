/* eslint-disable no-console */

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
      url.pathname = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
    } else if (!url.pathname.endsWith('/')) {
      url.pathname += '/';
    }
    return url.protocol + '//' + url.host + url.pathname;
  } catch (err) {
    return m3u8Url.endsWith('/') ? m3u8Url : m3u8Url + '/';
  }
}

// 解析 m3u8 播放列表，返回分片 URL 列表
async function fetchPlaylistSegments(
  m3u8Url: string,
  isMaster: boolean
): Promise<string[]> {
  const response = await fetch(m3u8Url);
  if (!response.ok) {
    throw new Error(`获取播放列表失败: HTTP ${response.status}`);
  }
  const text = await response.text();
  const lines = text.split(/\r?\n/);

  // 主列表：取第一个变体（清晰度最高优先取最后一个，通常最后一个质量最高）
  if (isMaster || text.includes('#EXT-X-STREAM-INF:')) {
    const variantUrls: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        if (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].trim().startsWith('#')) {
          variantUrls.push(resolveSegmentUrl(getBaseUrl(m3u8Url), lines[i + 1].trim()));
        }
      }
    }
    if (variantUrls.length > 0) {
      // 取最后一个（通常最高码率）
      return fetchPlaylistSegments(variantUrls[variantUrls.length - 1], false);
    }
  }

  // 媒体列表：收集分片
  const segments: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    segments.push(resolveSegmentUrl(getBaseUrl(m3u8Url), line));
  }
  if (segments.length === 0) {
    throw new Error('播放列表中没有找到分片');
  }
  return segments;
}

// 下载 m3u8 视频（合并分片为单个 mp4/ts 文件）
export async function downloadM3u8(
  m3u8Url: string,
  title: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const segments = await fetchPlaylistSegments(m3u8Url, true);

  const chunks: BlobPart[] = [];
  let downloaded = 0;

  for (let i = 0; i < segments.length; i++) {
    const response = await fetch(segments[i]);
    if (!response.ok) {
      throw new Error(`下载分片 ${i + 1}/${segments.length} 失败: HTTP ${response.status}`);
    }
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

// 普通视频直接下载
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