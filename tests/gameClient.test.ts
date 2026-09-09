/**
 * GameClient 表单提交测试 —— 特征化 POST + RED 用例 F9/F18。
 * 通过 mock 全局 fetch 捕获真实请求 URL 与 body。
 */

import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { GameClient, type GameAction } from '../src/index';

const CONFIG = {
  entryUrl: 'http://h/',
  username: 'u',
  password: 'p',
  userAgent: 'test-agent',
};

interface CapturedRequest {
  url: string;
  init?: RequestInit;
}

function captureFetch(t: TestContext): CapturedRequest[] {
  const requests: CapturedRequest[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    return new Response('<html><body>ok</body></html>', { status: 200 });
  });
  return requests;
}

function formAction(
  action: string,
  method: 'GET' | 'POST',
  fields: Array<{ name: string; value: string }>,
): GameAction {
  return {
    id: 'F0',
    kind: 'form',
    label: '[表单]',
    form: {
      action,
      method,
      fields: fields.map((field) => ({ name: field.name, type: 'text', value: field.value })),
    },
  };
}

describe('GameClient 表单提交', () => {
  it('POST 表单发送字段（特征化）', async (t) => {
    const requests = captureFetch(t);
    await new GameClient(CONFIG).execute(
      formAction('http://h/do', 'POST', [{ name: 'a', value: '1' }]),
    );
    assert.equal(requests[0]?.url, 'http://h/do');
    assert.equal(requests[0]?.init?.body, 'a=1');
  });

  it('RED F9: GET 表单应合并已有 query，而不是再拼一个 ?', async (t) => {
    const requests = captureFetch(t);
    await new GameClient(CONFIG).execute(
      formAction('http://h/do.php?sid=1', 'GET', [{ name: 'x', value: 'y' }]),
    );
    assert.equal(requests[0]?.url, 'http://h/do.php?sid=1&x=y');
  });

  it('RED F18: GET 表单应保留重名字段', async (t) => {
    const requests = captureFetch(t);
    await new GameClient(CONFIG).execute(
      formAction('http://h/do', 'GET', [
        { name: 'tag', value: 'a' },
        { name: 'tag', value: 'b' },
      ]),
    );
    assert.equal(requests[0]?.url, 'http://h/do?tag=a&tag=b');
  });

  it('RED F18: POST 表单应保留重名字段', async (t) => {
    const requests = captureFetch(t);
    await new GameClient(CONFIG).execute(
      formAction('http://h/do', 'POST', [
        { name: 'tag', value: 'a' },
        { name: 'tag', value: 'b' },
      ]),
    );
    assert.equal(requests[0]?.init?.body, 'tag=a&tag=b');
  });
});
