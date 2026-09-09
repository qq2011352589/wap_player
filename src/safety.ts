/**
 * safety - 统一的「禁用操作」判定。
 *
 * 付费/退出类操作必须被拦截；判定同时检查可见标签与链接/表单目标 URL，
 * 避免「标签无害但 href 指向充值」的绕过。
 */

import type { GameAction } from './types';

/** 禁用关键词（付费 / 退出）。大小写不敏感匹配。 */
export const FORBIDDEN_KEYWORDS: readonly string[] = [
  '退出登陆',
  '退出登录',
  '注销',
  '充值',
  '商城',
  '购买',
  '支付',
  '元宝',
  'vip',
  '礼包',
  '删除',
  '放弃',
  '解散',
];

/** 判断操作是否被禁用：检查标签 + 链接 label/raw/href + 表单 action。 */
export function isForbiddenAction(action: GameAction): boolean {
  const haystacks: string[] = [action.label];
  if (action.link) {
    haystacks.push(action.link.label, action.link.raw, action.link.href);
  }
  if (action.form) {
    haystacks.push(action.form.action);
  }
  const text = haystacks.join(' ').toLowerCase();
  return FORBIDDEN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}
