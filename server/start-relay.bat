@echo off
chcp 65001 >nul
title MoonTV 直播中转
echo ============================================
echo   MoonTV 直播转播中转（一键启动）
echo ============================================
echo.
where ffmpeg >nul 2>nul || (echo [缺少 ffmpeg] 请先安装 ffmpeg 并加入 PATH，然后重新运行本脚本。 & pause & exit /b 1)
where node >nul 2>nul || (echo [缺少 Node.js] 请先安装 Node.js，然后重新运行本脚本。 & pause & exit /b 1)

cd /d %~dp0
echo [1/2] 启动中转服务（端口 8898）...
start "MoonTV-Relay" /min node relay.js

echo [2/2] 启动 https 隧道（网页版 MoonTV 用）...
echo.
echo ★ 隧道窗口里出现的 https://*.trycloudflare.com 地址，
echo ★ 就是要填进 MoonTV 直播页右上角「中转」的地址。
echo ★ 用 MoonTV App 看时不用隧道，直接填 http://本机局域网IP:8898
echo.
where cloudflared >nul 2>nul || (echo [缺少 cloudflared] 网页版需要它生成 https 地址： winget install Cloudflare.cloudflared & echo 装完后重新运行本脚本；只用 App 看可忽略本提示。 & pause & exit /b 0)
cloudflared tunnel --url http://localhost:8898 --no-autoupdate
pause
