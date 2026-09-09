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
  /** 链接显示文本（若链接内是图片，则取图片 alt） */
  label: string;
  /** 解析为绝对地址后的 URL */
  href: string;
  /** 原始 href */
  raw: string;
}

/** 下拉框选项。 */
export interface SelectOption {
  value: string;
  label: string;
  selected: boolean;
}

/** 表单字段。 */
export interface FormField {
  name: string;
  /** text / hidden / password / checkbox / radio / select / textarea / submit */
  type: string;
  value: string;
  placeholder?: string;
  /** 仅 select 类型有 */
  options?: SelectOption[];
  /** 仅 checkbox / radio 有：是否勾选 */
  checked?: boolean;
}

/** 页面上的一个表单。 */
export interface GameForm {
  /** 绝对地址 */
  action: string;
  method: 'GET' | 'POST';
  fields: FormField[];
}

/** 页面上的一个图片。 */
export interface GameImage {
  src: string;
  alt: string;
  /** 若图片被 <a> 包裹，则携带该链接（点击图片=点击链接） */
  link?: GameLink;
}

/** 解析后的 WAP 页面。 */
export interface WapPage {
  url: string;
  title: string;
  text: string;
  links: GameLink[];
  forms: GameForm[];
  images: GameImage[];
}

/** 统一的“可执行操作”，供 AI 选择。 */
export interface GameAction {
  /** 稳定编号，例如 L0、F1 */
  id: string;
  kind: 'link' | 'form';
  /** 给 AI 看的操作描述（表单会附带可填写字段） */
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
  /** 可选提示（例如检测到循环时提示 AI 换操作） */
  hint?: string;
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
  /** AI 为表单填写的字段值，例如 { keyword: "粮食", amount: "100" } */
  fieldValues?: Record<string, string>;
}

/** 游戏循环结果。 */
export interface LoopResult {
  steps: number;
  visited: string[];
  lastState: GameState | null;
  stopReason: string;
}
