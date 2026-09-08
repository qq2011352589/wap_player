/**
 * 示例：用免费AI自动游玩 WAP 游戏。
 *
 * 运行：
 *   npm run play
 */

import {
  AIController,
  GameClient,
  GameLoop,
  GameStateManager,
  ResourceManager,
  loadConfig,
  logger,
} from '../src/index';

async function main(): Promise<void> {
  const config = loadConfig({
    loop: {
      maxSteps: 20,
      stepDelayMs: 500,
      maxRepeatedUrls: 3,
    },
  });

  if (!config.ai.apiKey) {
    logger.warn('未找到免费AI密钥（MAAS_XUNFEI_API_KEY），将退化为启发式决策。');
  } else {
    logger.info(`免费AI：${config.ai.model} @ ${config.ai.baseURL}`);
  }

  const client = new GameClient(config.game);
  const controller = new AIController(config.ai);
  const resources = new ResourceManager();
  const stateManager = new GameStateManager(resources);
  const loop = new GameLoop(client, controller, stateManager, config.loop);

  const result = await loop.run();

  console.log('\n===== 运行结果 =====');
  console.log(`步数：${result.steps}`);
  console.log(`停止原因：${result.stopReason}`);
  console.log(`最后资源：${JSON.stringify(result.lastState?.resources ?? {})}`);
  console.log('最近决策：');
  for (const decision of controller.decisions.slice(-5)) {
    console.log(`  [${decision.source}] ${decision.actionId ?? '无'} - ${decision.rationale}`);
  }
}

main().catch((error: unknown) => {
  logger.error(`运行失败：${(error as Error).message}`);
  process.exitCode = 1;
});
