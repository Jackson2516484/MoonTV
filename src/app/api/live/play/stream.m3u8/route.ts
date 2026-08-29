import { NextRequest } from 'next/server';

import { proxyLiveStream } from '@/lib/liveProxy';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  return proxyLiveStream(request, request.nextUrl.pathname);
}
