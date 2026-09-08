/**
 * WapParser - 基于正则的 HTML 解析器。
 *
 * WAP 游戏页面结构简单（链接 + 表单 + 图片），
 * 使用正则即可解析，避免引入重量级 DOM 依赖。
 */

import type { FormField, GameForm, GameImage, GameLink, SelectOption, WapPage } from '../types';

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
    const links = this.extractLinks(baseUrl, html);
    return {
      url: baseUrl,
      title: title.replace(/\s+/g, ' ').trim(),
      text: this.extractText(html),
      links,
      forms: this.extractForms(baseUrl, html),
      images: this.extractImages(baseUrl, html),
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
    const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const attrs = match[1] ?? '';
      const rawHref = this.attr(attrs, 'href') ?? '';
      if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('#')) continue;

      const inner = match[2] ?? '';
      let label = this.decode(inner)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // 链接内若是图片，用图片 alt 作为标签
      if (!label) {
        const altMatch = inner.match(/<img\b[^>]*\balt\s*=\s*["']([^"']*)["']/i);
        label = altMatch?.[1] ? this.decode(altMatch[1]).trim() : '[图片链接]';
      }

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
    let match: RegExpExecArray | null;

    // <input>
    const inputPattern = /<input\b([^>]*?)\/?>/gi;
    while ((match = inputPattern.exec(html)) !== null) {
      const attrs = match[1] ?? '';
      const name = this.attr(attrs, 'name');
      if (!name) continue;
      const type = (this.attr(attrs, 'type') ?? 'text').toLowerCase();
      if (type === 'reset') continue;
      const field: FormField = {
        name,
        type,
        value: this.decode(this.attr(attrs, 'value') ?? ''),
      };
      const placeholder = this.attr(attrs, 'placeholder');
      if (placeholder) field.placeholder = this.decode(placeholder);
      fields.push(field);
    }

    // <select>
    const selectPattern = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
    while ((match = selectPattern.exec(html)) !== null) {
      const name = this.attr(match[1] ?? '', 'name');
      if (!name) continue;
      const options: SelectOption[] = [];
      const optionPattern = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
      let optionMatch: RegExpExecArray | null;
      while ((optionMatch = optionPattern.exec(match[2] ?? '')) !== null) {
        const optionAttrs = optionMatch[1] ?? '';
        options.push({
          value: this.decode(this.attr(optionAttrs, 'value') ?? '').trim(),
          label: this.decode(optionMatch[2] ?? '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
          selected: /\bselected\b/i.test(optionAttrs),
        });
      }
      const selected = options.find((option) => option.selected) ?? options[0];
      fields.push({ name, type: 'select', value: selected?.value ?? '', options });
    }

    // <textarea>
    const textareaPattern = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi;
    while ((match = textareaPattern.exec(html)) !== null) {
      const name = this.attr(match[1] ?? '', 'name');
      if (!name) continue;
      fields.push({ name, type: 'textarea', value: this.decode(match[2] ?? '').trim() });
    }

    // <button>
    const buttonPattern = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
    while ((match = buttonPattern.exec(html)) !== null) {
      const attrs = match[1] ?? '';
      const name = this.attr(attrs, 'name');
      const type = (this.attr(attrs, 'type') ?? 'submit').toLowerCase();
      if (!name || type === 'button' || type === 'reset') continue;
      const value =
        this.attr(attrs, 'value') ??
        this.decode(match[2] ?? '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      fields.push({ name, type: 'submit', value: this.decode(value) });
    }

    return fields;
  }

  private extractImages(baseUrl: string, html: string): GameImage[] {
    const images: GameImage[] = [];
    const pattern = /<img\b([^>]*?)\/?>/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const attrs = match[1] ?? '';
      const src = this.attr(attrs, 'src');
      if (!src) continue;
      images.push({
        src: this.absolute(baseUrl, src),
        alt: this.decode(this.attr(attrs, 'alt') ?? '').trim(),
      });
    }
    return images;
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
