export interface AdminConfig {
  SiteConfig: {
    SiteName: string;
    Announcement: string;
    SearchDownstreamMaxPage: number;
    SiteInterfaceCacheTime: number;
    ImageProxy: string;
    DoubanProxy: string;
    DisableYellowFilter: boolean;
  };
  UserConfig: {
    AllowRegister: boolean;
    Users: {
      username: string;
      role: 'user' | 'admin' | 'owner';
      banned?: boolean;
    }[];
  };
  SourceConfig: {
    key: string;
    name: string;
    api: string;
    detail?: string;
    from: 'config' | 'custom';
    disabled?: boolean;
  }[];
  CustomCategories: {
    name?: string;
    type: 'movie' | 'tv';
    query: string;
    from: 'config' | 'custom';
    disabled?: boolean;
  }[];
  LiveConfig?: LiveSourceConfig[];
  AIConfig?: AIConfig;
}

export interface LiveSourceConfig {
  key: string;
  name: string;
  url: string; // m3u 地址
  ua?: string;
  epg?: string;
  from: 'config' | 'custom';
  channelNumber?: number;
  disabled?: boolean;
}

export interface AIConfig {
  Enabled: boolean;
  CustomApiKey: string;
  CustomBaseURL: string;
  CustomModel: string;
  Temperature?: number;
  MaxTokens?: number;
  EnableStreaming?: boolean;
  EnableAIComments?: boolean;
  EnableWebSearch?: boolean;
  SystemPrompt?: string;
}

export interface AdminConfigResult {
  Role: 'owner' | 'admin';
  Config: AdminConfig;
}
