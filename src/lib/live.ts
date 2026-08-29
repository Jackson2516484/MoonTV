/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

export interface LiveChannel {
  id: string;
  tvgId: string;
  name: string;
  logo: string;
  group: string;
  url: string;
}

export interface LiveSource {
  key: string;
  name: string;
  url: string; // m3u 地址
  ua?: string;
  epg?: string; // 节目单
  from: 'config' | 'custom';
  channelNumber?: number;
  disabled?: boolean;
  channels?: LiveChannel[]; // 文件导入时内嵌的频道列表
}

// 解析 M3U 内容为频道列表
export function isM3UContent(content: string): boolean {
  const firstLine = content.split('\n')[0] || '';
  return firstLine.startsWith('#EXTM3U') || content.includes('#EXTINF:');
}

export function parseM3U(
  sourceKey: string,
  content: string
): { tvgUrl: string; channels: LiveChannel[] } {
  const lines = content.split(/\r?\n/);
  let tvgUrl = '';
  const channels: LiveChannel[] = [];
  let channelIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 跳过空行
    if (!line) continue;

    // 检查是否为 #EXTM3U 行，从中提取 tvg-url
    if (line.startsWith('#EXTM3U')) {
      const tvgUrlMatch = line.match(/tvg-url="([^"]*)"/);
      if (tvgUrlMatch) {
        tvgUrl = tvgUrlMatch[1];
      }
      continue;
    }

    // 检查是否为 #EXTINF 行
    if (line.startsWith('#EXTINF:')) {
      // 提取 tvg-id
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      let tvgId = tvgIdMatch ? tvgIdMatch[1] : '';

      // 提取 tvg-name
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgName = tvgNameMatch ? tvgNameMatch[1] : '';

      // 提取 tvg-logo
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const logo = tvgLogoMatch ? tvgLogoMatch[1] : '';

      // 提取 group-title
      const groupTitleMatch = line.match(/group-title="([^"]*)"/);
      const group = groupTitleMatch ? groupTitleMatch[1] : '未分组';

      // 提取标题（#EXTINF 行最后的逗号后面的内容）
      const titleMatch = line.match(/,([^,]*)$/);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // 优先使用 tvg-name，如果没有则使用标题
      const name = title || tvgName || '';

      // 如果 tvg-id 为空，使用 tvg-name 或频道名称作为备用
      if (!tvgId) {
        tvgId = tvgName || name;
      }

      // 检查下一行是否是URL
      if (i + 1 < lines.length && !lines[i + 1].trim().startsWith('#')) {
        const url = lines[i + 1].trim();

        // 只有有名称和URL时才添加到结果中
        if (name && url) {
          channels.push({
            id: `${sourceKey}-${channelIndex}`,
            tvgId,
            name,
            logo,
            group,
            url,
          });
          channelIndex++;
        }

        // 跳过下一行，因为已经处理了
        i++;
      }
    }
  }

  return { tvgUrl, channels };
}

// 解析纯文本直播列表（每行一个"频道名,url"）
export function parseTxtLive(
  sourceKey: string,
  content: string
): { tvgUrl: string; channels: LiveChannel[] } {
  const lines = content.split(/\r?\n/);
  const channels: LiveChannel[] = [];
  let channelIndex = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const commaIndex = line.indexOf(',');
    if (commaIndex <= 0) continue;
    const name = line.slice(0, commaIndex).trim();
    const url = line.slice(commaIndex + 1).trim();
    if (name && url) {
      channels.push({
        id: `${sourceKey}-${channelIndex}`,
        tvgId: name,
        name,
        logo: '',
        group: '未分组',
        url,
      });
      channelIndex++;
    }
  }

  return { tvgUrl: '', channels };
}

// 解析频道内容（自动识别 M3U / TXT）
export function parseLiveContent(
  sourceKey: string,
  content: string
): { tvgUrl: string; channels: LiveChannel[] } {
  if (isM3UContent(content)) {
    return parseM3U(sourceKey, content);
  }
  return parseTxtLive(sourceKey, content);
}

// 解析 M3U8 的 base URL
export function getBaseUrl(m3u8Url: string) {
  try {
    const url = new URL(m3u8Url);
    if (url.pathname.endsWith('.m3u8')) {
      url.pathname = url.pathname.substring(
        0,
        url.pathname.lastIndexOf('/') + 1
      );
    } else if (!url.pathname.endsWith('/')) {
      url.pathname += '/';
    }
    return url.protocol + '//' + url.host + url.pathname;
  } catch (error) {
    return m3u8Url.endsWith('/') ? m3u8Url : m3u8Url + '/';
  }
}

// 解析相对 URL 为绝对 URL
export function resolveUrl(baseUrl: string, relativePath: string) {
  try {
    if (
      relativePath.startsWith('http://') ||
      relativePath.startsWith('https://')
    ) {
      return relativePath;
    }

    if (relativePath.startsWith('//')) {
      const baseUrlObj = new URL(baseUrl);
      return `${baseUrlObj.protocol}${relativePath}`;
    }

    const baseUrlObj = new URL(baseUrl);
    const resolvedUrl = new URL(relativePath, baseUrlObj);
    return resolvedUrl.href;
  } catch (error) {
    // 降级处理
    if (
      relativePath.startsWith('http://') ||
      relativePath.startsWith('https://')
    ) {
      return relativePath;
    }
    let base = baseUrl;
    if (!base.endsWith('/')) {
      base = base.substring(0, base.lastIndexOf('/') + 1);
    }
    return base + relativePath;
  }
}

// 将相对频道 URL 转为绝对 URL（基于 m3u 地址）
export function normalizeChannelUrls(
  channels: LiveChannel[],
  baseM3uUrl: string
): LiveChannel[] {
  return channels.map((channel) => {
    if (
      channel.url.startsWith('http://') ||
      channel.url.startsWith('https://')
    ) {
      return channel;
    }
    return { ...channel, url: resolveUrl(baseM3uUrl, channel.url) };
  });
}