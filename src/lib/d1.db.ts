/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { getRequestContext } from '@cloudflare/next-on-pages'; // 关键引入
import { AdminConfig } from './admin.types';
import { Favorite, IStorage, PlayRecord, SkipConfig } from './types';

const SEARCH_HISTORY_LIMIT = 20;

// 定义 D1 类型
interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  exec(sql: string): Promise<D1ExecResult>;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = any>(): Promise<D1Result<T>>;
}

interface D1Result<T = any> {
  results: T[];
  success: boolean;
  meta: any;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

export class D1Storage implements IStorage {
  // 获取数据库绑定的正确方式
  private getDb(): D1Database {
    try {
      // 尝试从 Cloudflare 请求上下文中获取 DB
      const db = getRequestContext().env.DB;
      if (!db) {
        throw new Error('D1 Binding "DB" not found in request context');
      }
      return db as unknown as D1Database;
    } catch (e) {
      // 本地开发回退 (如果使用 wrangler dev) 或报错提示
      console.error('Failed to get D1 bindings. Ensure you are running on Cloudflare Pages or using wrangler dev.');
      // 尝试回退到 process.env (仅在某些本地模拟情况下有效)
      if ((process.env as any).DB) return (process.env as any).DB;
      throw e;
    }
  }

  // 播放记录相关
  async getPlayRecord(userName: string, key: string): Promise<PlayRecord | null> {
    try {
      const result = await this.getDb()
        .prepare('SELECT * FROM play_records WHERE username = ? AND key = ?')
        .bind(userName, key)
        .first<any>();

      if (!result) return null;
      return {
        title: result.title,
        source_name: result.source_name,
        cover: result.cover,
        year: result.year,
        index: result.index_episode,
        total_episodes: result.total_episodes,
        play_time: result.play_time,
        total_time: result.total_time,
        save_time: result.save_time,
        search_title: result.search_title || undefined,
      };
    } catch (err) {
      console.error('D1 Error (getPlayRecord):', err);
      return null;
    }
  }

