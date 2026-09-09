/**
 * 测试脚手架自检：证明 node:test 发现、TS 编译、模块导入链路都通。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResourceManager, WapParser, loadConfig } from '../src/index';

test('harness: 框架核心导出可导入', () => {
  assert.equal(typeof WapParser, 'function');
  assert.equal(typeof ResourceManager, 'function');
  assert.equal(typeof loadConfig, 'function');
});

test('harness: WapParser 可实例化并解析空字符串', () => {
  const page = new WapParser().parse('http://example.com/', '');
  assert.equal(page.links.length, 0);
  assert.equal(page.forms.length, 0);
  assert.equal(page.images.length, 0);
});
