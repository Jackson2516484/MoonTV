import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. 处理 API CORS (保持原有逻辑)
  if (path.startsWith('/api')) {
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
  }

  // 2. 定义公开路径 (无需登录)
  const publicPaths = [
    '/login',
    '/api', // API 路由通常由自身的 Auth 处理，或者在此处放行
    '/_next', // Next.js 系统文件
    '/favicon.ico',
    '/manifest.json',
    '/icons', // 假设图标在这里
    '/images' // 假设图片在这里
  ];

  const isPublicPath = publicPaths.some(publicPath => path.startsWith(publicPath));

  // 3. 检查 Auth Cookie
  const authCookie = request.cookies.get('auth');
  const isAuthenticated = !!authCookie;

  // 4. 路由守卫逻辑
  if (!isPublicPath && !isAuthenticated) {
    // 未登录且访问非公开页面 -> 重定向到登录页
    const loginUrl = new URL('/login', request.url);
    // 记录原目标路径，以便登录后跳转回来
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  if (path === '/login' && isAuthenticated) {
    // 已登录且访问登录页 -> 重定向到首页
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};