/**
 * 框架配置。
 *
 * 免费AI固定指向 spark-x2.5-1.7b，保证游戏过程不产生付费 token 消耗。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logger, type LogLevel } from './logger';

export interface AIConfig {
  baseURL: string;
  model: string;
  apiKey: string;
  temperature: number;
  /** 推理模型需要较大的 maxTokens 才能输出正式内容 */
  maxTokens: number;
  timeoutMs: number;
  /** 两次AI请求之间的最小间隔，避免限流 */
  minRequestIntervalMs: number;
}

export interface GameConfig {
  entryUrl: string;
  username: string;
  password: string;
  userAgent: string;
}

export interface LoopConfig {
  /** 最大执行步数；0 表示无限步数（免费AI，无成本顾虑） */
  maxSteps: number;
  /** 每步之间的间隔 */
  stepDelayMs: number;
  /** 连续停留在同一页面的最大次数，用于打破死循环；0 表示禁用 */
  maxRepeatedUrls: number;
  /** 最长运行时间（毫秒）；0 表示无限。用于在 CI 作业超时前优雅停止并提交报告 */
  maxRuntimeMs: number;
}

export interface FrameworkConfig {
  ai: AIConfig;
  game: GameConfig;
  loop: LoopConfig;
  logLevel: LogLevel;
}

export interface ConfigOverrides {
  ai?: Partial<AIConfig>;
  game?: Partial<GameConfig>;
  loop?: Partial<LoopConfig>;
  logLevel?: LogLevel;
}

const DEFAULTS: FrameworkConfig = {
  ai: {
    baseURL: 'https://maas-api.cn-huabei-1.xf-yun.com/v2',
    model: 'spark-x2.5-1.7b',
    apiKey: '',
    temperature: 0.1,
    maxTokens: 2048,
    timeoutMs: 90000,
    minRequestIntervalMs: 1500,
  },
  game: {
    entryUrl: 'http://fysg.n6game.cn/tdcq_player/index/',
    username: '',
    password: '',
    userAgent:
      'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 WAPGamePlayFramework/1.0',
  },
  loop: {
    maxSteps: 0,
    stepDelayMs: 800,
    maxRepeatedUrls: 5,
    maxRuntimeMs: 0,
  },
  logLevel: 'info',
};

/** 从 opencode 的 auth.json 中读取讯飞免费AI密钥。 */
function readXunfeiKeyFromOpencode(): string {
  try {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
    if (!home) return '';
    const path = join(home, '.local', 'share', 'opencode', 'auth.json');
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as { maas_xunfei?: { key?: string } };
    return parsed.maas_xunfei?.key ?? '';
  } catch {
    return '';
  }
}

/** 读取当前目录下的 .env（若存在），把键值注入 process.env（不覆盖已有值）。 */
function loadDotEnv(): void {
  try {
    const raw = readFileSync(join(process.cwd(), '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // 无 .env 文件时忽略
  }
}

/** 合法日志级别，用于校验 LOG_LEVEL。 */
const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];

/** 解析环境变量数字；非法值回退并告警，绝不静默变成 NaN 关闭护栏。 */
function parseFiniteNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    logger.warn(`忽略非法数字环境变量值：${raw}`);
    return fallback;
  }
  return value;
}

/**
 * 加载配置。优先级：显式 overrides < 环境变量 < 内置默认值。
 */
export function loadConfig(overrides?: ConfigOverrides): FrameworkConfig {
  loadDotEnv();
  const env = process.env;

  const ai: AIConfig = { ...DEFAULTS.ai, ...(overrides?.ai ?? {}) };
  const game: GameConfig = { ...DEFAULTS.game, ...(overrides?.game ?? {}) };
  const loop: LoopConfig = { ...DEFAULTS.loop, ...(overrides?.loop ?? {}) };

  ai.apiKey = env.MAAS_XUNFEI_API_KEY || readXunfeiKeyFromOpencode() || ai.apiKey;
  ai.baseURL = env.MAAS_XUNFEI_BASE_URL || ai.baseURL;
  ai.model = env.MAAS_XUNFEI_MODEL || ai.model;

  game.entryUrl = env.WAP_ENTRY_URL || game.entryUrl;
  game.username = env.WAP_USERNAME || game.username;
  game.password = env.WAP_PASSWORD || game.password;

  if (env.LOOP_MAX_STEPS) loop.maxSteps = parseFiniteNumber(env.LOOP_MAX_STEPS, loop.maxSteps);
  if (env.LOOP_STEP_DELAY_MS) {
    loop.stepDelayMs = parseFiniteNumber(env.LOOP_STEP_DELAY_MS, loop.stepDelayMs);
  }
  if (env.LOOP_MAX_REPEATED_URLS) {
    loop.maxRepeatedUrls = parseFiniteNumber(env.LOOP_MAX_REPEATED_URLS, loop.maxRepeatedUrls);
  }
  if (env.LOOP_MAX_RUNTIME_MINUTES) {
    const minutes = parseFiniteNumber(env.LOOP_MAX_RUNTIME_MINUTES, loop.maxRuntimeMs / 60_000);
    loop.maxRuntimeMs = minutes * 60_000;
  }

  const rawLogLevel = env.LOG_LEVEL;
  const validLogLevel = rawLogLevel && LOG_LEVELS.includes(rawLogLevel as LogLevel);
  if (rawLogLevel && !validLogLevel) {
    logger.warn(`忽略非法 LOG_LEVEL：${rawLogLevel}`);
  }
  const logLevel: LogLevel = validLogLevel
    ? (rawLogLevel as LogLevel)
    : (overrides?.logLevel ?? DEFAULTS.logLevel);

  const config: FrameworkConfig = {
    ai,
    game,
    loop,
    logLevel,
  };

  logger.setLevel(config.logLevel);
  return config;
}
