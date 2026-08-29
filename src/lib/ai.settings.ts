/* eslint-disable @typescript-eslint/no-explicit-any */

// AI 自定义设置（保存在浏览器本地，优先于服务端/环境变量配置）

export interface LocalAISettings {
  enabled: boolean;
  provider: string;
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface AIProviderPreset {
  key: string;
  label: string;
  baseURL: string;
  model: string;
}

export const AI_PROVIDERS: AIProviderPreset[] = [
  {
    key: 'openai',
    label: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    key: 'moonshot',
    label: 'Moonshot Kimi',
    baseURL: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  {
    key: 'dashscope',
    label: '通义千问',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    key: 'zhipu',
    label: '智谱 GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
  },
  {
    key: 'gemini',
    label: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash',
  },
  { key: 'custom', label: '自定义', baseURL: '', model: '' },
];

export const AI_SETTINGS_KEY = 'moontv_ai_settings';

export function getLocalAISettings(): LocalAISettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.apiKey || !parsed.baseURL || !parsed.model) {
      return null;
    }
    return {
      enabled: parsed.enabled !== false,
      provider:
        typeof parsed.provider === 'string' ? parsed.provider : 'custom',
      apiKey: String(parsed.apiKey),
      baseURL: String(parsed.baseURL),
      model: String(parsed.model),
    };
  } catch (err) {
    return null;
  }
}

export function saveLocalAISettings(settings: LocalAISettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
}

export function clearLocalAISettings(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AI_SETTINGS_KEY);
}
