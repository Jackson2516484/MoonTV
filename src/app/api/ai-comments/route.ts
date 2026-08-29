/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AIConfig } from '@/lib/admin.types';
import { AIComment, generateAIComments, getEffectiveAIConfig } from '@/lib/ai';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const movieName = searchParams.get('name');
    const movieInfo = searchParams.get('info');
    const count = Math.min(
      Math.max(parseInt(searchParams.get('count') || '10'), 1),
      20,
    );

    if (!movieName) {
      return NextResponse.json({ error: '缺少影片名称参数' }, { status: 400 });
    }

    // 客户端自定义 AI 设置（头像菜单中配置，优先于服务端配置）
    const clientKey = searchParams.get('aiKey');
    const clientBase = searchParams.get('aiBase');
    const clientModel = searchParams.get('aiModel');
    let aiConfig: AIConfig | null = null;
    if (clientKey && clientBase && clientModel) {
      aiConfig = {
        Enabled: true,
        CustomApiKey: clientKey,
        CustomBaseURL: clientBase,
        CustomModel: clientModel,
      };
    } else {
      aiConfig = await getEffectiveAIConfig();
    }
    if (!aiConfig) {
      return NextResponse.json(
        { error: 'AI功能未启用，请在头像菜单中设置 AI 或配置环境变量' },
        { status: 403 },
      );
    }

    if (aiConfig.EnableAIComments === false) {
      return NextResponse.json({ error: 'AI评论功能未启用' }, { status: 403 });
    }

    const comments = await generateAIComments({
      movieName,
      movieInfo: movieInfo || undefined,
      count,
      aiConfig,
    });

    return NextResponse.json({
      comments,
      total: comments.length,
      movieName,
      isAiGenerated: true,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('AI评论生成失败:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'AI评论生成失败';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
