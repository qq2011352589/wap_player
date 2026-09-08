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
  /** 最大执行步数，防止无限循环 */
  maxSteps: number;
  /** 每步之间的间隔 */
  stepDelayMs: number;
  /** 同一 URL 允许重复访问的最大次数，用于打破死循环 */
  maxRepeatedUrls: number;
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
    username: 'a1345772',
    password: 'a1345772',
    userAgent:
      'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 WAPGamePlayFramework/1.0',
  },
  loop: {
    maxSteps: 50,
    stepDelayMs: 800,
    maxRepeatedUrls: 3,
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

/**
 * 加载配置。优先级：显式 overrides < 环境变量 < 内置默认值。
 */
export function loadConfig(overrides?: ConfigOverrides): FrameworkConfig {
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

  if (env.LOOP_MAX_STEPS) loop.maxSteps = Number(env.LOOP_MAX_STEPS);
  if (env.LOOP_STEP_DELAY_MS) loop.stepDelayMs = Number(env.LOOP_STEP_DELAY_MS);

  const logLevel = (env.LOG_LEVEL as LogLevel | undefined) ?? overrides?.logLevel ?? DEFAULTS.logLevel;

  const config: FrameworkConfig = {
    ai,
    game,
    loop,
    logLevel,
  };

  logger.setLevel(config.logLevel);
  return config;
}
