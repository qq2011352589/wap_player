/**
 * WapParser - 基于正则的 HTML 解析器。
 *
 * WAP 游戏页面结构简单（<a> 链接 + <form> 表单），
 * 使用正则即可解析，避免引入重量级 DOM 依赖。
 */

import type { FormField, GameForm, GameLink, WapPage } from '../types';

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

export class WapParser {
  parse(baseUrl: string, html: string): WapPage {
    const title = this.decode(this.firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? '');
    return {
      url: baseUrl,
      title: title.replace(/\s+/g, ' ').trim(),
      text: this.extractText(html),
      links: this.extractLinks(baseUrl, html),
      forms: this.extractForms(baseUrl, html),
    };
  }

  private firstMatch(html: string, pattern: RegExp): string | undefined {
    return html.match(pattern)?.[1];
  }

  private extractText(html: string): string {
    const withoutScripts = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const withBreaks = withoutScripts
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    return this.decode(withBreaks)
      .replace(/[ \t\u00a0]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  private extractLinks(baseUrl: string, html: string): GameLink[] {
    const links: GameLink[] = [];
    const pattern = /<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const rawHref = match[1] ?? '';
      if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('#')) continue;
      const label = this.decode(match[2] ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!label) continue;
      links.push({ label, href: this.absolute(baseUrl, rawHref), raw: rawHref });
    }
    return links;
  }

  private extractForms(baseUrl: string, html: string): GameForm[] {
    const forms: GameForm[] = [];
    const pattern = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const attrs = match[1] ?? '';
      const inner = match[2] ?? '';
      const action = this.attr(attrs, 'action') ?? baseUrl;
      const method = (this.attr(attrs, 'method') ?? 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET';
      forms.push({
        action: this.absolute(baseUrl, action),
        method,
        fields: this.extractFields(inner),
      });
    }
    return forms;
  }

  private extractFields(html: string): FormField[] {
    const fields: FormField[] = [];
    const pattern = /<input\b([^>]*?)\/?>/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const attrs = match[1] ?? '';
      const name = this.attr(attrs, 'name');
      if (!name) continue;
      const type = (this.attr(attrs, 'type') ?? 'text').toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'image') continue;
      fields.push({ name, type, value: this.decode(this.attr(attrs, 'value') ?? '') });
    }
    return fields;
  }

  private attr(attrs: string, name: string): string | undefined {
    const pattern = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i');
    return attrs.match(pattern)?.[1];
  }

  private absolute(baseUrl: string, href: string): string {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return href;
    }
  }

  private decode(value: string): string {
    return value.replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity);
  }
}
