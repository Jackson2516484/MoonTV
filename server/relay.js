/**
 * MoonTV 直播转播中转（relay）—— 让网页播放体验接近 APTV 的关键组件
 *
 * 背景：IPTV 的 /udp/ 组播桥接是裸 MPEG-TS 流，原生 App（APTV 等）用系统
 * 播放器直连就能播；浏览器没有 TS 解码能力，只能靠 JS 软解（mpegts.js），
 * 且经 Cloudflare 代理绕行后带宽/抖动都吃紧，所以网页端必然卡顿甚至黑屏。
 *
 * 本服务做的事：在离用户近的一台机器（家里的电脑/NAS/小主机/服务器）上，
 * 用 ffmpeg 把 TS 流实时转封装成 HLS（-c copy 只换容器、不转码，CPU 占用
 * 极低），浏览器/iPhone/电视 WebView 全部能原生播放 HLS，效果与 APTV 一致。
 *
 * 用法：
 *   1. 机器上装好 ffmpeg（ffmpeg -version 能跑即可）
 *   2. node server/relay.js         （默认端口 8898，可用 PORT 覆盖）
 *   3. 在 MoonTV 直播页右上角「中转」里填本服务的地址：
 *      - MoonTV App 内（已允许明文流量）：http://<这台机器局域网IP>:8898
 *      - 网页版（https 站点禁止直连 http 局域网地址）：先给本服务套一层
 *        https 隧道：cloudflared tunnel --url http://localhost:8898
 *        把它给出的 https://*.trycloudflare.com 地址填进去即可。
 *      之后 TS 频道自动优先走本中转的 HLS，清爽播放；m3u8 频道不受影响。
 *
 * 接口：
 *   GET /hls?url=<TS流地址>     返回该频道的 HLS 播放列表（按需拉起 ffmpeg）
 *   GET /hls/<会话>/<分片>.ts   HLS 分片
 *   GET /api/live/proxy?url=    原样透传代理（兼容旧中转候选逻辑）
 *   GET /health                 健康检查
 *
 * 会话按源地址哈希复用；60 秒无人请求自动结束 ffmpeg 进程并清理文件。
 * 仅供家庭内自用：无鉴权，请只在可信网络内开放，不要直接暴露到公网。
 */
'use strict';

const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = parseInt(process.env.PORT || '8898', 10);
const IDLE_MS = 60 * 1000;
const TMP_ROOT = path.join(os.tmpdir(), 'moontv-relay');

const sessions = new Map(); // key -> {dir, proc, lastAccess, ready:Promise}

function keyFor(url) {
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
}

function startSession(key, url) {
  const dir = path.join(TMP_ROOT, key);
  // 清掉上一会话的残留文件：否则新会话启动前会先读到旧播放列表，
  // 表现为画面时间错乱/窗口不前进
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const args = [
    '-hide_banner', '-loglevel', 'warning',
    '-rw_timeout', '15000000',
    '-i', url,
    '-c', 'copy',
    '-f', 'hls',
    '-hls_time', '4',
    '-hls_list_size', '8',
    '-hls_flags', 'delete_segments+omit_endlist+independent_segments',
    '-hls_segment_filename', path.join(dir, 'seg_%06d.ts'),
    path.join(dir, 'index.m3u8'),
  ];
  const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let errTail = '';
  proc.stderr.on('data', (d) => {
    errTail = (errTail + d.toString()).slice(-2000);
  });
  const session = {
    dir,
    proc,
    lastAccess: Date.now(),
    startedAt: Date.now(),
    dead: false,
  };
  proc.on('exit', (code) => {
    session.dead = true;
    if (code && code !== 0) {
      console.error(`[relay] ffmpeg 退出 code=${code} url=${url}\n${errTail}`);
    }
  });
  sessions.set(key, session);
  return session;
}

function getSession(url) {
  const key = keyFor(url);
  let s = sessions.get(key);
  if (!s || s.dead) {
    s = startSession(key, url);
  }
  s.lastAccess = Date.now();
  return { key, session: s };
}

// 等播放列表出现（ffmpeg 拉流+首个分片通常 2~6 秒）
function waitPlaylist(session, timeoutMs = 15000) {
  const file = path.join(session.dir, 'index.m3u8');
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      let fresh = false;
      try {
        fresh =
          fs.existsSync(file) &&
          fs.statSync(file).mtimeMs >= session.startedAt - 1000;
      } catch (e) {
        fresh = false;
      }
      if (session.dead) {
        clearInterval(timer);
        reject(new Error('上游流连接失败（ffmpeg 已退出，源可能不可达）'));
      } else if (fresh) {
        clearInterval(timer);
        resolve(file);
      } else if (Date.now() - t0 > timeoutMs) {
        clearInterval(timer);
        reject(new Error('等待上游流超时'));
      }
    }, 250);
  });
}

// 空闲会话回收
setInterval(() => {
  const now = Date.now();
  for (const [key, s] of sessions) {
    if (now - s.lastAccess > IDLE_MS) {
      try { s.proc.kill('SIGTERM'); } catch (e) { /* 忽略 */ }
      sessions.delete(key);
      fs.rm(s.dir, { recursive: true, force: true }).catch(() => {});
      console.log(`[relay] 回收空闲会话 ${key}`);
    }
  }
}, 15000).unref();

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const u = new URL(req.url, 'http://relay.local');

  if (u.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, sessions: sessions.size }));
    return;
  }

  // HLS 播放列表：/hls?url=<encoded>
  if (u.pathname === '/hls') {
    const target = u.searchParams.get('url');
    if (!target) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('missing url');
      return;
    }
    try {
      const { key, session } = getSession(target);
      const file = await waitPlaylist(session);
      // 把分片引用改写为 /hls/<key>/<file>，便于静态分发
      let body = fs.readFileSync(file, 'utf-8');
      body = body.replace(/^(seg_\d+\.ts)$/gm, `/hls/${key}/$1`);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache',
      });
      res.end(body);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(err.message || err));
    }
    return;
  }

  // HLS 分片：/hls/<key>/seg_000001.ts
  const segMatch = u.pathname.match(/^\/hls\/([0-9a-f]{16})\/(seg_\d+\.ts)$/);
  if (segMatch) {
    const s = sessions.get(segMatch[1]);
    if (s) s.lastAccess = Date.now();
    const file = path.join(TMP_ROOT, segMatch[1], segMatch[2]);
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('segment not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'video/mp2t',
        'Cache-Control': 'public, max-age=30',
      });
      res.end(data);
    });
    return;
  }

  // 兼容旧逻辑的透传代理：/api/live/proxy?url=
  if (u.pathname === '/api/live/proxy') {
    const target = u.searchParams.get('url');
    if (!target) {
      res.writeHead(400);
      res.end('missing url');
      return;
    }
    try {
      const upstream = await fetch(target, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'follow',
      });
      res.writeHead(upstream.status, {
        'Content-Type':
          upstream.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      if (!upstream.body) {
        res.end();
        return;
      }
      const reader = upstream.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(err.message || err));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[relay] MoonTV 直播转播中转已启动: http://0.0.0.0:${PORT}`);
  console.log('[relay] 在 MoonTV 直播页「中转」里填这台机器的地址即可，例如 http://192.168.1.10:' + PORT);
});
