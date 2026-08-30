#!/usr/bin/env node
/* eslint-disable no-console */
// ============================================================
// MoonTV DLNA 投屏伴生服务器（独立进程，不参与 Next.js 构建）
//  - GET  /api/dlna/devices  扫描局域网 DLNA/UPnP 投屏设备
//  - POST /api/dlna/play     通过 SOAP 把视频推送到设备
//  - GET  /api/proxy         流媒体代理（供电视直接拉流）
//  - GET  /healthz           健康检查
// 端口默认 8899，可用环境变量 DLNA_PORT 修改
// ============================================================

'use strict';

const http = require('http');
const https = require('https');
const dgram = require('dgram');
const { URL } = require('url');

const PORT = parseInt(process.env.DLNA_PORT || '8899', 10);
const SCAN_TIMEOUT = parseInt(process.env.DLNA_SCAN_TIMEOUT || '4500', 10);
const SSDP_ADDR = '239.255.255.250';
const SSDP_PORT = 1900;
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const AV_TRANSPORT = 'urn:schemas-upnp-org:service:AVTransport:1';

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function parseHeaders(text) {
  const headers = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key && value) headers[key] = value;
  }
  return headers;
}

// SSDP 扫描：发送 M-SEARCH 组播，收集响应（约 4~5 秒）
function scanDevices(timeoutMs) {
  return new Promise((resolve) => {
    const devices = new Map();
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch (err) {
        /* ignore */
      }
      resolve(Array.from(devices.values()));
    };
    const timer = setTimeout(finish, timeoutMs);

    socket.on('error', (err) => {
      console.error('[dlna] SSDP 错误:', err.message);
      finish();
    });

    socket.on('message', (msg) => {
      const text = msg.toString('utf8');
      if (!/^HTTP\/1\.[01]\s+200/i.test(text)) return;
      const headers = parseHeaders(text);
      const location = headers.location || '';
      if (!location) return;
      const usn = headers.usn || location;
      if (!devices.has(usn)) {
        devices.set(usn, {
          location,
          usn,
          st: headers.st || '',
          server: headers.server || '',
        });
      }
    });

    const sts = [
      'urn:schemas-upnp-org:device:MediaRenderer:1',
      'urn:schemas-upnp-org:service:AVTransport:1',
      'urn:dial-multiscreen-org:service:dial:1',
      'ssdp:all',
    ];

    socket.bind(0, () => {
      for (const st of sts) {
        const msg =
          'M-SEARCH * HTTP/1.1\r\n' +
          'HOST: ' + SSDP_ADDR + ':' + SSDP_PORT + '\r\n' +
          'MAN: "ssdp:discover"\r\n' +
          'MX: 3\r\n' +
          'ST: ' + st + '\r\n\r\n';
        socket.send(msg, 0, msg.length, SSDP_PORT, SSDP_ADDR);
      }
    });
  });
}

function fetchText(urlString, timeoutMs) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (err) {
      return reject(err);
    }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: { 'User-Agent': DEFAULT_UA, Accept: '*/*' },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(new Error('HTTP ' + res.statusCode));
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('请求超时')));
  });
}

function regexFirst(source, pattern) {
  const match = source.match(pattern);
  return match && match[1] ? match[1].trim() : '';
}

function toAbsolute(baseUrl, relative) {
  if (!relative) return '';
  try {
    return new URL(relative, baseUrl).href;
  } catch (err) {
    return relative;
  }
}

// 解析设备描述 XML：提取名称、图标、AVTransport 控制地址
function parseDeviceDescription(xml, baseUrl) {
  const friendlyName = regexFirst(xml, /<friendlyName[^>]*>([\s\S]*?)<\/friendlyName>/i);
  const modelName = regexFirst(xml, /<modelName[^>]*>([\s\S]*?)<\/modelName>/i);
  const udn = regexFirst(xml, /<UDN[^>]*>([\s\S]*?)<\/UDN>/i);
  const iconUrl = regexFirst(xml, /<icon>[\s\S]*?<url[^>]*>([\s\S]*?)<\/url>/i);

  let controlUrl = '';
  const serviceBlocks = xml.match(/<service>[\s\S]*?<\/service>/gi) || [];
  for (const block of serviceBlocks) {
    const serviceType = regexFirst(block, /<serviceType[^>]*>([\s\S]*?)<\/serviceType>/i);
    const ctrl = regexFirst(block, /<controlURL[^>]*>([\s\S]*?)<\/controlURL>/i);
    if (/AVTransport/i.test(serviceType) && ctrl) {
      controlUrl = toAbsolute(baseUrl, ctrl);
      break;
    }
  }
  return {
    friendlyName,
    modelName,
    udn,
    iconUrl: toAbsolute(baseUrl, iconUrl),
    controlUrl,
    location: baseUrl,
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function soapRequest(controlUrl, serviceType, action, params) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(controlUrl);
    } catch (err) {
      return reject(new Error('设备控制地址无效'));
    }
    const body =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
      '<s:Body><u:' + action + ' xmlns:u="' + serviceType + '">' + params +
      '</u:' + action + '></s:Body></s:Envelope>';
    const headers = {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: '"' + serviceType + '#' + action + '"',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'MoonTV-DLNA/1.0',
      Connection: 'close',
    };
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(new Error('SOAP ' + action + ' 失败: HTTP ' + res.statusCode));
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('SOAP 请求超时')));
    req.write(body);
    req.end();
  });
}

