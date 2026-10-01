/* eslint-disable no-console */

import { isMp4Data, TsToMp4Converter } from './remux';

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

// 下载 m3u8 视频：下载完整剧集的所有分片，转封装为 MP4 后保存
// （分片经服务端代理拉取，规避 CORS / 防盗链 / 混合内容限制）
// TS 分片经 mux.js 转封装为 fMP4（只换容器不重编码）；已是 MP4 的分片直接拼接。
// 6 并发下载 + 按序处理；支持 File System Access API 时边转边写磁盘，大文件不爆内存。
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
  const initSegmentUrl: string | null =
    typeof data.initSegment === 'string' ? data.initSegment : null;

  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'video';
  const filename = `${safeTitle}.mp4`;
  const total = segments.length;

  // 2. 尝试流式落盘（Chrome / Edge）：边转边写，不占用大量内存
  const w = window as unknown as {
    showSaveFilePicker?: (opts: unknown) => Promise<{
      createWritable: () => Promise<{
        write: (data: Uint8Array) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };
  let writer: {
    write: (data: Uint8Array) => Promise<void>;
    close: () => Promise<void>;
  } | null = null;
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'MP4 视频',
            accept: { 'video/mp4': ['.mp4'] },
          },
        ],
      });
      writer = await handle.createWritable();
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new Error('已取消保存');
      }
      writer = null; // 回退到内存 Blob 方案
    }
  }

  // 写队列：保证落盘顺序（转封装回调是同步触发的，写入需串行）
  const memChunks: BlobPart[] = [];
  let writeChain: Promise<void> = Promise.resolve();
  const enqueueWrite = (chunk: Uint8Array): Promise<void> => {
    if (writer) {
      const w2 = writer;
      writeChain = writeChain.then(() => w2.write(chunk));
      return writeChain;
    }
    memChunks.push(chunk as Uint8Array<ArrayBuffer>);
    return Promise.resolve();
  };

  // 3. 下载首个分片，嗅探容器类型决定是否转封装
  const firstBuffer = await (
    await fetchWithRetry(segments[0])
  ).arrayBuffer();
  const firstU8 = new Uint8Array(firstBuffer);
  const converter = isMp4Data(firstU8) ? null : new TsToMp4Converter();
  if (converter) {
    converter.onData = (chunk) => {
      void enqueueWrite(chunk);
    };
  }
  onProgress?.(1, total);

  // fMP4 播放列表：先写入初始化段
  if (!converter && initSegmentUrl) {
    const initBuffer = await (
      await fetchWithRetry(initSegmentUrl)
    ).arrayBuffer();
    await enqueueWrite(new Uint8Array(initBuffer));
  }

  // 4. 并发下载剩余分片，按序号有序处理
  const CONCURRENCY = 6;
  const pending = new Map<number, Uint8Array>();
  let nextIndex = 1; // 首个分片已下载
  let writeIndex = 0;
  let done = 1;

  const handleSegment = async (index: number, buf: Uint8Array) => {
    if (converter) {
      converter.push(buf);
    } else {
      await enqueueWrite(buf);
    }
  };

  const flush = async () => {
    while (pending.has(writeIndex)) {
      const buf = pending.get(writeIndex) as Uint8Array;
      pending.delete(writeIndex);
      await handleSegment(writeIndex, buf);
      writeIndex++;
    }
  };

  // 首个分片先进入处理流水线
  await handleSegment(0, firstU8);
  writeIndex = 1;

  const worker = async () => {
    for (;;) {
      const i = nextIndex++;
      if (i >= total) break;
      const response = await fetchWithRetry(segments[i]);
      const buffer = await response.arrayBuffer();
      pending.set(i, new Uint8Array(buffer));
      done++;
      onProgress?.(done, total);
      await flush();
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()),
    );
    await flush();
    if (converter) {
      converter.flush();
      if (!converter.hasOutput) {
        throw new Error('转封装失败：该视频源可能使用了特殊编码');
      }
    }
    await writeChain;
  } catch (err) {
    try {
      await writer?.close();
    } catch {
      // 忽略
    }
    throw err;
  }

  if (writer) {
    await writer.close();
    return;
  }
  const blob = new Blob(memChunks, { type: 'video/mp4' });
  if (blob.size === 0) {
    throw new Error('下载结果为空');
  }
  await saveBlobToDevice(blob, filename);
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
  const isMixed =
    typeof location !== 'undefined' &&
    location.protocol === 'https:' &&
    url.startsWith('http://');

  if (isNativeApp()) {
    // App 内（已开启 cleartext）：优先 fetch 直连保存；CORS 受限时交给系统下载管理器（不依赖 CORS）
    try {
      const response = await fetch(url);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || '';
        const blob = new Blob([buffer], { type: contentType || 'video/mp4' });
        await saveBlobToDevice(blob, title);
        return;
      }
    } catch (err) {
      // 直连失败，继续回退
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = title;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // 混合内容（https 页面加载 http 资源）时走服务端代理
  if (isMixed) {
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
  directUrl?: string,
): Promise<void> {
  const referer = getReferer(url);
  let response: Response | null = null;
  try {
    const res = await fetch(getDownloadProxyUrl(url, referer, 'raw'), {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    response = res;
  } catch (err) {
    // 代理失败（如 Cloudflare 边缘无法访问国内源）时尝试直连原始地址
    if (directUrl) {
      const direct = await fetch(directUrl, { cache: 'no-store' });
      if (direct.ok) {
        response = direct;
      }
    }
    if (!response) {
      throw new Error(
        err instanceof Error ? err.message : '获取直播流失败',
      );
    }
  }
  if (!response.body) {
    throw new Error('获取直播流失败: 无响应内容');
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

// ---- 可随时停止的录制（新 API） ----

// 直播流录制句柄：边录边写磁盘（支持时），stop() 触发保存
export interface LiveRecording {
  stop: () => Promise<void>;
  readonly bytes: number;
  readonly seconds: number;
}

// 开始录制直播流（经服务端代理，失败回退直连）。返回后即开始写入，
// 调用 stop() 结束并保存；浏览器支持 File System Access API 时流式落盘。
export async function startLiveRecording(
  url: string,
  title: string,
  opts: {
    onProgress?: (seconds: number, bytes: number) => void;
    directUrl?: string;
    maxBytes?: number;
  } = {},
): Promise<LiveRecording> {
  const referer = getReferer(url);
  let response: Response | null = null;
  try {
    const res = await fetch(getDownloadProxyUrl(url, referer, 'raw'), {
      cache: 'no-store',
    });
    if (res.ok) response = res;
  } catch (err) {
    // 忽略，走直连回退
  }
  if (!response && opts.directUrl) {
    try {
      const direct = await fetch(opts.directUrl, { cache: 'no-store' });
      if (direct.ok) response = direct;
    } catch (err) {
      // 忽略
    }
  }
  if (!response || !response.body) {
    throw new Error('获取直播流失败');
  }

  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'live';
  const filename = `${safeTitle}.mp4`;
  const maxBytes = opts.maxBytes ?? 800 * 1024 * 1024;

  const w = window as unknown as {
    showSaveFilePicker?: (opts: unknown) => Promise<{
      createWritable: () => Promise<{
        write: (data: Uint8Array) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };
  let writer: {
    write: (data: Uint8Array) => Promise<void>;
    close: () => Promise<void>;
  } | null = null;
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'MP4 视频',
            accept: { 'video/mp4': ['.mp4'] },
          },
        ],
      });
      writer = await handle.createWritable();
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new Error('已取消保存');
      }
      writer = null;
    }
  }

  // 写队列：保证落盘顺序
  const memChunks: BlobPart[] = [];
  let writeChain: Promise<void> = Promise.resolve();
  const enqueueWrite = (chunk: Uint8Array): void => {
    if (writer) {
      const w2 = writer;
      writeChain = writeChain.then(() => w2.write(chunk));
    } else {
      memChunks.push(chunk as Uint8Array<ArrayBuffer>);
    }
  };

  // 嗅探首个数据块：TS 流则转封装为 MP4，否则原样保存
  let converter: TsToMp4Converter | null = null;
  let sniffed = false;
  const feedChunk = (value: Uint8Array) => {
    if (!sniffed) {
      sniffed = true;
      if (!isMp4Data(value)) {
        converter = new TsToMp4Converter();
        converter.onData = (chunk) => enqueueWrite(chunk);
      }
    }
    if (converter) {
      converter.push(value);
    } else {
      enqueueWrite(value);
    }
  };

  const reader = response.body.getReader();
  const startTime = Date.now();
  let bytes = 0;
  let stopped = false;

  const pump = (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || stopped) break;
        if (value && value.byteLength > 0) {
          bytes += value.byteLength;
          feedChunk(value);
        }
        opts.onProgress?.(Math.floor((Date.now() - startTime) / 1000), bytes);
        if (bytes >= maxBytes) break;
      }
    } catch (err) {
      // 读取中断（用户停止或网络断开），按已录内容保存
    } finally {
      try {
        await reader.cancel();
      } catch (err) {
        // 忽略
      }
    }
  })();

  const stop = async () => {
    stopped = true;
    try {
      await reader.cancel();
    } catch (err) {
      // 忽略
    }
    await pump;
    if (converter) {
      converter.flush();
    }
    await writeChain;
    if (writer) {
      await writer.close();
      return;
    }
    const blob = new Blob(memChunks, { type: 'video/mp4' });
    if (blob.size === 0) {
      throw new Error('录制结果为空');
    }
    await saveBlobToDevice(blob, filename);
  };

  return {
    stop,
    get bytes() {
      return bytes;
    },
    get seconds() {
      return Math.floor((Date.now() - startTime) / 1000);
    },
  };
}

// 播放器画面录制句柄（MediaRecorder，可随时停止）
export interface ElementRecording {
  stop: () => Promise<void>;
}

export function startElementRecording(
  video: HTMLVideoElement,
  title: string,
  onProgress?: (seconds: number) => void,
): ElementRecording {
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
  recorder.start(1000);

  const startTime = Date.now();
  const timer = window.setInterval(() => {
    onProgress?.(Math.floor((Date.now() - startTime) / 1000));
  }, 1000);

  let stopped = false;
  const stop = () =>
    new Promise<void>((resolve, reject) => {
      if (stopped) {
        resolve();
        return;
      }
      stopped = true;
      window.clearInterval(timer);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
        if (blob.size === 0) {
          reject(new Error('录制结果为空，请确认视频正在播放'));
          return;
        }
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const safeTitle =
          title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'live';
        saveBlobToDevice(blob, `${safeTitle}.${ext}`)
          .then(() => resolve())
          .catch(reject);
      };
      recorder.onerror = () => reject(new Error('录制失败'));
      try {
        recorder.stop();
      } catch (err) {
        reject(err instanceof Error ? err : new Error('录制失败'));
      }
    });

  return { stop };
}
