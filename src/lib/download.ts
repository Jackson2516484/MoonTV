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

// 是否运行在 Capacitor 原生 App 内
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return Boolean(cap && cap.isNativePlatform && cap.isNativePlatform());
}

// Blob 转 Base64（供 Capacitor Filesystem 写入）
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(blob);
  });
}

// 在 App / 网页中把 Blob 保存到本地
async function saveBlobToDevice(blob: Blob, filename: string): Promise<void> {
  if (isNativeApp()) {
    try {
      const cap = (window as any).Capacitor;
      const base64 = await blobToBase64(blob);
      await cap.Plugins.Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: cap.Plugins.Filesystem.Directory.Documents,
        recursive: true,
      });
      // 尝试通过系统分享面板让用户保存/发送（部分系统支持）
      try {
        const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return;
        }
      } catch (shareErr) {
        // 分享取消或失败时文件已保存在 Documents，继续提示路径
      }
      console.log(`文件已保存到 App 文档目录: ${filename}`);
      return;
    } catch (err) {
      console.error('App 内保存失败，回退到网页下载:', err);
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
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
  await saveBlobToDevice(blob, `${title}.ts`);
}

// 经服务端代理下载单个文件（规避 CORS / 混合内容 / 防盗链）
export async function downloadFileViaProxy(
  url: string,
  title: string,
): Promise<void> {
  const referer = getReferer(url);
  const response = await fetchWithRetry(
    getDownloadProxyUrl(url, referer, 'raw'),
  );
  const contentType = response.headers.get('content-type') || '';
  const buffer = await response.arrayBuffer();
  const blob = new Blob([buffer], { type: contentType || 'video/mp4' });
  const ext = /mpegurl|apple/i.test(contentType) ? 'm3u8' : 'ts';
  await saveBlobToDevice(blob, `${title}.${ext}`);
}

// 普通视频直接下载（浏览器导航下载，不受 CORS 限制）
export async function downloadDirect(url: string, title: string): Promise<void> {
  // App 内或混合内容（https 页面加载 http 资源）时走服务端代理
  const isMixed =
    typeof location !== 'undefined' &&
    location.protocol === 'https:' &&
    url.startsWith('http://');
  if (isNativeApp() || isMixed) {
    await downloadFileViaProxy(url, title);
    return;
  }
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

// 录制当前正在播放的视频（直播下载）：通过 MediaRecorder 录制一段时间
export async function recordVideoElement(
  video: HTMLVideoElement,
  title: string,
  seconds = 30,
  onProgress?: (secondsLeft: number) => void,
): Promise<void> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('当前环境不支持录制');
  }
  const captureStream = (video as any).captureStream;
  if (typeof captureStream !== 'function') {
    throw new Error('当前环境不支持录制视频元素');
  }
  const stream: MediaStream = captureStream.call(video);
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  const mimeType =
    candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const recorder = new MediaRecorder(
    stream,
    mimeType ? ({ mimeType } as any) : undefined,
  );
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error('录制失败'));
  });
  recorder.start(1000);
  const startTime = Date.now();
  const timer = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    onProgress?.(Math.max(0, seconds - elapsed));
    if (elapsed >= seconds) {
      window.clearInterval(timer);
      try {
        recorder.stop();
      } catch (err) {
        // 忽略
      }
    }
  }, 1000);
  await stopped;
  window.clearInterval(timer);
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
  if (blob.size === 0) {
    throw new Error('录制结果为空，请确认视频正在播放');
  }
  await saveBlobToDevice(blob, `${title}.${ext}`);
}

// 边下边存直播直链流（录制固定时长，适合 udp/ts/flv 等无限直播流）
export async function downloadLiveDirect(
  url: string,
  title: string,
  seconds = 30,
  onProgress?: (secondsLeft: number) => void,
): Promise<void> {
  const referer = getReferer(url);
  const response = await fetch(getDownloadProxyUrl(url, referer, 'raw'), {
    cache: 'no-store',
  });
  if (!response.ok || !response.body) {
    throw new Error(`获取直播流失败: HTTP ${response.status}`);
  }
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let bytes = 0;
  const startTime = Date.now();
  const maxBytes = 80 * 1024 * 1024;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      bytes += value.byteLength;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      onProgress?.(Math.max(0, seconds - elapsed));
      if (elapsed >= seconds || bytes >= maxBytes) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch (err) {
      // 忽略
    }
  }
  const blob = new Blob(chunks, { type: 'video/mp2t' });
  if (blob.size === 0) {
    throw new Error('下载结果为空，请确认直播流可访问');
  }
  await saveBlobToDevice(blob, `${title}.ts`);
}
