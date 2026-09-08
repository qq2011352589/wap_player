/**
 * 端到端冒烟测试：
 * 登录 -> 解析页面 -> 构建操作 -> 资源识别 -> 免费AI决策 -> 执行一步。
 *
 * 运行：node dist/examples/smoke.js
 */

import {
  AIController,
  GameClient,
  GameStateManager,
  ResourceManager,
  buildActions,
  loadConfig,
  logger,
} from '../src/index';

async function main(): Promise<void> {
  const config = loadConfig({ logLevel: 'info' });
  logger.info(`免费AI：${config.ai.model}（key长度=${config.ai.apiKey.length}）`);

  const client = new GameClient(config.game);
  const page = await client.enter();
  console.log('\n[1] 登录成功');
  console.log(`    title = ${page.title}`);
  console.log(`    url   = ${page.url}`);
  console.log(`    links = ${page.links.length}, forms = ${page.forms.length}`);

  const actions = buildActions(page);
  console.log('\n[2] 可执行操作（前8个）');
  for (const action of actions.slice(0, 8)) {
    console.log(`    ${action.id}: ${action.label}`);
  }

  const resources = new ResourceManager();
  const stateManager = new GameStateManager(resources);
  const state = stateManager.build(page, actions);
  console.log('\n[3] 资源识别');
  console.log(`    ${JSON.stringify(state.resources)}`);

  const controller = new AIController(config.ai);
  console.log('\n[4] 免费AI决策中...');
  const decision = await controller.choose(state);
  console.log(`    source     = ${decision.source}`);
  console.log(`    actionId   = ${decision.actionId}`);
  console.log(`    confidence = ${decision.confidence}`);
  console.log(`    rationale  = ${decision.rationale}`);

  const chosen = actions.find((action) => action.id === decision.actionId);
  if (chosen) {
    console.log('\n[5] 执行决策中...');
    const next = await client.execute(chosen);
    console.log(`    next title = ${next.title}`);
    console.log(`    next url   = ${next.url}`);
    console.log(`    next links = ${next.links.length}`);
  } else {
    console.log('\n[5] 无有效操作可执行');
  }

  console.log('\n===== 冒烟测试通过 =====');
}

main().catch((error: unknown) => {
  console.error('冒烟测试失败：', (error as Error).message);
  process.exitCode = 1;
});
