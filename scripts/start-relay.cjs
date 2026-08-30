#!/usr/bin/env node
/* eslint-disable no-console */
// 一键启动本地伴生服务（直播中转 + DLNA 投屏）+ cloudflared https 隧道
// 用法：node scripts/start-relay.cjs
// 启动后在终端里保持运行；把输出的 https://xxx.trycloudflare.com 填入直播页「中转」设置。
// 说明：隧道地址每次重启都会变化，需要重新填入；电脑关机后需重新运行本脚本。

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOG_DIR = path.join(ROOT, '.relay');
const CF_LOG = path.join(LOG_DIR, 'cloudflared.log');
const RELAY_PORT = parseInt(process.env.DLNA_PORT || '8899', 10);
const CF =
  process.env.CLOUDFLARED_PATH ||
  (process.platform === 'win32'
    ? 'C:\\Users\\wangw\\cloudflared\\cloudflared.exe'
    : 'cloudflared');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function get(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs || 8000, () => req.destroy(new Error('timeout')));
  });
}

async function relayUp() {
  try {
    const r = await get(`http://localhost:${RELAY_PORT}/healthz`, 3000);
    return r.status === 200;
  } catch (err) {
    return false;
  }
}

async function readTunnelUrl() {
  try {
    const text = fs.readFileSync(CF_LOG, 'utf8');
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    return match ? match[0] : null;
  } catch (err) {
    return null;
  }
}

async function main() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  console.log('[relay] 检查伴生服务 (localhost:' + RELAY_PORT + ') ...');
  if (await relayUp()) {
    console.log('[relay] 伴生服务已在运行');
  } else {
    console.log('[relay] 启动伴生服务 server/dlna.js ...');
    const relay = spawn(process.execPath, ['server/dlna.js'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    relay.on('exit', (code) => {
      console.log('[relay] 伴生服务已退出 (code=' + code + ')');
      process.exit(code || 0);
    });
    for (let i = 0; i < 15; i++) {
      await sleep(500);
      if (await relayUp()) break;
    }
    if (!(await relayUp())) {
      console.error('[relay] 伴生服务启动失败，请检查端口 ' + RELAY_PORT + ' 是否被占用');
      process.exit(1);
    }
    console.log('[relay] 伴生服务已启动');
  }

  const existingUrl = await readTunnelUrl();
  if (existingUrl) {
    try {
      const r = await get(existingUrl + '/healthz', 5000);
      if (r.status === 200) {
        console.log('[relay] 隧道已在运行: ' + existingUrl);
        console.log('\n请把上面地址填入直播页「中转」设置（https 开头）。\n保持本窗口开启即可。');
        process.exit(0);
      }
    } catch (err) {
      // 隧道已失效，重新启动
    }
  }

  console.log('[relay] 启动 cloudflared 隧道 ...');

  // 启动隧道并等待地址（最多约 60 秒），失败返回 null
  const startTunnel = (protocol) =>
    new Promise((resolve) => {
      try {
        fs.writeFileSync(CF_LOG, '');
      } catch (err) {
        // 忽略
      }
      const out = fs.openSync(CF_LOG, 'a');
      const args = ['tunnel', '--url', 'http://localhost:' + RELAY_PORT];
      if (protocol) args.push('--protocol', protocol);
      const cf = spawn(CF, args, { cwd: ROOT, stdio: ['ignore', out, out] });
      cf.on('exit', (code) => {
        // cloudflared 退出后由下面的轮询超时兜底，不在此处退出进程
      });
      const start = Date.now();
      const poll = setInterval(() => {
        const url = readTunnelUrl();
        if (url) {
          clearInterval(poll);
          resolve(url);
          return;
        }
        if (Date.now() - start > 60000) {
          clearInterval(poll);
          try {
            cf.kill();
          } catch (err) {
            // 忽略
          }
          resolve(null);
        }
      }, 2000);
    });

  // QUIC 延迟更低，优先尝试；不可用时回退 HTTP/2
  let tunnelUrl = await startTunnel('quic');
  if (!tunnelUrl) {
    console.log('[relay] QUIC 隧道不可用，回退 HTTP/2 ...');
    tunnelUrl = await startTunnel('http2');
  }
  if (!tunnelUrl) {
    console.log('[relay] HTTP/2 隧道不可用，使用默认协议重试 ...');
    tunnelUrl = await startTunnel(null);
  }
  if (!tunnelUrl) {
    console.error('[relay] 未能获取隧道地址，请检查 cloudflared 是否安装/网络是否可用');
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log(' 直播中转/投屏隧道地址: ' + tunnelUrl);
  console.log(' 请把该地址填入直播页「中转」设置（https 开头）');
  console.log(' 保持本窗口开启即可使用；Ctrl+C 可停止隧道');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('[relay] 启动失败:', err);
  process.exit(1);
});
