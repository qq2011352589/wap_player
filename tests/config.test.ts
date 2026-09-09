/**
 * config 测试 —— 场景 S4：优先级 + 非法环境变量。
 * RED：F7(非法数字静默关闭护栏) F8(非法 LOG_LEVEL 静默全部日志)
 */

import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, logger } from '../src/index';

const MANAGED_ENV = [
  'MAAS_XUNFEI_MODEL',
  'MAAS_XUNFEI_BASE_URL',
  'MAAS_XUNFEI_API_KEY',
  'WAP_USERNAME',
  'WAP_PASSWORD',
  'LOOP_MAX_STEPS',
  'LOOP_MAX_RUNTIME_MINUTES',
  'LOOP_MAX_REPEATED_URLS',
  'LOG_LEVEL',
  'HOME',
];

describe('config', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;
  let tempDir: string;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'wap-cfg-'));
    process.chdir(tempDir);
    for (const key of MANAGED_ENV) delete process.env[key];
    process.env.HOME = tempDir; // 隔离，避免读取真实 auth.json
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('默认使用免费模型且无限步数', () => {
    const config = loadConfig();
    assert.equal(config.ai.model, 'spark-x2.5-1.7b');
    assert.equal(config.loop.maxSteps, 0);
    assert.equal(config.loop.maxRuntimeMs, 0);
  });

  it('环境变量覆盖默认值', () => {
    process.env.MAAS_XUNFEI_MODEL = 'custom-model';
    process.env.LOOP_MAX_STEPS = '7';
    const config = loadConfig();
    assert.equal(config.ai.model, 'custom-model');
    assert.equal(config.loop.maxSteps, 7);
  });

  it('.env 文件填补空缺', () => {
    writeFileSync(join(tempDir, '.env'), 'WAP_USERNAME=from_dotenv\n');
    const config = loadConfig();
    assert.equal(config.game.username, 'from_dotenv');
  });

  it('RED F7: 非法数字环境变量不应静默关闭护栏', () => {
    process.env.LOOP_MAX_STEPS = 'abc';
    process.env.LOOP_MAX_RUNTIME_MINUTES = 'xyz';
    process.env.LOOP_MAX_REPEATED_URLS = 'nope';
    const config = loadConfig();
    assert.ok(Number.isFinite(config.loop.maxSteps), 'maxSteps 必须是有限数');
    assert.ok(Number.isFinite(config.loop.maxRuntimeMs), 'maxRuntimeMs 必须是有限数');
    assert.ok(Number.isFinite(config.loop.maxRepeatedUrls), 'maxRepeatedUrls 必须是有限数');
  });

  it('RED F8: 非法 LOG_LEVEL 不应让日志全静默', () => {
    process.env.LOG_LEVEL = 'bogus';
    const config = loadConfig();
    assert.notEqual(config.logLevel, 'bogus');
    assert.equal(logger.getLevel(), 'info');
  });
});
