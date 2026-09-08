/**
 * HttpClient - 带 Cookie 会话的 HTTP 客户端。
 *
 * WAP 游戏是服务端渲染的 HTML 页面，登录态依赖 Cookie（Django session），
 * 因此这里实现一个最小可用的 Cookie jar 与重定向跟随。
 */

import { logger } from '../logger';

export interface HttpResponse {
  status: number;
  url: string;
  headers: Headers;
  body: string;
}

const MAX_REDIRECTS = 6;

export class HttpClient {
  private readonly cookies = new Map<string, string>();
  private readonly defaultHeaders: Record<string, string>;

  constructor(userAgent: string) {
    this.defaultHeaders = {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    };
  }

  getCookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  allCookies(): Record<string, string> {
    return Object.fromEntries(this.cookies);
  }

  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  clearCookies(): void {
    this.cookies.clear();
  }

  async get(url: string): Promise<HttpResponse> {
    return this.request('GET', url);
  }

  async post(url: string, data: Record<string, string>): Promise<HttpResponse> {
    const body = new URLSearchParams(data).toString();
    return this.request('POST', url, body, 'application/x-www-form-urlencoded');
  }

  private async request(
    method: 'GET' | 'POST',
    url: string,
    body?: string,
    contentType?: string,
  ): Promise<HttpResponse> {
    let currentUrl = url;

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const headers: Record<string, string> = { ...this.defaultHeaders };
      const cookieHeader = this.cookieHeader();
      if (cookieHeader) headers.Cookie = cookieHeader;
      if (method === 'POST' && contentType) headers['Content-Type'] = contentType;

      logger.debug(`HTTP ${method} ${currentUrl}`);
      const response = await fetch(currentUrl, {
        method,
        headers,
        body: method === 'POST' ? body : undefined,
        redirect: 'manual',
      });

      this.storeCookies(response);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }
      }

      const text = await response.text();
      return { status: response.status, url: currentUrl, headers: response.headers, body: text };
    }

    throw new Error(`重定向次数过多：${url}`);
  }

  private cookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  private storeCookies(response: Response): void {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = headers.getSetCookie?.() ?? [];
    for (const raw of setCookies) {
      const pair = raw.split(';')[0];
      if (!pair) continue;
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this.cookies.set(name, value);
      logger.debug(`Cookie 更新：${name}`);
    }
  }
}