  async setPlayRecord(userName: string, key: string, record: PlayRecord): Promise<void> {
    await this.getDb()
      .prepare(`
        INSERT OR REPLACE INTO play_records 
        (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        userName, key, record.title, record.source_name, record.cover, record.year,
        record.index, record.total_episodes, record.play_time, record.total_time,
        record.save_time, record.search_title || null
      )
      .run();
  }

  async getAllPlayRecords(userName: string): Promise<Record<string, PlayRecord>> {
    const result = await this.getDb()
      .prepare('SELECT * FROM play_records WHERE username = ? ORDER BY save_time DESC')
      .bind(userName)
      .all<any>();
    
    const records: Record<string, PlayRecord> = {};
    result.results.forEach((row) => {
      records[row.key] = {
        title: row.title, source_name: row.source_name, cover: row.cover,
        year: row.year, index: row.index_episode, total_episodes: row.total_episodes,
        play_time: row.play_time, total_time: row.total_time, save_time: row.save_time,
        search_title: row.search_title || undefined,
      };
    });
    return records;
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    await this.getDb().prepare('DELETE FROM play_records WHERE username = ? AND key = ?').bind(userName, key).run();
  }

  // 收藏相关
  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    const result = await this.getDb()
      .prepare('SELECT * FROM favorites WHERE username = ? AND key = ?')
      .bind(userName, key)
      .first<any>();
    if (!result) return null;
    return {
      title: result.title, source_name: result.source_name, cover: result.cover,
      year: result.year, total_episodes: result.total_episodes, save_time: result.save_time,
      search_title: result.search_title,
    };
  }

  async setFavorite(userName: string, key: string, favorite: Favorite): Promise<void> {
    await this.getDb()
      .prepare(`
        INSERT OR REPLACE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(userName, key, favorite.title, favorite.source_name, favorite.cover, favorite.year, favorite.total_episodes, favorite.save_time)
      .run();
  }

  async getAllFavorites(userName: string): Promise<Record<string, Favorite>> {
    const result = await this.getDb()
      .prepare('SELECT * FROM favorites WHERE username = ? ORDER BY save_time DESC')
      .bind(userName)
      .all<any>();
    const favorites: Record<string, Favorite> = {};
    result.results.forEach((row) => {
      favorites[row.key] = {
        title: row.title, source_name: row.source_name, cover: row.cover, year: row.year,
        total_episodes: row.total_episodes, save_time: row.save_time, search_title: row.search_title,
      };
    });
    return favorites;
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    await this.getDb().prepare('DELETE FROM favorites WHERE username = ? AND key = ?').bind(userName, key).run();
  }

  // 用户相关
  async registerUser(u: string, p: string): Promise<void> {
    await this.getDb().prepare('INSERT INTO users (username, password) VALUES (?, ?)').bind(u, p).run();
  }

  async verifyUser(u: string, p: string): Promise<boolean> {
    const res = await this.getDb().prepare('SELECT password FROM users WHERE username = ?').bind(u).first<{ password: string }>();
    return res?.password === p;
  }

  async checkUserExist(u: string): Promise<boolean> {
    const res = await this.getDb().prepare('SELECT 1 FROM users WHERE username = ?').bind(u).first();
    return res !== null;
  }

  async changePassword(u: string, newP: string): Promise<void> {
    await this.getDb().prepare('UPDATE users SET password = ? WHERE username = ?').bind(newP, u).run();
  }

  async deleteUser(u: string): Promise<void> {
    const db = this.getDb();
    await db.batch([
      db.prepare('DELETE FROM users WHERE username = ?').bind(u),
      db.prepare('DELETE FROM play_records WHERE username = ?').bind(u),
      db.prepare('DELETE FROM favorites WHERE username = ?').bind(u),
      db.prepare('DELETE FROM search_history WHERE username = ?').bind(u),
      db.prepare('DELETE FROM skip_configs WHERE username = ?').bind(u),
    ]);
  }

  async getAllUsers(): Promise<string[]> {
    const res = await this.getDb().prepare('SELECT username FROM users ORDER BY created_at ASC').all<{ username: string }>();
    return res.results.map(r => r.username);
  }

  // 搜索历史
  async getSearchHistory(u: string): Promise<string[]> {
    const res = await this.getDb()
      .prepare('SELECT keyword FROM search_history WHERE username = ? ORDER BY created_at DESC LIMIT ?')
      .bind(u, SEARCH_HISTORY_LIMIT)
      .all<{ keyword: string }>();
    return res.results.map(r => r.keyword);
  }

  async addSearchHistory(u: string, k: string): Promise<void> {
    const db = this.getDb();
    await db.prepare('DELETE FROM search_history WHERE username = ? AND keyword = ?').bind(u, k).run();
    await db.prepare('INSERT INTO search_history (username, keyword) VALUES (?, ?)').bind(u, k).run();
    await db.prepare(`
      DELETE FROM search_history WHERE username = ? AND id NOT IN (
        SELECT id FROM search_history WHERE username = ? ORDER BY created_at DESC LIMIT ?
      )`).bind(u, u, SEARCH_HISTORY_LIMIT).run();
  }

  async deleteSearchHistory(u: string, k?: string): Promise<void> {
    const db = this.getDb();
    if (k) await db.prepare('DELETE FROM search_history WHERE username = ? AND keyword = ?').bind(u, k).run();
    else await db.prepare('DELETE FROM search_history WHERE username = ?').bind(u).run();
  }

  // 管理员配置
  async getAdminConfig(): Promise<AdminConfig | null> {
    const res = await this.getDb().prepare('SELECT config FROM admin_config WHERE id = 1').first<{ config: string }>();
    return res ? (JSON.parse(res.config) as AdminConfig) : null;
  }
  async setAdminConfig(c: AdminConfig): Promise<void> {
    await this.getDb().prepare('INSERT OR REPLACE INTO admin_config (id, config) VALUES (1, ?)').bind(JSON.stringify(c)).run();
  }

  // 跳过配置
  async getSkipConfig(u: string, s: string, i: string): Promise<SkipConfig | null> {
    const res = await this.getDb().prepare('SELECT * FROM skip_configs WHERE username = ? AND source = ? AND id_video = ?').bind(u, s, i).first<any>();
    return res ? { enable: Boolean(res.enable), intro_time: res.intro_time, outro_time: res.outro_time } : null;
  }
  async setSkipConfig(u: string, s: string, i: string, c: SkipConfig): Promise<void> {
    await this.getDb().prepare(`
      INSERT OR REPLACE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(u, s, i, c.enable ? 1 : 0, c.intro_time, c.outro_time).run();
  }
  async deleteSkipConfig(u: string, s: string, i: string): Promise<void> {
    await this.getDb().prepare('DELETE FROM skip_configs WHERE username = ? AND source = ? AND id_video = ?').bind(u, s, i).run();
  }
  async getAllSkipConfigs(u: string): Promise<{ [key: string]: SkipConfig }> {
    const res = await this.getDb().prepare('SELECT source, id_video, enable, intro_time, outro_time FROM skip_configs WHERE username = ?').bind(u).all<any>();
    const configs: { [key: string]: SkipConfig } = {};
    res.results.forEach(row => {
      configs[`${row.source}+${row.id_video}`] = { enable: Boolean(row.enable), intro_time: row.intro_time, outro_time: row.outro_time };
    });
    return configs;
  }
}