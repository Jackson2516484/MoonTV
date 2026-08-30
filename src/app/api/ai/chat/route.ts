/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AIConfig } from '@/lib/admin.types';
import {
  ChatMessage,
  detectAIFormat,
  extractAIContent,
  getEffectiveAIConfig,
  streamOpenAIChat,
  transformToSSE,
} from '@/lib/ai';

export const runtime = 'edge';

interface ChatRequest {
  message: string;
  context?: {
    title?: string;
    year?: string;
    desc?: string;
    source_name?: string;
  };
  history?: ChatMessage[];
  // 客户端自定义 AI 设置（优先于服务端配置）
  aiSettings?: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求
    const body = (await request.json()) as ChatRequest;
    const { message, context, history = [] } = body;

    // 2. 获取 AI 配置（优先客户端自定义设置，回退服务端配置）
    const clientAi = body.aiSettings;
    let aiConfig: AIConfig | null = null;
    if (clientAi?.apiKey && clientAi?.baseURL && clientAi?.model) {
      aiConfig = {
        Enabled: true,
        CustomApiKey: clientAi.apiKey,
        CustomBaseURL: clientAi.baseURL,
        CustomModel: clientAi.model,
      };
    } else {
      aiConfig = await getEffectiveAIConfig();
    }
    if (!aiConfig) {
      return NextResponse.json(
        { error: 'AI功能未启用，请在头像菜单中设置 AI 或配置环境变量' },
        { status: 400 },
      );
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 });
    }

    // 3. 构建系统提示词
    let systemPrompt = aiConfig.SystemPrompt || '';
    if (context?.title) {
      systemPrompt += `\n当前用户正在观看《${context.title}》${
        context.year ? `(${context.year})` : ''
      }${context.source_name ? `，来源：${context.source_name}` : ''}。${
        context.desc ? `剧情简介：${context.desc.slice(0, 500)}` : ''
      }\n请结合该影视作品回答用户的问题，例如剧情解析、演员信息、推荐类似影片等。`;
    }
    systemPrompt +=
      '\n你是一个专业的影视推荐与问答助手。回答要简洁、准确、有帮助。推荐影片时给出片名和简短理由。';

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'assistant', content: '明白了，我会按照要求回答用户的问题。' },
      ...history,
      { role: 'user', content: message },
    ];

    // 4. 调用 AI API
    const aiFormat = detectAIFormat(aiConfig.CustomBaseURL);
    const enableStreaming = aiConfig.EnableStreaming !== false;

    try {
      const result = await streamOpenAIChat(
        messages,
        {
          apiKey: aiConfig.CustomApiKey,
          baseURL: aiConfig.CustomBaseURL,
          model: aiConfig.CustomModel,
          temperature: aiConfig.Temperature ?? 0.7,
          maxTokens: aiConfig.MaxTokens ?? 1000,
        },
        enableStreaming,
      );

      if (enableStreaming) {
        const rawStream =
          result instanceof Response
            ? result.body
            : (result as ReadableStream);
        const sseStream = transformToSSE(rawStream as ReadableStream, aiFormat);
        return new NextResponse(sseStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }

      const data = await (result as Response).json();
      let content = extractAIContent(data, aiFormat);
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '');
      return NextResponse.json({ content });
    } catch (err: any) {
      return NextResponse.json(
        {
          error: 'AI 请求失败',
          details: err?.message || String(err),
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error('AI聊天API错误:', error);
    return NextResponse.json({ error: 'AI聊天请求失败' }, { status: 500 });
  }
}
