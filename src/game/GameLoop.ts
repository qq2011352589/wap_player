/**
 * GameLoop - 游戏主循环。
 *
 * 流程：拉取页面 -> 过滤禁用操作 -> 构建状态 -> AI 决策 -> 执行操作 -> 循环。
 * 护栏：最大步数(0=无限)、最长运行时间、连续同页面、付费/退出拦截、网络异常优雅停止。
 */

import type { AIController } from '../ai/AIController';
import type { GameClient } from '../client/GameClient';
import type { LoopConfig } from '../config';
import { logger } from '../logger';
import { isForbiddenAction } from '../safety';
import type { LoopResult, WapPage } from '../types';
import { buildActions } from './actionBuilder';
import type { GameStateManager } from './GameStateManager';
import { detectUrlCycle } from './loopDetection';

/** 注入 AI 提示词的最近操作数量上限。 */
const RECENT_ACTION_LIMIT = 5;

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
    let stopReason = this.config.maxSteps > 0 ? '达到最大步数' : '无限循环（外部终止）';
    let lastUrl = '';
    let sameUrlStreak = 0;
    const urlHistory: string[] = [];
    const recentActions: string[] = [];
    let cycleNudged = false;

    let page: WapPage;
    try {
      page = await this.client.enter();
    } catch (error) {
      stopReason = `进入游戏失败：${(error as Error).message}`;
      logger.warn(stopReason);
      return { steps: 0, visited, lastState: null, stopReason };
    }

    const startedAt = Date.now();
    for (let step = 0; step < stepLimit; step++) {
      if (this.config.maxRuntimeMs > 0 && Date.now() - startedAt >= this.config.maxRuntimeMs) {
        const runtimeLabel =
          this.config.maxRuntimeMs >= 60_000
            ? `${Math.round(this.config.maxRuntimeMs / 60_000)} 分钟`
            : `${Math.round(this.config.maxRuntimeMs / 1000)} 秒`;
        stopReason = `达到最长运行时间（${runtimeLabel}）`;
        logger.info(stopReason);
        break;
      }

      const allActions = buildActions(page);
      const allowed = allActions.filter((action) => !isForbiddenAction(action));
      if (allActions.length > 0 && allowed.length === 0) {
        stopReason = `所有操作均命中付费/退出拦截：${allActions[0]?.label ?? ''}`;
        logger.warn(stopReason);
        break;
      }

      const state = this.stateManager.build(page, allowed);
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

      // 交替循环检测（A→B→A→B / A→B→C→A→B→C）：先提示 AI 换操作，再犯则停止
      urlHistory.push(page.url);
      if (urlHistory.length > 12) urlHistory.shift();
      const cycle = detectUrlCycle(urlHistory, 3);
      if (cycle !== null) {
        if (cycleNudged) {
          stopReason = `检测到页面循环（周期 ${cycle}）：${page.url}`;
          logger.warn(stopReason);
          break;
        }
        cycleNudged = true;
        state.hint = `检测到页面循环（周期 ${cycle}），请选择一个与最近不同的操作。`;
        logger.info('检测到循环，已提示 AI 换操作');
      } else {
        cycleNudged = false;
      }

      if (recentActions.length > 0) {
        state.recentActions = [...recentActions];
      }

      const decision = await this.controller.choose(state);
      const action = allowed.find((item) => item.id === decision.actionId) ?? null;

      if (!action) {
        stopReason = '没有可执行的决策';
        logger.warn(stopReason);
        break;
      }

      // 二次防御：即便上层放行也再拦一次
      if (isForbiddenAction(action)) {
        stopReason = `决策命中付费/退出操作，已拦截：${action.label}`;
        logger.warn(stopReason);
        break;
      }

      logger.info(`执行操作：${action.label}`);
      try {
        page = await this.client.execute(action, decision.fieldValues);
      } catch (error) {
        stopReason = `执行操作失败：${(error as Error).message}`;
        logger.warn(stopReason);
        break;
      }
      recentActions.push(action.label);
      if (recentActions.length > RECENT_ACTION_LIMIT) recentActions.shift();
      await this.sleep(this.config.stepDelayMs);
    }

    const lastState = this.stateManager.current;
    logger.info(`游戏循环结束：${stopReason}（共 ${this.stateManager.step} 步）`);
    return { steps: this.stateManager.step, visited, lastState, stopReason };
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
