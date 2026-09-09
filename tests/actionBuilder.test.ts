/**
 * actionBuilder 测试 —— 特征化操作生成与字段提示。
 * 场景 S1（正常页面 -> 可执行操作）。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WapParser, buildActions } from '../src/index';

const BASE = 'http://example.com/game/';
function parse(html: string) {
  return new WapParser().parse(BASE, html);
}

describe('actionBuilder', () => {
  it('链接生成 L 编号操作', () => {
    const actions = buildActions(parse('<a href="/a">甲</a><a href="/b">乙</a>'));
    assert.equal(actions.length, 2);
    assert.equal(actions[0]?.id, 'L0');
    assert.equal(actions[0]?.label, '[链接] 甲');
    assert.equal(actions[1]?.id, 'L1');
  });

  it('表单生成 F 编号操作并提示可填写字段', () => {
    const html =
      '<form action="/s" method="post"><input type="text" name="keyword" placeholder="搜索"><select name="type"><option value="1">粮食</option></select></form>';
    const actions = buildActions(parse(html));
    const form = actions.find((action) => action.kind === 'form');
    assert.ok(form, '应生成表单操作');
    assert.equal(form?.id, 'F0');
    assert.match(form?.label ?? '', /keyword\(搜索\)/);
    assert.match(form?.label ?? '', /type\(下拉:粮食\)/);
  });

  it('相同 href 的链接去重', () => {
    const actions = buildActions(parse('<a href="/a">甲</a><a href="/a">乙</a>'));
    assert.equal(actions.length, 1);
  });

  it('图片链接只生成一个带 alt 标签的链接操作', () => {
    const actions = buildActions(parse('<a href="/fight"><img src="/a.png" alt="攻击"></a>'));
    assert.equal(actions.length, 1);
    assert.equal(actions[0]?.label, '[链接] 攻击');
  });
});
