/**
 * 查看当前游戏状态：登录态、页面、识别资源、可选操作。
 *
 * 用法：
 *   node dist/examples/status.js                 # 查看登录后的入口页状态
 *   node dist/examples/status.js <url>           # 登录后跳转到指定页面查看状态
 */

import {
  GameClient,
  GameStateManager,
  ResourceManager,
  buildActions,
  loadConfig,
} from '../src/index';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new GameClient(config.game);

  // 先登录，保持会话
  let page = await client.enter();

  const targetUrl = process.argv[2];
  if (targetUrl) {
    page = await client.fetch(targetUrl);
  }

  const actions = buildActions(page);
  const resources = new ResourceManager();
  const stateManager = new GameStateManager(resources);
  const state = stateManager.build(page, actions);

  const cookies = Object.keys(client.cookies);

  console.log('===== 当前游戏状态 =====');
  console.log(`登录态   : ${cookies.length > 0 ? `已登录（${cookies.join(', ')}）` : '未登录'}`);
  console.log(`页面标题 : ${state.title}`);
  console.log(`页面地址 : ${state.url}`);
  console.log(`识别资源 : ${Object.keys(state.resources).length > 0 ? JSON.stringify(state.resources) : '（当前页未显示资源数值）'}`);
  console.log(`可选操作 : ${state.actions.length} 个`);
  console.log('');
  console.log('操作列表（前 15 个）：');
  for (const action of state.actions.slice(0, 15)) {
    console.log(`  ${action.id.padEnd(5)} ${action.label}`);
  }

  console.log('');
  console.log('===== 状态快照 JSON =====');
  console.log(
    JSON.stringify(
      {
        title: state.title,
        url: state.url,
        resources: state.resources,
        actionCount: state.actions.length,
        actions: state.actions.map((action) => ({ id: action.id, label: action.label })),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error('查看状态失败：', (error as Error).message);
  process.exitCode = 1;
});
