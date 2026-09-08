/**
 * WAPGamePlayFramework 入口。
 *
 * 用免费AI（spark-x2.5-1.7b）驱动 WAP 文字游戏自动决策，
 * 游戏过程零付费 token 消耗。
 */

export * from './types';
export type {
  AIConfig,
  ConfigOverrides,
  FrameworkConfig,
  GameConfig,
  LoopConfig,
} from './config';
export { loadConfig } from './config';
export type { LogLevel } from './logger';
export { Logger, logger } from './logger';
export { AIController } from './ai/AIController';
export { FreeAIModel } from './ai/FreeAIModel';
export type { HttpResponse } from './client/HttpClient';
export { HttpClient } from './client/HttpClient';
export { GameClient } from './client/GameClient';
export { WapParser } from './client/WapParser';
export { buildActions } from './game/actionBuilder';
export { GameLoop } from './game/GameLoop';
export { GameStateManager } from './game/GameStateManager';
export type { ResourceSnapshot } from './resource/ResourceManager';
export { PAID_TOKEN_TYPES, ResourceManager } from './resource/ResourceManager';
export type { ReportInput } from './report/HtmlReport';
export { renderHtmlReport } from './report/HtmlReport';
