// DLNA 投屏客户端工具：调用伴生服务器（server/dlna.js，默认端口 7777）
// 通过 http://<本机IP>:7777 提供服务，用于扫描局域网设备并推送视频

export interface DlnaDevice {
  friendlyName: string;
  modelName: string;
  udn: string;
  iconUrl: string;
  controlUrl: string;
  location: string;
}

const DLNA_BASE_KEY = 'moontv_dlna_base';
const LIVE_RELAY_KEY = 'moontv_live_relay';

// 获取投屏服务器地址（默认与本站点同主机，端口 8899）
export function getDlnaServerBase(): string {
  if (typeof window === 'undefined') return 'http://localhost:8899';
  try {
    const saved = window.localStorage.getItem(DLNA_BASE_KEY);
    if (saved) return saved.replace(/\/+$/, '');
  } catch (err) {
    // 忽略
  }
  const host = window.location.hostname || 'localhost';
  return `http://${host}:8899`;
}

export function setDlnaServerBase(base: string): void {
  if (typeof window === 'undefined') return;
  const cleaned = (base || '').trim().replace(/\/+$/, '');
  if (cleaned) {
    window.localStorage.setItem(DLNA_BASE_KEY, cleaned);
  } else {
    window.localStorage.removeItem(DLNA_BASE_KEY);
  }
}

// 扫描局域网 DLNA 设备
export async function scanDlnaDevices(): Promise<DlnaDevice[]> {
  const res = await fetch(`${getDlnaServerBase()}/api/dlna/devices`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`投屏服务不可用 (HTTP ${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data.devices) ? data.devices : [];
}

// 把视频推送到指定设备
export async function castToDlnaDevice(
  device: DlnaDevice,
  streamUrl: string,
  title: string,
): Promise<void> {
  const res = await fetch(`${getDlnaServerBase()}/api/dlna/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, url: streamUrl, title }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data && (data as any).error) || `投屏失败: HTTP ${res.status}`);
  }
}

// 直播中转服务地址（本地伴生服务，用于播放国内 http 源；Cloudflare 部署时可配合 https 隧道）
export function getLiveRelayBase(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = window.localStorage.getItem(LIVE_RELAY_KEY);
    return saved ? saved.replace(/\/+$/, '') : '';
  } catch (err) {
    return '';
  }
}

export function setLiveRelayBase(base: string): void {
  if (typeof window === 'undefined') return;
  const cleaned = (base || '').trim().replace(/\/+$/, '');
  if (cleaned) {
    window.localStorage.setItem(LIVE_RELAY_KEY, cleaned);
  } else {
    window.localStorage.removeItem(LIVE_RELAY_KEY);
  }
}

// 生成直播播放地址：设置了中转服务时走伴生服务（可访问国内 http 源），否则走本站边缘代理
export function getLivePlaybackProxyUrl(url: string, ua?: string): string {
  const params = new URLSearchParams({ url });
  if (ua) params.set('ua', ua);
  const relay = getLiveRelayBase();
  if (relay) {
    return `${relay}/api/live/proxy?${params.toString()}`;
  }
  return `/api/live/play/stream.m3u8?${params.toString()}`;
}

// 将相对地址（如 /api/live/play/...）转为电视可访问的绝对地址
export function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (typeof window === 'undefined') return pathOrUrl;
  return new URL(pathOrUrl, window.location.origin).href;
}
