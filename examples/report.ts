/**
 * 运行游戏并生成 HTML 状态报告（供 GitHub Pages 查看）。
 *
 * 运行：
 *   node dist/examples/report.js
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AIController,
  GameClient,
  GameLoop,
  GameStateManager,
  ResourceManager,
  loadConfig,
  logger,
  renderHtmlReport,
} from '../src/index';

async function main(): Promise<void> {
  const config = loadConfig();
  logger.info(`免费AI：${config.ai.model}`);

  const client = new GameClient(config.game);
  const controller = new AIController(config.ai);
  const resources = new ResourceManager();
  const stateManager = new GameStateManager(resources);
  const loop = new GameLoop(client, controller, stateManager, config.loop);

  const result = await loop.run();

  const html = renderHtmlReport({
    generatedAt: new Date(),
    steps: result.steps,
    stopReason: result.stopReason,
    states: stateManager.getHistory(),
    decisions: controller.decisions,
    aiModel: config.ai.model,
  });

  const outDir = join(process.cwd(), 'docs');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'index.html');
  writeFileSync(outFile, html, 'utf8');
  logger.info(`状态报告已生成：${outFile}`);
}

main().catch((error: unknown) => {
  logger.error(`生成报告失败：${(error as Error).message}`);
  process.exitCode = 1;
});
