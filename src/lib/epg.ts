/* eslint-disable no-console */
// EPG（节目单）工具：XMLTV 抓取、解析、频道匹配、now/next 计算
// 纯正则实现，不依赖 DOMParser，可在 edge runtime 与浏览器中运行

export interface EpgProgramme {
  start: number; // ms 时间戳
  stop: number; // ms 时间戳
  title: string;
  desc?: string;
}

export interface EpgData {
  channels: Map<string, string[]>; // epg channel id -> display-names
  programmes: Map<string, EpgProgramme[]>; // epg channel id -> 节目（按 start 排序）
}

export interface EpgNowNext {
  now?: { title: string; start: number; stop: number };
  next?: { title: string; start: number; stop: number };
}

// XMLTV 时间格式：20261001010300 +0800
function parseXmltvTime(s: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/.exec(
    (s || '').trim(),
  );
  if (!m) return 0;
  const tz = m[7] || '+0000';
  const sign = tz[0] === '-' ? -1 : 1;
  const tzMin =
    sign * (parseInt(tz.slice(1, 3), 10) * 60 + parseInt(tz.slice(3, 5), 10));
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - tzMin * 60000;
}

export function parseXmltv(xml: string): EpgData {
  const channels = new Map<string, string[]>();
  const programmes = new Map<string, EpgProgramme[]>();

  const channelRe = /<channel\s+id="([^"]*)">([\s\S]*?)<\/channel>/g;
  let m: RegExpExecArray | null;
  while ((m = channelRe.exec(xml))) {
    const id = m[1];
    const names: string[] = [];
    const nameRe = /<display-name[^>]*>([^<]*)<\/display-name>/g;
    let n: RegExpExecArray | null;
    while ((n = nameRe.exec(m[2]))) {
      const name = n[1].trim();
      if (name) names.push(name);
    }
    if (names.length > 0) channels.set(id, names);
  }

  const progRe =
    /<programme\s+start="([^"]*)"\s+stop="([^"]*)"\s+channel="([^"]*)">([\s\S]*?)<\/programme>/g;
  while ((m = progRe.exec(xml))) {
    const titleM = /<title[^>]*>([^<]*)<\/title>/.exec(m[4]);
    const descM = /<desc[^>]*>([^<]*)<\/desc>/.exec(m[4]);
    const list = programmes.get(m[3]) || [];
    list.push({
      start: parseXmltvTime(m[1]),
      stop: parseXmltvTime(m[2]),
      title: titleM ? titleM[1].trim() : '',
      desc: descM ? descM[1].trim() : undefined,
    });
    programmes.set(m[3], list);
  }

  programmes.forEach((progList) => {
    progList.sort((a, b) => a.start - b.start);
  });
  return { channels, programmes };
}

// 频道名归一化：去空格/横杠/下划线/小写，便于 "CCTV-1" 与 "CCTV1" 互匹配
export function normalizeChannelName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[\s\-_·•・.．—–]/g, '')
    .replace(/^(cctv)(\d+[a-z]*)$/, '$1$2');
}

// 在 EPG 频道中按候选名查找最匹配的 epg channel id
export function findEpgChannelId(
  epg: EpgData,
  candidates: string[],
): string | null {
  const norms = candidates.map(normalizeChannelName).filter(Boolean);
  if (norms.length === 0 || epg.channels.size === 0) return null;

  // 精确匹配
  let found: string | null = null;
  epg.channels.forEach((names, id) => {
    if (found) return;
    for (const n of names) {
      if (norms.indexOf(normalizeChannelName(n)) !== -1) {
        found = id;
        return;
      }
    }
  });
  if (found) return found;
  // 包含匹配（至少 4 个字符，避免 "卫视" 这类短词误配）
  epg.channels.forEach((names, id) => {
    if (found) return;
    for (const n of names) {
      const nn = normalizeChannelName(n);
      for (const c of norms) {
        if (
          c &&
          nn &&
          Math.min(c.length, nn.length) >= 4 &&
          (nn.indexOf(c) !== -1 || c.indexOf(nn) !== -1)
        ) {
          found = id;
          return;
        }
      }
      if (found) return;
    }
  });
  return found;
}

// 二分查找当前与下一个节目
export function getNowNext(
  programmes: EpgProgramme[],
  now: number = Date.now(),
): EpgNowNext {
  if (!programmes || programmes.length === 0) return {};
  let lo = 0;
  let hi = programmes.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (programmes[mid].start <= now) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const slim = (p?: EpgProgramme) =>
    p ? { title: p.title, start: p.start, stop: p.stop } : undefined;
  if (idx < 0) return { next: slim(programmes[0]) };
  const cur = programmes[idx];
  if (now < cur.stop) {
    return { now: slim(cur), next: slim(programmes[idx + 1]) };
  }
  return { next: slim(programmes[idx + 1]) };
}

// 为一批直播频道计算 now/next（key 为频道 id）
export function buildChannelPrograms(
  epg: EpgData,
  channels: { id: string; tvgId: string; name: string }[],
  now: number = Date.now(),
): Record<string, EpgNowNext> {
  const result: Record<string, EpgNowNext> = {};
  for (const ch of channels) {
    const epgId = findEpgChannelId(epg, [ch.tvgId, ch.name]);
    if (!epgId) continue;
    const list = epg.programmes.get(epgId);
    if (!list || list.length === 0) continue;
    const nn = getNowNext(list, now);
    if (nn.now || nn.next) result[ch.id] = nn;
  }
  return result;
}

// ---- 服务端抓取（含缓存，6 小时） ----

const EPG_CACHE_TTL = 6 * 60 * 60 * 1000;
const EPG_MAX_BYTES = 15 * 1024 * 1024;
const epgCache = new Map<string, { at: number; data: EpgData }>();

export async function fetchEpgData(epgUrl: string): Promise<EpgData | null> {
  const cached = epgCache.get(epgUrl);
  if (cached && Date.now() - cached.at < EPG_CACHE_TTL) {
    return cached.data;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let response: Response;
    try {
      response = await fetch(epgUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/xml, text/xml, */*',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok || !response.body) {
      console.error(`EPG 抓取失败: HTTP ${response.status}`);
      return cached?.data || null;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      bytes += value.byteLength;
      if (bytes > EPG_MAX_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // 忽略
        }
        console.error('EPG 文件过大，已截断放弃');
        return cached?.data || null;
      }
    }
    const buf = new Uint8Array(bytes);
    let offset = 0;
    for (const c of chunks) {
      buf.set(c, offset);
      offset += c.byteLength;
    }
    const xml = new TextDecoder('utf-8').decode(buf);
    const data = parseXmltv(xml);
    epgCache.set(epgUrl, { at: Date.now(), data });
    return data;
  } catch (err) {
    console.error('EPG 抓取异常:', err);
    return cached?.data || null;
  }
}
