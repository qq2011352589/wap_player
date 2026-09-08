/**
 * actionBuilder - 把解析后的页面转换为一组可执行操作。
 */

import type { GameAction, WapPage } from '../types';

const MAX_LINKS = 40;
const MAX_FORMS = 10;

export function buildActions(page: WapPage): GameAction[] {
  const actions: GameAction[] = [];
  const seen = new Set<string>();

  page.links.slice(0, MAX_LINKS).forEach((link, index) => {
    const key = `link:${link.href}`;
    if (seen.has(key)) return;
    seen.add(key);
    actions.push({
      id: `L${index}`,
      kind: 'link',
      label: `[链接] ${link.label}`,
      link,
    });
  });

  page.forms.slice(0, MAX_FORMS).forEach((form, index) => {
    const key = `form:${form.action}:${form.fields.map((field) => field.name).join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    actions.push({
      id: `F${index}`,
      kind: 'form',
      label: `[表单] ${form.method} ${form.action}`,
      form,
    });
  });

  return actions;
}
