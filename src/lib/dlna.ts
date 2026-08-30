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

// 获取投屏服务器地址（默认与本站点同主机，端口 7777）
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

// 将相对地址（如 /api/live/play/...）转为电视可访问的绝对地址
export function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (typeof window === 'undefined') return pathOrUrl;
  return new URL(pathOrUrl, window.location.origin).href;
}
