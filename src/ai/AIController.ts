/**
 * AIController - 决策控制器。
 *
 * 优先使用免费AI（spark-x2.5-1.7b）决策；
 * 当AI不可用或返回非法结果时，退化为关键词启发式，保证框架始终可运行。
 */

import type { AIConfig } from '../config';
import { logger } from '../logger';
import type { Decision, GameAction, GameState } from '../types';
import { FreeAIModel } from './FreeAIModel';

/** 倾向于选择的操作关键词 */
const PREFERRED_KEYWORDS = [
  '任务',
  '主线',
  '日常',
  '领取',
  '奖励',
  '签到',
  '征收',
  '征税',
  '采集',
  '建造',
  '升级',
  '训练',
  '招募',
  '征兵',
  '战斗',
  '出征',
  '挑战',
  '历练',
  '副本',
  '剧情',
  '继续',
  '进入',
  '前往',
  '确认',
  '确定',
];

/** 禁止选择的操作关键词（付费/退出） */
const FORBIDDEN_KEYWORDS = [
  '退出登陆',
  '退出登录',
  '注销',
  '充值',
  '商城',
  '购买',
  '支付',
  '元宝',
  'VIP',
  '礼包',
  '删除',
  '放弃',
  '解散',
];

export class AIController {
  private readonly model: FreeAIModel;
  private readonly history: Decision[] = [];

  constructor(config: AIConfig) {
    this.model = new FreeAIModel(config);
  }

  /** 历史决策记录 */
  get decisions(): readonly Decision[] {
    return this.history;
  }

  /** 为当前状态选择一个操作。 */
  async choose(state: GameState): Promise<Decision> {
    const aiDecision = await this.model.decide(state);
    const decision = aiDecision.actionId !== null ? aiDecision : this.heuristicDecide(state);
    this.history.push(decision);
    logger.info(
      `第 ${state.step} 步决策 [${decision.source}] ${decision.actionId ?? '无'} - ${decision.rationale}`,
    );
    return decision;
  }

  /** 无 AI 时的启发式兜底。 */
  heuristicDecide(state: GameState): Decision {
    const scored = state.actions
      .map((action) => ({ action, score: this.score(action) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score <= 0) {
      const first = state.actions[0];
      if (!first) {
        return { actionId: null, rationale: '启发式：无可用操作', confidence: 0, source: 'fallback' };
      }
      return {
        actionId: first.id,
        rationale: '启发式：无明确目标，选择第一个可用操作',
        confidence: 0.2,
        source: 'heuristic',
      };
    }

    return {
      actionId: best.action.id,
      rationale: `启发式：命中目标关键词（${best.action.label}）`,
      confidence: 0.4,
      source: 'heuristic',
    };
  }

  private score(action: GameAction): number {
    if (FORBIDDEN_KEYWORDS.some((keyword) => action.label.includes(keyword))) {
      return -100;
    }
    let score = 0;
    for (const keyword of PREFERRED_KEYWORDS) {
      if (action.label.includes(keyword)) score += 10;
    }
    return score;
  }
}
