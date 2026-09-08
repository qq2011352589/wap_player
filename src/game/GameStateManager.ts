/**
 * GameStateManager - 游戏状态管理。
 *
 * 把每一步的页面与资源快照组织成统一的 GameState，并保留历史。
 */

import type { ResourceManager } from '../resource/ResourceManager';
import type { GameAction, GameState, WapPage } from '../types';

export class GameStateManager {
  private readonly resources: ResourceManager;
  private stepCount = 0;
  private readonly history: GameState[] = [];

  constructor(resources: ResourceManager) {
    this.resources = resources;
  }

  get step(): number {
    return this.stepCount;
  }

  get current(): GameState | null {
    return this.history[this.history.length - 1] ?? null;
  }

  getHistory(): ReadonlyArray<GameState> {
    return this.history;
  }

  /** 基于当前页面构建状态快照。 */
  build(page: WapPage, actions: GameAction[]): GameState {
    this.stepCount += 1;
    this.resources.update(page.text, this.stepCount);

    const state: GameState = {
      step: this.stepCount,
      url: page.url,
      title: page.title,
      text: page.text,
      resources: this.resources.snapshot(),
      actions,
      timestamp: Date.now(),
    };

    this.history.push(state);
    return state;
  }
}
