/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import { AIConfig } from '@/lib/admin.types';
import { getConfig } from '@/lib/config';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIComment {
  id: string;
  userName: string;
  userAvatar: string;
  rating: number | null;
  content: string;
  time: string;
  votes: number;
  isAiGenerated: true;
}

// 获取生效的 AI 配置（优先管理后台配置，回退环境变量）
export async function getEffectiveAIConfig(): Promise<AIConfig | null> {
  try {
    const config = await getConfig();
    const ai = config.AIConfig;
    if (!ai || !ai.Enabled) return null;
    if (!ai.CustomApiKey || !ai.CustomBaseURL || !ai.CustomModel) return null;
    return ai;
  } catch (err) {
    console.error('获取AI配置失败:', err);
    return null;
  }
}

// OpenAI 兼容的流式聊天请求
export async function streamOpenAIChat(
  messages: ChatMessage[],
  config: {
    apiKey: string;
    baseURL: string;
    model: string;
    temperature: number;
    maxTokens: number;
  },
  enableStreaming = true
): Promise<ReadableStream | Response> {
  const baseURL = config.baseURL.replace(/\/+$/, '');
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: enableStreaming,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `AI API error: ${response.status} ${response.statusText}`
    );
  }

  return enableStreaming ? response.body! : response;
}

// 转换为 SSE 格式
export function transformToSSE(stream: ReadableStream): ReadableStream {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      let buffer = '';
      let contentBuffer = '';
      let inThinkingBlock = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const text = buffer + chunk;
          const parts = text.split('\n');
          buffer = parts.pop() || '';

          const lines = parts.filter((line) => line.trim() !== '');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data) continue;

            if (data === '[DONE]') {
              controller.enqueue(
                new TextEncoder().encode('data: [DONE]\n\n')
              );
              continue;
            }

            try {
              const json = JSON.parse(data);
              const textDelta =
                json.choices?.[0]?.delta?.content ||
                json.choices?.[0]?.message?.content ||
                '';
              if (textDelta) {
                contentBuffer += textDelta;
                if (contentBuffer.includes('<think>')) {
                  inThinkingBlock = true;
                }
                if (inThinkingBlock && contentBuffer.includes('</think>')) {
                  contentBuffer = contentBuffer.replace(
                    /<think>[\s\S]*?<\/think>/g,
                    ''
                  );
                  inThinkingBlock = false;
                }
                if (!inThinkingBlock) {
                  const outputText = contentBuffer;
                  if (outputText) {
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify({ content: outputText })}\n\n`
                      )
                    );
                  }
                }
              }
            } catch (err) {
              // 忽略无法解析的行
            }
          }
        }
      } catch (err) {
        console.error('SSE 转换失败:', err);
      } finally {
        controller.close();
      }
    },
  });
}

// 生成 AI 评论
export async function generateAIComments({
  movieName,
  movieInfo,
  count,
  aiConfig,
}: {
  movieName: string;
  movieInfo?: string;
  count: number;
  aiConfig: AIConfig;
}): Promise<AIComment[]> {
  const systemPrompt = `你是一个影视社区的资深影评人，擅长撰写真实、生动、有深度的影视评论。
请为电影《${movieName}》${movieInfo ? `（${movieInfo}）` : ''}生成 ${count} 条不同的用户评论。
要求：
1. 评论风格多样（好评、中评、吐槽、深度分析等），像真实用户的口吻
2. 每条评论 20-100 字，内容具体、有细节
3. 用户昵称要多样且真实（如"追剧小达人"、"电影发烧友"、"路人甲"等中文昵称）
4. 部分评论带 1-5 星评分，比例要合理
5. 时间用"3天前"、"2小时前"这类相对时间
6. 头像使用 https://api.dicebear.com/9.x/thumbs/svg?seed=昵称 格式

只返回 JSON 数组，格式：
[{"userName":"昵称","userAvatar":"头像URL","rating":4,"content":"评论内容","time":"2天前","votes":12}]`;

  const messages: ChatMessage[] = [
    { role: 'user', content: systemPrompt },
  ];

  const response = await streamOpenAIChat(
    messages,
    {
      apiKey: aiConfig.CustomApiKey,
      baseURL: aiConfig.CustomBaseURL,
      model: aiConfig.CustomModel,
      temperature: aiConfig.Temperature ?? 0.9,
      maxTokens: aiConfig.MaxTokens ?? 2000,
    },
    false
  );

  const data = await (response as Response).json();
  let content = data.choices?.[0]?.message?.content || '';

  // 提取 JSON 数组
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('AI 返回格式无法解析');
  }

  let parsed: any[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error('AI 返回 JSON 解析失败');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI 返回格式不正确');
  }

  return parsed
    .slice(0, count)
    .map((item: any, index: number) => ({
      id: `ai-${Date.now()}-${index}`,
      userName: String(item.userName || '匿名用户'),
      userAvatar:
        String(item.userAvatar || '') ||
        `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(
          String(item.userName || 'user')
        )}`,
      rating:
        typeof item.rating === 'number' && item.rating >= 1 && item.rating <= 5
          ? Math.round(item.rating)
          : null,
      content: String(item.content || ''),
      time: String(item.time || '刚刚'),
      votes: typeof item.votes === 'number' ? item.votes : Math.floor(Math.random() * 20),
      isAiGenerated: true as const,
    }))
    .filter((c) => c.content);
}