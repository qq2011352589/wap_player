/**
 * actionBuilder - 把解析后的页面转换为一组可执行操作。
 */

import type { FormField, GameAction, GameForm, WapPage } from '../types';

const MAX_LINKS = 40;
const MAX_FORMS = 10;

/** 可被 AI 主动填写/选择的字段类型 */
export const FILLABLE_TYPES: ReadonlySet<string> = new Set([
  'text',
  'textarea',
  'password',
  'select',
  'search',
  'number',
  'tel',
  'email',
]);

/**
 * 校验 AI 填写的字段值：
 * 只保留「存在且可填」的字段；下拉值必须命中选项（按 value 或 label），并归一化为 value。
 * 隐藏字段 / submit / checkbox 等一律丢弃，防止 AI 覆盖 CSRF 或注入参数。
 */
export function sanitizeFieldValues(
  form: GameForm,
  values: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!values) return undefined;
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    const field = form.fields.find((item) => item.name === name && FILLABLE_TYPES.has(item.type));
    if (!field) continue;
    if (field.type === 'select') {
      const option = field.options?.find(
        (candidate) => candidate.value === value || candidate.label === value,
      );
      if (!option) continue;
      result[name] = option.value;
    } else {
      result[name] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

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
