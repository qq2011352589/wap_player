/**
 * ResourceManager - 资源识别与追踪。
 *
 * 从页面文本中提取资源数量；元宝被标记为付费货币，框架禁止消耗。
 */

const LABELS: ReadonlyArray<{ keywords: string[]; type: string }> = [
  { keywords: ['粮食', '粮草', '军粮'], type: 'food' },
  { keywords: ['铁矿', '生铁', '精铁'], type: 'iron' },
  { keywords: ['石料', '石矿', '石头'], type: 'stone' },
  { keywords: ['木材', '林场', '木头'], type: 'wood' },
  { keywords: ['金币', '银两', '白银'], type: 'gold' },
  { keywords: ['铜钱', '铜币'], type: 'copper' },
  { keywords: ['元宝'], type: 'yuanbao' },
];

/** 付费货币类型集合，框架禁止消耗这些资源。 */
export const PAID_TOKEN_TYPES: ReadonlySet<string> = new Set(['yuanbao']);

export interface ResourceSnapshot {
  step: number;
  resources: Record<string, number>;
}

export class ResourceManager {
  private current: Record<string, number> = {};
  private readonly history: ResourceSnapshot[] = [];

  /** 从页面文本中更新资源数值。 */
  update(text: string, step: number): void {
    for (const { keywords, type } of LABELS) {
      for (const keyword of keywords) {
        const pattern = new RegExp(
          `${keyword}[^0-9+\\-]{0,6}([+\\-])?\\s*([0-9][0-9,]*)\\s*([万亿])?`,
        );
        const match = text.match(pattern);
        if (!match?.[2]) continue;
        const magnitude = Number(match[2].replace(/,/g, ''));
        if (Number.isNaN(magnitude)) continue;
        const multiplier = match[3] === '万' ? 10_000 : match[3] === '亿' ? 100_000_000 : 1;
        this.current[type] = (match[1] === '-' ? -1 : 1) * magnitude * multiplier;
        break;
      }
    }
    this.history.push({ step, resources: { ...this.current } });
  }

  snapshot(): Record<string, number> {
    return { ...this.current };
  }

  get(type: string): number {
    return this.current[type] ?? 0;
  }

  getHistory(): ReadonlyArray<ResourceSnapshot> {
    return this.history;
  }

  isPaidToken(type: string): boolean {
    return PAID_TOKEN_TYPES.has(type);
  }
}
