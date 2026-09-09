/**
 * WapParser 测试 —— 特征化当前行为 + RED 用例暴露已知缺陷。
 *
 * 场景：S1 正常页面解析 / S2 畸形与边界。
 * RED 缺陷：F1(前缀属性误匹配) F2(未加引号属性丢失) F13(图片链接未关联)
 *          F15(按钮值二次解码) F17(selected 误判 / checked 未解析)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WapParser } from '../src/index';

const BASE = 'http://example.com/game/';

function parse(html: string) {
  return new WapParser().parse(BASE, html);
}

describe('S1 正常页面解析（特征化）', () => {
  it('提取链接与绝对地址', () => {
    const page = parse('<a href="/go">出征</a><a href="http://x.cn/a">外链</a>');
    assert.equal(page.links.length, 2);
    assert.equal(page.links[0]?.label, '出征');
    assert.equal(page.links[0]?.href, 'http://example.com/go');
    assert.equal(page.links[1]?.href, 'http://x.cn/a');
  });

  it('图片链接使用 img 的 alt 作为标签', () => {
    const page = parse('<a href="/fight"><img src="/a.png" alt="攻击"></a>');
    assert.equal(page.links.length, 1);
    assert.equal(page.links[0]?.label, '攻击');
  });

  it('解析表单的文本/隐藏/下拉/文本域字段', () => {
    const html = `<form action="/do" method="post">
      <input type="text" name="keyword" placeholder="搜索">
      <input type="hidden" name="csrf" value="abc">
      <select name="type"><option value="1">粮食</option><option value="2" selected>铁矿</option></select>
      <textarea name="note">hi</textarea>
    </form>`;
    const page = parse(html);
    assert.equal(page.forms.length, 1);
    const form = page.forms[0];
    assert.equal(form?.method, 'POST');
    assert.equal(form?.action, 'http://example.com/do');

    const byName = new Map(form?.fields.map((f) => [f.name, f]));
    assert.equal(byName.get('keyword')?.type, 'text');
    assert.equal(byName.get('keyword')?.placeholder, '搜索');
    assert.equal(byName.get('csrf')?.value, 'abc');
    assert.equal(byName.get('type')?.type, 'select');
    assert.equal(byName.get('type')?.options?.length, 2);
    assert.equal(byName.get('type')?.value, '2'); // selected option
    assert.equal(byName.get('note')?.value, 'hi');
  });

  it('解析图片 src 与 alt 并绝对化', () => {
    const page = parse('<img src="/a.png" alt="装饰">');
    assert.equal(page.images.length, 1);
    assert.equal(page.images[0]?.src, 'http://example.com/a.png');
    assert.equal(page.images[0]?.alt, '装饰');
  });

  it('解码常见 HTML 实体', () => {
    const page = parse('<a href="/x">A &amp; B &lt;C&gt;</a>');
    assert.equal(page.links[0]?.label, 'A & B <C>');
  });

  it('F16: 解码十进制数字实体', () => {
    const page = parse('<a href="/x">A &#8211; B</a>');
    assert.equal(page.links[0]?.label, 'A – B');
  });

  it('F16: 解码十六进制数字实体', () => {
    const page = parse('<a href="/x">&#x27;q&#x27;</a>');
    assert.equal(page.links[0]?.label, "'q'");
  });
});

describe('S2 边界与畸形输入（特征化）', () => {
  it('空字符串不抛错且各列表为空', () => {
    const page = parse('');
    assert.deepEqual(page.links, []);
    assert.deepEqual(page.forms, []);
    assert.deepEqual(page.images, []);
  });

  it('未闭合标签不抛错', () => {
    assert.doesNotThrow(() => parse('<a href="/x">未闭合<form><input name="a">'));
  });

  it('排除 javascript: 与 # 链接', () => {
    const page = parse('<a href="javascript:void(0)">JS</a><a href="#top">锚</a><a href="/ok">好</a>');
    assert.equal(page.links.length, 1);
    assert.equal(page.links[0]?.label, '好');
  });
});

describe('RED 缺陷（当前应失败，修复后转 GREEN）', () => {
  it('F1: data-* 前缀属性不得冒充真实属性', () => {
    const page = parse('<a data-href="/wrong" href="/right">正确</a>');
    assert.equal(page.links[0]?.href, 'http://example.com/right');

    const page2 = parse(
      '<form action="/d"><input type="text" data-name="wrong" name="right" value="v"></form>',
    );
    assert.equal(page2.forms[0]?.fields[0]?.name, 'right');
  });

  it('F2: 未加引号的属性应被解析', () => {
    const page = parse('<a href=/plain>无引号</a>');
    assert.equal(page.links.length, 1);
    assert.equal(page.links[0]?.href, 'http://example.com/plain');

    const page2 = parse('<form action=/do method=post><input type=text name=q></form>');
    assert.equal(page2.forms[0]?.fields[0]?.name, 'q');
  });

  it('F13: 图片链接应回填 GameImage.link', () => {
    const page = parse('<a href="/fight"><img src="/a.png" alt="攻击"></a>');
    assert.equal(page.images.length, 1);
    assert.equal(page.images[0]?.link?.href, 'http://example.com/fight');
    assert.equal(page.images[0]?.link?.label, '攻击');
  });

  it('F15: 按钮值只解码一次', () => {
    const page = parse('<form action="/d"><button name="b">A&amp;amp;B</button></form>');
    const field = page.forms[0]?.fields.find((f) => f.name === 'b');
    assert.equal(field?.value, 'A&amp;B'); // 单次解码，而非 A&B
  });

  it('F17: data-selected/aria-selected 不得被当作 selected；checked 应解析', () => {
    const html = `<form action="/d">
      <select name="s">
        <option value="1" data-selected="false">甲</option>
        <option value="2" aria-selected="true">乙</option>
      </select>
      <input type="checkbox" name="agree" checked value="1">
    </form>`;
    const page = parse(html);
    const select = page.forms[0]?.fields.find((f) => f.name === 's');
    // 两个 option 都未被真正 selected → 默认取第一个
    assert.equal(select?.value, '1');

    const checkbox = page.forms[0]?.fields.find((f) => f.name === 'agree') as
      | { checked?: boolean }
      | undefined;
    assert.equal(checkbox?.checked, true);
  });
});
