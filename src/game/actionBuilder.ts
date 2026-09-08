/**
 * actionBuilder - 把解析后的页面转换为一组可执行操作。
 */

import type { FormField, GameAction, GameForm, WapPage } from '../types';

const MAX_LINKS = 40;
const MAX_FORMS = 10;

/** 可被 AI 主动填写/选择的字段类型 */
const FILLABLE_TYPES = new Set(['text', 'textarea', 'password', 'select', 'search', 'number', 'tel', 'email']);

function describeField(field: FormField): string {
  if (field.type === 'select' && field.options && field.options.length > 0) {
    const options = field.options
      .slice(0, 8)
      .map((option) => option.label || option.value)
      .join('/');
    return `${field.name}(下拉:${options})`;
  }
  const hint = field.placeholder ? `(${field.placeholder})` : '';
  return `${field.name}${hint}`;
}

function describeForm(form: GameForm): string {
  const fillable = form.fields.filter((field) => FILLABLE_TYPES.has(field.type));
  if (fillable.length === 0) return '';
  return ` ｜可填写: ${fillable.map(describeField).join('，')}`;
}

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
      label: `[表单] ${form.method} ${form.action}${describeForm(form)}`,
      form,
    });
  });

  return actions;
}
