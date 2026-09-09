/**
 * detectUrlCycle 单元测试。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectUrlCycle } from '../src/index';

const A = 'http://h/a';
const B = 'http://h/b';
const C = 'http://h/c';
const D = 'http://h/d';
const E = 'http://h/e';
const F = 'http://h/f';

describe('detectUrlCycle', () => {
  it('历史不足时不判定', () => {
    assert.equal(detectUrlCycle([]), null);
    assert.equal(detectUrlCycle([A, B]), null);
    assert.equal(detectUrlCycle([A, B, A]), null);
  });

  it('识别周期 2 的交替循环', () => {
    assert.equal(detectUrlCycle([A, B, A, B]), 2);
    assert.equal(detectUrlCycle([A, B, A, B, A, B]), 2);
  });

  it('识别周期 3 的循环', () => {
    assert.equal(detectUrlCycle([A, B, C, A, B, C]), 3);
    assert.equal(detectUrlCycle([A, B, C, A, B, C, A]), 3);
  });

  it('非循环返回 null', () => {
    assert.equal(detectUrlCycle([A, B, C, D, E, F]), null);
    assert.equal(detectUrlCycle([A, A, B, B]), null);
  });

  it('只回看最近窗口，历史噪声不影响', () => {
    assert.equal(detectUrlCycle([C, C, C, A, B, A, B]), 2);
  });
});
