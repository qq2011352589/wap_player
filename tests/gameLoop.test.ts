/**
 * GameLoop / AIController 安全与韧性测试。
 * 场景 S5：护栏（无限步数 / 运行时 / 重复页 / 禁用动作 / 网络异常）。
 * RED：F4(启发式选中被禁动作) F5(禁用词只在标签匹配) F6(网络异常直接抛出)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AIController,
  GameClient,
  GameLoop,
  GameStateManager,
  ResourceManager,
  type AIConfig,
  type Decision,
  type GameAction,
  type GameState,
  type LoopConfig,
  type WapPage,
} from '../src/index';

const AI_CONFIG: AIConfig = {
  baseURL: 'http://unused',
  model: 'm',
  apiKey: '',
  temperature: 0,
  maxTokens: 1,
  timeoutMs: 1,
  minRequestIntervalMs: 0,
};

function linkAction(id: string, label: string, href: string): GameAction {
  return { id, kind: 'link', label: `[链接] ${label}`, link: { label, href, raw: href } };
}

function makePage(url: string, actions: GameAction[]): WapPage {
  return {
    url,
    title: 't',
    text: '',
    links: actions.map((action) => action.link!),
    forms: [],
    images: [],
  };
}

function makeState(actions: GameAction[]): GameState {
  return {
    step: 1,
    url: 'http://h/',
    title: 't',
    text: '',
    resources: {},
    actions,
    timestamp: 0,
  };
}

class FakeClient {
  private index = 0;
  constructor(private readonly pages: WapPage[]) {}
  async enter(): Promise<WapPage> {
    return this.pages[0]!;
  }
  async fetch(): Promise<WapPage> {
    return this.pages[0]!;
  }
  async execute(): Promise<WapPage> {
    this.index = Math.min(this.index + 1, this.pages.length - 1);
    return this.pages[this.index]!;
  }
}

class ThrowingClient {
  async enter(): Promise<WapPage> {
    throw new Error('network down');
  }
  async fetch(): Promise<WapPage> {
    throw new Error('network down');
  }
  async execute(): Promise<WapPage> {
    throw new Error('network down');
  }
}

class FixedController {
  constructor(private readonly actionId: string) {}
  async choose(): Promise<Decision> {
    return { actionId: this.actionId, rationale: 'fixed', confidence: 1, source: 'heuristic' };
  }
}

function makeLoop(client: unknown, controller: unknown, overrides: Partial<LoopConfig>): GameLoop {
  const stateManager = new GameStateManager(new ResourceManager());
  const config: LoopConfig = {
    maxSteps: 1,
    stepDelayMs: 0,
    maxRepeatedUrls: 5,
    maxRuntimeMs: 0,
    ...overrides,
  };
  return new GameLoop(
    client as unknown as GameClient,
    controller as unknown as AIController,
    stateManager,
    config,
  );
}

describe('AIController 启发式（F4）', () => {
  it('RED F4: 所有动作得分<=0 时，不得选中被禁用动作', () => {
    const controller = new AIController(AI_CONFIG);
    const decision = controller.heuristicDecide(
      makeState([
        linkAction('A', '充值', 'http://h/pay'),
        linkAction('B', '查看', 'http://h/view'),
      ]),
    );
    assert.notEqual(decision.actionId, 'A');
  });
});

describe('GameLoop 安全与韧性', () => {
  it('RED F5: 标签无害但 href 命中禁用词的操作应被拦截', async () => {
    const page = makePage('http://h/', [linkAction('L0', '查看', 'http://h/vip')]);
    const loop = makeLoop(new FakeClient([page]), new FixedController('L0'), { maxSteps: 1 });
    const result = await loop.run();
    assert.match(result.stopReason, /付费|拦截/);
  });

  it('RED F6: 网络异常应优雅停止而非抛出', async () => {
    const loop = makeLoop(new ThrowingClient(), new FixedController('L0'), { maxSteps: 1 });
    const result = await loop.run();
    assert.match(result.stopReason, /失败/);
  });
});
