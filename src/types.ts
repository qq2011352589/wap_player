/**
 * 框架共享类型定义。
 */

/** 游戏内资源类型。yuanbao（元宝）属于付费货币，框架禁止消耗。 */
export type ResourceType =
  | 'food'
  | 'iron'
  | 'stone'
  | 'wood'
  | 'gold'
  | 'copper'
  | 'yuanbao'
  | 'unknown';

/** 页面上的一个超链接。 */
export interface GameLink {
  /** 链接显示文本 */
  label: string;
  /** 解析为绝对地址后的 URL */
  href: string;
  /** 原始 href */
  raw: string;
}

/** 表单字段。 */
export interface FormField {
  name: string;
  type: string;
  value: string;
}

/** 页面上的一个表单。 */
export interface GameForm {
  /** 绝对地址 */
  action: string;
  method: 'GET' | 'POST';
  fields: FormField[];
}

/** 解析后的 WAP 页面。 */
export interface WapPage {
  url: string;
  title: string;
  text: string;
  links: GameLink[];
  forms: GameForm[];
}

/** 统一的“可执行操作”，供 AI 选择。 */
export interface GameAction {
  /** 稳定编号，例如 L0、F1 */
  id: string;
  kind: 'link' | 'form';
  /** 给 AI 看的操作描述 */
  label: string;
  link?: GameLink;
  form?: GameForm;
}

/** 一次决策时的游戏状态快照。 */
export interface GameState {
  step: number;
  url: string;
  title: string;
  text: string;
  resources: Record<string, number>;
  actions: GameAction[];
  timestamp: number;
}

/** 决策来源。 */
export type DecisionSource = 'free-ai' | 'heuristic' | 'fallback';

/** 一次决策结果。 */
export interface Decision {
  /** 选中的操作编号；null 表示无法决策 */
  actionId: string | null;
  rationale: string;
  /** 置信度 0~1 */
  confidence: number;
  source: DecisionSource;
}

/** 游戏循环结果。 */
export interface LoopResult {
  steps: number;
  visited: string[];
  lastState: GameState | null;
  stopReason: string;
}