// 推送视频到 DLNA 设备：SetAVTransportURI + Play
async function castToDevice(device, streamUrl, title) {
  const meta =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
    'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" ' +
    'xmlns:sec="http://www.sec.co.kr/">' +
    '<item id="0" parentID="0" restricted="1">' +
    '<dc:title>' + escapeXml(title || 'MoonTV') + '</dc:title>' +
    '<dc:creator>MoonTV</dc:creator>' +
    '<res protocolInfo="http-get:*:*:*">' + escapeXml(streamUrl) + '</res>' +
    '</item></DIDL-Lite>';

  await soapRequest(
    device.controlUrl,
    AV_TRANSPORT,
    'SetAVTransportURI',
    '<InstanceID>0</InstanceID><CurrentURI>' + escapeXml(streamUrl) +
      '</CurrentURI><CurrentURIMetaData>' + escapeXml(meta) + '</CurrentURIMetaData>',
  );
  await soapRequest(device.controlUrl, AV_TRANSPORT, 'Play', '<InstanceID>0</InstanceID><Speed>1</Speed>');
}

async function handleDevices(res) {
  try {
    const raw = await scanDevices(SCAN_TIMEOUT);
    const results = await Promise.allSettled(
      raw.slice(0, 20).map(async (device) => {
        try {
          const xml = await fetchText(device.location, 4000);
          return parseDeviceDescription(xml, device.location);
        } catch (err) {
          return null;
        }
      }),
    );
    const devices = [];
    const seen = new Set();
    for (const result of results) {
      const device = result.status === 'fulfilled' ? result.value : null;
      if (!device || !device.controlUrl) continue;
      const key = device.udn || device.friendlyName || device.location;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      devices.push(device);
    }
    json(res, 200, { devices, scanned: raw.length });
  } catch (err) {
    json(res, 500, { error: '扫描失败: ' + (err && err.message ? err.message : err) });
  }
}

function handlePlay(req, res) {
  let body = '';
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > 1024 * 1024) {
      req.destroy();
      return;
    }
    body += chunk;
  });
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      const device = payload.device || {};
      const streamUrl = payload.url || '';
      if (!device.controlUrl || !streamUrl) {
        return json(res, 400, { error: '缺少设备控制地址或视频地址' });
      }
      await castToDevice(device, streamUrl, payload.title || '');
      json(res, 200, { ok: true });
    } catch (err) {
      json(res, 502, { error: '投屏失败: ' + (err && err.message ? err.message : err) });
    }
  });
  req.on('error', () => json(res, 500, { error: '请求错误' }));
}

function handleProxy(req, res, url) {
  const target = url.searchParams.get('url');
  if (!target) return json(res, 400, { error: '缺少 url 参数' });
  const ua = url.searchParams.get('ua') || DEFAULT_UA;
  const referer = url.searchParams.get('referer') || '';
  const headers = { 'User-Agent': ua, Accept: '*/*' };
  if (referer) headers.Referer = referer;

  let lib;
  try {
    lib = new URL(target).protocol === 'https:' ? https : http;
  } catch (err) {
    return json(res, 400, { error: '地址无效' });
  }

  const upstream = lib.get(target, { headers }, (upRes) => {
    res.writeHead(upRes.statusCode || 200, {
      'Content-Type': upRes.headers['content-type'] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Transfer-Encoding': 'chunked',
    });
    upRes.pipe(res);
  });
  upstream.on('error', (err) => {
    try {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ error: '拉流失败: ' + err.message }));
    } catch (e) {
      /* ignore */
    }
  });
  upstream.setTimeout(30000, () => {
    try {
      upstream.destroy(new Error('拉流超时'));
    } catch (e) {
      /* ignore */
    }
  });
  req.on('close', () => {
    try {
      upstream.destroy();
    } catch (e) {
      /* ignore */
    }
  });
}


// ============================================================
// 直播中转：m3u8 播放列表重写 + 资源透传
// 在 Cloudflare Pages（https）上无法直接播放国内 http 源时，
// 可把本服务跑在电脑/局域网设备上，并通过 https 隧道（如
// cloudflared）暴露，前端把“中转服务地址”填成该 https 地址。
// ============================================================
function getPlaylistBase(urlString) {
  try {
    const u = new URL(urlString);
    const pathname = u.pathname;
    const idx = pathname.lastIndexOf('/');
    return u.origin + (idx >= 0 ? pathname.slice(0, idx + 1) : '/');
  } catch (err) {
    return urlString.endsWith('/') ? urlString : urlString + '/';
  }
}

