/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import { AdminConfig } from './admin.types';
import { D1Storage } from './d1.db';
import { Favorite, IStorage, PlayRecord, SkipConfig } from './types';

// 强制指定为 d1，或者从环境变量读取
const STORAGE_TYPE = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'd1';

// 创建存储实例
function createStorage(): IStorage {
  // 如果环境变量指定是 localstorage，则返回空（或者你可以实现一个 LocalStorage 类）
  if (STORAGE_TYPE === 'localstorage') {
     console.warn('Using LocalStorage (Not implemented in server side)');
     return null as unknown as IStorage;
  }

  // 默认返回 D1 实例
  return new D1Storage();
}

// 单例存储实例
let storageInstance: IStorage | null = null;

export function getStorage(): IStorage {
  if (!storageInstance) {
    storageInstance = createStorage();
  }
  return storageInstance;
}

// 工具函数：生成存储key
export function generateStorageKey(source: string, id: string): string {
  return `${source}+${id}`;
}

// 导出便捷方法
export class DbManager {
  private storage: IStorage;

  constructor() {
    this.storage = getStorage();
  }

  // 播放记录相关方法
  async getPlayRecord(userName: string, source: string, id: string) {
    return this.storage.getPlayRecord(userName, generateStorageKey(source, id));
  }

  async savePlayRecord(userName: string, source: string, id: string, record: PlayRecord) {
    await this.storage.setPlayRecord(userName, generateStorageKey(source, id), record);
  }

  async getAllPlayRecords(userName: string) {
    return this.storage.getAllPlayRecords(userName);
  }

  async deletePlayRecord(userName: string, source: string, id: string) {
    await this.storage.deletePlayRecord(userName, generateStorageKey(source, id));
  }

  // 收藏相关方法
  async getFavorite(userName: string, source: string, id: string) {
    return this.storage.getFavorite(userName, generateStorageKey(source, id));
  }

  async saveFavorite(userName: string, source: string, id: string, favorite: Favorite) {
    await this.storage.setFavorite(userName, generateStorageKey(source, id), favorite);
  }

  async getAllFavorites(userName: string) {
    return this.storage.getAllFavorites(userName);
  }

  async deleteFavorite(userName: string, source: string, id: string) {
    await this.storage.deleteFavorite(userName, generateStorageKey(source, id));
  }

  async isFavorited(userName: string, source: string, id: string) {
    const favorite = await this.getFavorite(userName, source, id);
    return favorite !== null;
  }

  // 用户相关
  async registerUser(u: string, p: string) { await this.storage.registerUser(u, p); }
  async verifyUser(u: string, p: string) { return this.storage.verifyUser(u, p); }
  async checkUserExist(u: string) { return this.storage.checkUserExist(u); }
  async getAllUsers() { return this.storage.getAllUsers ? this.storage.getAllUsers() : []; }

  // 搜索历史
  async getSearchHistory(u: string) { return this.storage.getSearchHistory(u); }
  async addSearchHistory(u: string, k: string) { await this.storage.addSearchHistory(u, k); }
  async deleteSearchHistory(u: string, k?: string) { await this.storage.deleteSearchHistory(u, k); }

  // 配置相关
  async getAdminConfig() { return this.storage.getAdminConfig ? this.storage.getAdminConfig() : null; }
  async saveAdminConfig(c: AdminConfig) { if(this.storage.setAdminConfig) await this.storage.setAdminConfig(c); }

  // 跳过配置
  async getSkipConfig(u: string, s: string, i: string) { 
    return this.storage.getSkipConfig ? this.storage.getSkipConfig(u, s, i) : null; 
  }
  async setSkipConfig(u: string, s: string, i: string, c: SkipConfig) { 
    if(this.storage.setSkipConfig) await this.storage.setSkipConfig(u, s, i, c); 
  }
  async deleteSkipConfig(u: string, s: string, i: string) { 
    if(this.storage.deleteSkipConfig) await this.storage.deleteSkipConfig(u, s, i); 
  }
  async getAllSkipConfigs(u: string) { 
    return this.storage.getAllSkipConfigs ? this.storage.getAllSkipConfigs(u) : {}; 
  }
}

export const db = new DbManager();