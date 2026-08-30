/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import { AIConfig } from '@/lib/admin.types';
import { getConfig } from '@/lib/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
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

export type AIFormat = 'openai' | 'gemini';

// 根据 API 地址自动识别接口格式：地址包含 gemini / generativelanguage 视为 Gemini 原生格式
export function detectAIFormat(baseURL: string): AIFormat {
  const u = (baseURL || '').toLowerCase();
  if (u.includes('generativelanguage') || u.includes('gemini')) {
    return 'gemini';
  }
  return 'openai';
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

function toGeminiContents(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

// Gemini 接口请求：自动尝试多个候选地址（带/不带 /v1beta、流式/非流式），
// 兼容各种反代配置；模型名自动清洗（兼容误填完整路径/URL）
async function geminiFetchRaw(
  url: string,
  body: any,
  apiKey: string,
): Promise<{ ok: boolean; status: number; statusText: string; text: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text().catch(() => '');
  return { ok: response.ok, status: response.status, statusText: response.statusText, text };
}

// 把 Gemini 流式响应（SSE/NDJSON）聚合为单个 JSON
function aggregateGeminiStream(text: string): any {
  const parts: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    let data = '';
    if (line.startsWith('data: ')) data = line.slice(6).trim();
    else if (line && !line.startsWith(':')) data = line;
    if (!data || data === '[DONE]') continue;
    try {
      const json = JSON.parse(data);
      const seg = json?.candidates?.[0]?.content?.parts
        ?.map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .join('');
      if (seg) parts.push(seg);
      else if (typeof json?.text === 'string') parts.push(json.text);
    } catch (err) {
      // 忽略非 JSON 行
    }
  }
  return { candidates: [{ content: { parts: [{ text: parts.join('') }] } }] };
}

async function requestGeminiChat(
  messages: ChatMessage[],
  config: {
    apiKey: string;
    baseURL: string;
    model: string;
    temperature: number;
    maxTokens: number;
  },
  enableStreaming: boolean,
): Promise<ReadableStream | Response> {
  const base = config.baseURL.replace(/\/+$/, '');
  const withV1beta = /\/v1beta$/i.test(base) ? base : `${base}/v1beta`;
  const root = /\/v1beta$/i.test(base) ? base.replace(/\/v1beta$/i, '') : base;
  const modelName = String(config.model || '')
    .trim()
    .split('/')
    .pop() || config.model || '';
  const key = config.apiKey || '';

  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');
  const body: any = {
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
    },
  };
  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }

  const keyQuery = `key=${encodeURIComponent(key)}`;
  const nonStreamUrls = [
    `${withV1beta}/models/${encodeURIComponent(modelName)}:generateContent?${keyQuery}`,
    `${root}/models/${encodeURIComponent(modelName)}:generateContent?${keyQuery}`,
  ];
  const streamUrls = [
    `${withV1beta}/models/${encodeURIComponent(modelName)}:streamGenerateContent?alt=sse&${keyQuery}`,
    `${root}/models/${encodeURIComponent(modelName)}:streamGenerateContent?alt=sse&${keyQuery}`,
  ];

  const candidates: { url: string; streaming: boolean }[] = [];
  if (enableStreaming) {
    candidates.push(...streamUrls.map((u) => ({ url: u, streaming: true })));
    candidates.push(...nonStreamUrls.map((u) => ({ url: u, streaming: false })));
  } else {
    candidates.push(...nonStreamUrls.map((u) => ({ url: u, streaming: false })));
    candidates.push(...streamUrls.map((u) => ({ url: u, streaming: true })));
  }

  let lastError: Error | null = null;
  let lastStatus = 0;
  for (const candidate of candidates) {
    let result;
    try {
      result = await geminiFetchRaw(candidate.url, body, key);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
    if (result.ok) {
      if (candidate.streaming) {
        if (enableStreaming) {
          return new Response(result.text, {
            headers: { 'Content-Type': 'text/event-stream' },
          });
        }
        return new Response(JSON.stringify(aggregateGeminiStream(result.text)), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (enableStreaming) {
        const sseBody = result.text
          .split(/\r?\n/)
          .filter((l) => l.trim())
          .map((l) => `data: ${l}`)
          .join('\n') + '\n\ndata: [DONE]\n\n';
        return new Response(sseBody, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }
      return new Response(result.text, {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    lastStatus = result.status;
    lastError = new Error(
      `AI API error: ${result.status} ${result.statusText}${
        result.text ? ` - ${result.text.slice(0, 300)}` : ''
      }`,
    );
    // 404/400/403/429 可能因反代路径或模型名导致，继续尝试下一个候选；其余错误直接结束
    if (![404, 400, 403, 429].includes(result.status)) break;
  }

  const statusHint =
    lastStatus === 404
      ? '（模型不存在或不可用：请检查头像菜单 AI 设置中的模型名称，例如 gemini-2.5-flash，并在 Gemini 官网确认该模型已开放）'
      : lastStatus === 400
        ? '（API Key 无效或请求格式不正确：请检查头像菜单 AI 设置中的 API Key 是否完整，可到 https://aistudio.google.com/apikey 重新生成后复制，并确认模型名称正确）'
        : lastStatus === 403
          ? '（权限不足：请确认该模型已对当前账号开放，且 API Key 未超过配额）'
          : lastStatus === 429
            ? '（请求过于频繁：请稍后重试）'
            : '';
  throw lastError ? new Error(lastError.message + statusHint) : new Error('AI API error');
}

// AI 聊天请求（自动识别 OpenAI 兼容接口与 Gemini 原生接口）
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
  if (detectAIFormat(config.baseURL) === 'gemini') {
    return requestGeminiChat(messages, config, enableStreaming);
  }

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
    const errText = await response.text().catch(() => '');
    throw new Error(
      `AI API error: ${response.status} ${response.statusText}${errText ? ` - ${errText.slice(0, 300)}` : ''}`,
    );
  }

  return enableStreaming ? response.body! : response;
}

// 从响应 JSON 中提取文本内容（兼容 OpenAI 与 Gemini 格式）
export function extractAIContent(data: any, format: AIFormat): string {
  if (format === 'gemini') {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      return parts
        .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
        .join('');
    }
    if (typeof data?.text === 'string') return data.text;
    return '';
  }
  return data?.choices?.[0]?.message?.content || '';
}

// 转换为 SSE 格式（兼容 OpenAI SSE 与 Gemini SSE/NDJSON）
export function transformToSSE(
  stream: ReadableStream,
  format: AIFormat = 'openai',
): ReadableStream {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      let buffer = '';
      let contentBuffer = '';
      let inThinkingBlock = false;

      const extractDelta = (json: any): string => {
        if (format === 'gemini') {
          const parts = json?.candidates?.[0]?.content?.parts;
          if (Array.isArray(parts)) {
            return parts
              .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
              .join('');
          }
          if (typeof json?.text === 'string') return json.text;
          return '';
        }
        return (
          json?.choices?.[0]?.delta?.content ||
          json?.choices?.[0]?.message?.content ||
          ''
        );
      };

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
            let data = '';
            if (line.startsWith('data: ')) {
              data = line.slice(6).trim();
            } else if (format === 'gemini') {
              // Gemini 流式接口可能返回 NDJSON（无 data: 前缀）
              data = line.trim();
            }
            if (!data) continue;

            if (data === '[DONE]') {
              controller.enqueue(
                new TextEncoder().encode('data: [DONE]\n\n')
              );
              continue;
            }

            try {
              const json = JSON.parse(data);
              const textDelta = extractDelta(json);
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
                  controller.enqueue(
                    new TextEncoder().encode(
                      `data: ${JSON.stringify({ content: contentBuffer })}\n\n`
                    )
                  );
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
  const format = detectAIFormat(aiConfig.CustomBaseURL);
  let content = extractAIContent(data, format);

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