function resolveRelayUrl(baseUrl, relativePath) {
  try {
    if (/^https?:\/\//i.test(relativePath)) return relativePath;
    if (relativePath.startsWith('//')) {
      return new URL(baseUrl).protocol + relativePath;
    }
    return new URL(relativePath, baseUrl).href;
  } catch (err) {
    return relativePath;
  }
}

function buildProxiedUrl(target, playlistBase, proxyPath, params) {
  const absolute = resolveRelayUrl(playlistBase, target);
  const search = new URLSearchParams({ url: absolute });
  if (params.ua) search.set('ua', params.ua);
  if (params.referer) search.set('referer', params.referer);
  return proxyPath + '?' + search.toString();
}

function rewritePlaylist(text, playlistBase, proxyPath, params) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    if (trimmed.startsWith('#EXT-X-STREAM-INF:')) {
      out.push(line);
      const variant = lines[i + 1] ? lines[i + 1].trim() : '';
      if (variant && !variant.startsWith('#')) {
        out.push(buildProxiedUrl(variant, playlistBase, proxyPath, params));
        i++;
      }
      continue;
    }
    if (
      trimmed.startsWith('#EXT-X-KEY:') ||
      trimmed.startsWith('#EXT-X-MAP:') ||
      trimmed.startsWith('#EXT-X-MEDIA:')
    ) {
      out.push(
        trimmed.replace(/URI="([^"]*)"/g, (m, uri) =>
          'URI="' + buildProxiedUrl(uri, playlistBase, proxyPath, params) + '"'
        ),
      );
      continue;
    }
    if (trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }
    out.push(buildProxiedUrl(trimmed, playlistBase, proxyPath, params));
  }
  return out.join('\n');
}

function handleLiveProxy(req, res, url) {
  const target = url.searchParams.get('url');
  if (!target) return json(res, 400, { error: '缺少 url 参数' });
  const ua = url.searchParams.get('ua') || DEFAULT_UA;
  const referer = url.searchParams.get('referer') || '';
  const headers = { 'User-Agent': ua, Accept: '*/*' };
  let refererValue = referer;
  try {
    refererValue = referer || new URL(target).origin;
  } catch (err) {
    // 忽略
  }
  if (refererValue) headers.Referer = refererValue;
  const range = req.headers.range;
  if (range) headers.Range = range;

  let lib;
  try {
    lib = new URL(target).protocol === 'https:' ? https : http;
  } catch (err) {
    return json(res, 400, { error: '地址无效' });
  }

  const upstream = lib.get(target, { headers }, (upRes) => {
    const contentType = upRes.headers['content-type'] || '';
    const isPlaylist =
      /\.m3u8?($|\?)/i.test(target) ||
      /mpegurl|apple|vnd\.apple|audio\/x-mpeg/i.test(contentType);
    if (!isPlaylist || upRes.statusCode !== 200) {
      res.writeHead(upRes.statusCode || 200, {
        'Content-Type': contentType || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Range',
        'Cache-Control': 'no-store',
        'Transfer-Encoding': 'chunked',
      });
      upRes.pipe(res);
      return;
    }
    let text = '';
    upRes.setEncoding('utf8');
    upRes.on('data', (chunk) => (text += chunk));
    upRes.on('end', () => {
      const playlistBase = getPlaylistBase(target);
      const rewritten = rewritePlaylist(text, playlistBase, '/api/live/proxy', {
        ua,
        referer: refererValue,
      });
      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      });
      res.end(rewritten);
    });
    upRes.on('error', () => {
      try {
        res.destroy();
      } catch (err) {
        // 忽略
      }
    });
  });
  upstream.on('error', (err) => {
    try {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ error: '中转拉流失败: ' + err.message }));
    } catch (e) {
      // 忽略
    }
  });
  upstream.setTimeout(30000, () => {
    try {
      upstream.destroy(new Error('中转拉流超时'));
    } catch (e) {
      // 忽略
    }
  });
  req.on('close', () => {
    try {
      upstream.destroy();
    } catch (e) {
      // 忽略
    }
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }
  if (req.method === 'GET' && url.pathname === '/healthz') {
    return json(res, 200, { ok: true, service: 'dlna', port: PORT });
  }
  if (req.method === 'GET' && url.pathname === '/api/dlna/devices') {
    return handleDevices(res);
  }
  if (req.method === 'GET' && url.pathname === '/api/proxy') {
    return handleProxy(req, res, url);
  }
  if (req.method === 'GET' && url.pathname === '/api/live/proxy') {
    return handleLiveProxy(req, res, url);
  }
  if (req.method === 'POST' && url.pathname === '/api/dlna/play') {
    return handlePlay(req, res);
  }
  json(res, 404, { error: 'Not Found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('[dlna] DLNA 投屏服务已启动: http://0.0.0.0:' + PORT);
});
server.on('error', (err) => {
  console.error('[dlna] 服务启动失败:', err.message);
  process.exit(1);
});
