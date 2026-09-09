/**
 * FreeAIModel 测试 —— 场景 S6：决策 JSON 解析 + fieldValues。
 * RED：F3(贪婪 JSON 正则遇多余花括号/多对象时解析失败)
 */

import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { FreeAIModel, type AIConfig, type GameState } from '../src/index';

const CONFIG: AIConfig = {
  baseURL: 'http://ai/v1',
  model: 'm',
  apiKey: 'test-key',
  temperature: 0,
  maxTokens: 10,
  timeoutMs: 1000,
  minRequestIntervalMs: 0,
};

function mockAIContent(t: TestContext, content: string): void {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
}

function makeState(ids: string[]): GameState {
  return {
    step: 1,
    url: 'http://h/',
    title: 't',
    text: '',
    resources: {},
    actions: ids.map((id) => ({
      id,
      kind: 'link',
      label: `[链接] ${id}`,
      link: { label: id, href: `http://h/${id}`, raw: `/${id}` },
    })),
    timestamp: 0,
  };
}

describe('FreeAIModel 决策解析', () => {
  it('特征化：合法 JSON -> free-ai 决策', async (t) => {
    mockAIContent(
      t,
      '{"actionId":"L0","rationale":"选L0","confidence":0.9,"fieldValues":{"a":"1"}}',
    );
    const decision = await new FreeAIModel(CONFIG).decide(makeState(['L0', 'L1']));
    assert.equal(decision.source, 'free-ai');
    assert.equal(decision.actionId, 'L0');
    assert.equal(decision.confidence, 0.9);
    assert.deepEqual(decision.fieldValues, { a: '1' });
  });

  it('特征化：非法 actionId -> 回退', async (t) => {
    mockAIContent(t, '{"actionId":"NOPE","rationale":"x","confidence":0.5}');
    const decision = await new FreeAIModel(CONFIG).decide(makeState(['L0']));
    assert.equal(decision.actionId, null);
  });

  it('特征化：未配置密钥 -> 回退', async () => {
    const model = new FreeAIModel({ ...CONFIG, apiKey: '' });
    const decision = await model.decide(makeState(['L0']));
    assert.equal(decision.actionId, null);
    assert.equal(decision.source, 'fallback');
  });

  it('特征化：无可用操作 -> 回退', async () => {
    const decision = await new FreeAIModel(CONFIG).decide(makeState([]));
    assert.equal(decision.actionId, null);
  });

  it('RED F3: 多余花括号不应导致解析失败', async (t) => {
    mockAIContent(
      t,
      '分析如下 {"actionId":"L0","rationale":"选L0","confidence":0.9,"fieldValues":{"a":"1"}} 备注：} 结束',
    );
    const decision = await new FreeAIModel(CONFIG).decide(makeState(['L0', 'L1']));
    assert.equal(decision.source, 'free-ai');
    assert.equal(decision.actionId, 'L0');
  });

  it('RED F3: 两个 JSON 对象应取第一个', async (t) => {
    mockAIContent(
      t,
      '{"actionId":"L0","rationale":"first","confidence":0.9} {"actionId":"L1","rationale":"second","confidence":0.5}',
    );
    const decision = await new FreeAIModel(CONFIG).decide(makeState(['L0', 'L1']));
    assert.equal(decision.source, 'free-ai');
    assert.equal(decision.actionId, 'L0');
  });

  it('hint 应出现在 AI 提示词中', async (t) => {
    let capturedBody = '';
    t.mock.method(globalThis, 'fetch', async (_url: string, init?: RequestInit) => {
      capturedBody = String(init?.body ?? '');
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"actionId":"L0","rationale":"x","confidence":0.5}' } }],
        }),
        { status: 200 },
      );
    });
    const state = makeState(['L0']);
    state.hint = '检测到循环，请换操作';
    await new FreeAIModel(CONFIG).decide(state);
    assert.match(capturedBody, /检测到循环/);
  });
});
