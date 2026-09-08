/**
 * 极简日志器。
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  private enabled(level: LogLevel): boolean {
    return ORDER[level] >= ORDER[this.level];
  }

  debug(message: string, ...rest: unknown[]): void {
    if (this.enabled('debug')) console.log(`[DEBUG] ${message}`, ...rest);
  }

  info(message: string, ...rest: unknown[]): void {
    if (this.enabled('info')) console.log(`[INFO ] ${message}`, ...rest);
  }

  warn(message: string, ...rest: unknown[]): void {
    if (this.enabled('warn')) console.warn(`[WARN ] ${message}`, ...rest);
  }

  error(message: string, ...rest: unknown[]): void {
    if (this.enabled('error')) console.error(`[ERROR] ${message}`, ...rest);
  }
}

/** 全局共享日志器。 */
export const logger = new Logger('info');
