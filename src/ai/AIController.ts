/**
 * AIController - 决策控制器。
 *
 * 优先使用免费AI（spark-x2.5-1.7b）决策；
 * 当AI不可用或返回非法结果时，退化为关键词启发式，保证框架始终可运行。
 * 启发式绝不返回被禁用的操作（F4）。
 */

import type { AIConfig } from '../config';
import { logger } from '../logger';
import { isForbiddenAction } from '../safety';
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

  /** 无 AI 时的启发式兜底；绝不返回被禁用的操作。 */
  heuristicDecide(state: GameState): Decision {
    const allowed = state.actions.filter((action) => !isForbiddenAction(action));
    if (allowed.length === 0) {
      return {
        actionId: null,
        rationale: '启发式：无可用（非禁用）操作',
        confidence: 0,
        source: 'fallback',
      };
    }

    const best = allowed
      .map((action) => ({ action, score: this.score(action) }))
      .sort((a, b) => b.score - a.score)[0]!;

    return {
      actionId: best.action.id,
      rationale: `启发式：命中目标关键词（${best.action.label}）`,
      confidence: 0.4,
      source: 'heuristic',
    };
  }

  private score(action: GameAction): number {
    let score = 0;
    for (const keyword of PREFERRED_KEYWORDS) {
      if (action.label.includes(keyword)) score += 10;
    }
    return score;
  }
}
