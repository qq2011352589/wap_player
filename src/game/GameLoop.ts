/**
 * GameLoop - 游戏主循环。
 *
 * 流程：拉取页面 -> 解析可执行操作 -> 构建状态 -> AI 决策 -> 执行操作 -> 循环。
 * 内建安全护栏：最大步数、页面重复次数上限、付费/退出操作拦截。
 */

import type { AIController } from '../ai/AIController';
import type { GameClient } from '../client/GameClient';
import type { LoopConfig } from '../config';
import { logger } from '../logger';
import type { GameAction, LoopResult } from '../types';
import { buildActions } from './actionBuilder';
import type { GameStateManager } from './GameStateManager';

/** 禁止执行的操作关键词（付费/退出）。 */
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
];

export class GameLoop {
  private readonly client: GameClient;
  private readonly controller: AIController;
  private readonly stateManager: GameStateManager;
  private readonly config: LoopConfig;

  constructor(
    client: GameClient,
    controller: AIController,
    stateManager: GameStateManager,
    config: LoopConfig,
  ) {
    this.client = client;
    this.controller = controller;
    this.stateManager = stateManager;
    this.config = config;
  }

  async run(): Promise<LoopResult> {
    const visited: string[] = [];
    // maxSteps <= 0 表示无限步数（免费AI无成本顾虑）
    const stepLimit = this.config.maxSteps > 0 ? this.config.maxSteps : Number.POSITIVE_INFINITY;
    let page = await this.client.enter();
    let stopReason = this.config.maxSteps > 0 ? '达到最大步数' : '无限循环（外部终止）';
    let lastUrl = '';
    let sameUrlStreak = 0;

    for (let step = 0; step < stepLimit; step++) {
      const actions = buildActions(page);
      const state = this.stateManager.build(page, actions);
      visited.push(page.url);

      // 死循环检测：连续停留在同一页面
      if (page.url === lastUrl) {
        sameUrlStreak += 1;
      } else {
        sameUrlStreak = 0;
        lastUrl = page.url;
      }
      if (this.config.maxRepeatedUrls > 0 && sameUrlStreak >= this.config.maxRepeatedUrls) {
        stopReason = `连续 ${sameUrlStreak + 1} 次停留在同一页面，疑似死循环：${page.url}`;
        logger.warn(stopReason);
        break;
      }

      const decision = await this.controller.choose(state);
      const action = actions.find((item) => item.id === decision.actionId) ?? null;

      if (!action) {
        stopReason = '没有可执行的决策';
        logger.warn(stopReason);
        break;
      }

      if (this.isForbidden(action)) {
        stopReason = `决策命中付费/退出操作，已拦截：${action.label}`;
        logger.warn(stopReason);
        break;
      }

      logger.info(`执行操作：${action.label}`);
      page = await this.client.execute(action, decision.fieldValues);
      await this.sleep(this.config.stepDelayMs);
    }

    const lastState = this.stateManager.current;
    logger.info(`游戏循环结束：${stopReason}（共 ${this.stateManager.step} 步）`);
    return { steps: this.stateManager.step, visited, lastState, stopReason };
  }

  private isForbidden(action: GameAction): boolean {
    return FORBIDDEN_KEYWORDS.some((keyword) => action.label.includes(keyword));
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
