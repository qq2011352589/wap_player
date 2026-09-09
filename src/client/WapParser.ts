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
    return {
      url: baseUrl,
      title: title.replace(/\s+/g, ' ').trim(),
      text: this.extractText(html),
      links: this.extractLinks(baseUrl, html),
      forms: this.extractForms(baseUrl, html),
      images: this.extractImages(baseUrl, html, this.imageLinkMap(baseUrl, html)),
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
      const rawHref = this.attr(match[1] ?? '', 'href') ?? '';
      if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('#')) continue;

      const inner = match[2] ?? '';
      // 先剥标签再解码，避免 &lt;C&gt; 被当成标签删除
      let label = this.decode(inner.replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();

      if (!label) {
        const alt = this.attr(this.firstMatch(inner, /<img\b([^>]*?)\/?>/i) ?? '', 'alt');
        label = alt ? this.decode(alt).trim() : '[图片链接]';
      }

      links.push({ label, href: this.absolute(baseUrl, rawHref), raw: rawHref });
    }
    return links;
  }

  /** 收集「图片 src -> 包裹它的链接」，用于回填 GameImage.link。 */
  private imageLinkMap(baseUrl: string, html: string): Map<string, GameLink> {
    const map = new Map<string, GameLink>();
    const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let anchor: RegExpExecArray | null;
    while ((anchor = anchorPattern.exec(html)) !== null) {
      const rawHref = this.attr(anchor[1] ?? '', 'href') ?? '';
      if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('#')) continue;
      const inner = anchor[2] ?? '';
      const alt = this.attr(this.firstMatch(inner, /<img\b([^>]*?)\/?>/i) ?? '', 'alt');
      const link: GameLink = {
        label: alt ? this.decode(alt).trim() : '[图片链接]',
        href: this.absolute(baseUrl, rawHref),
        raw: rawHref,
      };

      const imgPattern = /<img\b([^>]*?)\/?>/gi;
      let img: RegExpExecArray | null;
      while ((img = imgPattern.exec(inner)) !== null) {
        const src = this.attr(img[1] ?? '', 'src');
        if (src) map.set(this.absolute(baseUrl, src), link);
      }
    }
    return map;
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
      if (type === 'checkbox' || type === 'radio') {
        field.checked = this.hasAttr(attrs, 'checked');
      }
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
          label: this.decode((optionMatch[2] ?? '').replace(/<[^>]+>/g, ' '))
            .replace(/\s+/g, ' ')
            .trim(),
          selected: this.hasAttr(optionAttrs, 'selected'),
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
      const attrValue = this.attr(attrs, 'value');
      const textValue = (match[2] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const value = attrValue !== undefined ? this.decode(attrValue) : this.decode(textValue);
      fields.push({ name, type: 'submit', value });
    }

    return fields;
  }

  private extractImages(
    baseUrl: string,
    html: string,
    linkMap: Map<string, GameLink>,
  ): GameImage[] {
    const images: GameImage[] = [];
    const pattern = /<img\b([^>]*?)\/?>/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const attrs = match[1] ?? '';
      const src = this.attr(attrs, 'src');
      if (!src) continue;
      const absoluteSrc = this.absolute(baseUrl, src);
      images.push({
        src: absoluteSrc,
        alt: this.decode(this.attr(attrs, 'alt') ?? '').trim(),
        link: linkMap.get(absoluteSrc),
      });
    }
    return images;
  }

  /** 精确匹配属性名（避免 data-href 冒充 href）。支持双引号/单引号/无引号值。 */
  private attr(attrs: string, name: string): string | undefined {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
      'i',
    );
    const match = attrs.match(pattern);
    if (!match) return undefined;
    return match[1] ?? match[2] ?? match[3];
  }

  /** 判断布尔属性是否存在（如 selected / checked）。 */
  private hasAttr(attrs: string, name: string): boolean {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)${escaped}(?:\\s|=|$)`, 'i').test(attrs);
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
