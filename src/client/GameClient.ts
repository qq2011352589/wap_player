/**
 * GameClient - 游戏客户端。
 *
 * 负责登录进入游戏、拉取页面、执行 AI 选择的操作。
 */

import type { GameConfig } from '../config';
import { logger } from '../logger';
import type { GameAction, WapPage } from '../types';
import { HttpClient } from './HttpClient';
import { WapParser } from './WapParser';

export class GameClient {
  private readonly config: GameConfig;
  private readonly http: HttpClient;
  private readonly parser: WapParser;

  constructor(config: GameConfig) {
    this.config = config;
    this.http = new HttpClient(config.userAgent);
    this.parser = new WapParser();
  }

  /** 当前会话 Cookie */
  get cookies(): Record<string, string> {
    return this.http.allCookies();
  }

  /** 登录并进入游戏首页。 */
  async enter(): Promise<WapPage> {
    const url = this.buildEntryUrl();
    logger.info(`进入游戏：${url}`);
    const response = await this.http.get(url);
    return this.parser.parse(response.url, response.body);
  }

  /** 拉取并解析任意页面。 */
  async fetch(url: string): Promise<WapPage> {
    const response = await this.http.get(url);
    return this.parser.parse(response.url, response.body);
  }

  /** 执行一个操作，返回操作后的页面。 */
  async execute(action: GameAction): Promise<WapPage> {
    if (action.kind === 'link' && action.link) {
      const response = await this.http.get(action.link.href);
      return this.parser.parse(response.url, response.body);
    }

    if (action.kind === 'form' && action.form) {
      const data: Record<string, string> = {};
      for (const field of action.form.fields) {
        data[field.name] = field.value;
      }
      const response =
        action.form.method === 'POST'
          ? await this.http.post(action.form.action, data)
          : await this.http.get(
              `${action.form.action}?${new URLSearchParams(data).toString()}`,
            );
      return this.parser.parse(response.url, response.body);
    }

    throw new Error(`无法执行操作：${action.label}`);
  }

  private buildEntryUrl(): string {
    try {
      const url = new URL(this.config.entryUrl);
      if (!url.searchParams.has('username')) {
        url.searchParams.set('username', this.config.username);
      }
      if (!url.searchParams.has('password')) {
        url.searchParams.set('password', this.config.password);
      }
      return url.toString();
    } catch {
      return this.config.entryUrl;
    }
  }
}
