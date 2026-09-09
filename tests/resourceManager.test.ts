/**
 * ResourceManager 测试 —— 场景 S3：资源提取 + 付费货币标记。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PAID_TOKEN_TYPES, ResourceManager } from '../src/index';

describe('ResourceManager', () => {
  it('提取资源数值（含千分位）', () => {
    const rm = new ResourceManager();
    rm.update('粮食：1,234 铁矿：567 元宝：89', 1);
    const snapshot = rm.snapshot();
    assert.equal(snapshot.food, 1234);
    assert.equal(snapshot.iron, 567);
    assert.equal(snapshot.yuanbao, 89);
  });

  it('标记元宝为付费货币', () => {
    assert.ok(PAID_TOKEN_TYPES.has('yuanbao'));
    const rm = new ResourceManager();
    assert.equal(rm.isPaidToken('yuanbao'), true);
    assert.equal(rm.isPaidToken('food'), false);
  });

  it('记录历史快照', () => {
    const rm = new ResourceManager();
    rm.update('粮食：100', 1);
    rm.update('粮食：200', 2);
    const history = rm.getHistory();
    assert.equal(history.length, 2);
    assert.equal(history[1]?.resources.food, 200);
  });
});
