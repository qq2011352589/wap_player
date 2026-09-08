/**
 * FreeAIModel - 免费AI模型客户端。
 *
 * 通过 OpenAI 兼容接口调用 spark-x2.5-1.7b（彻底免费），
 * 由模型在“当前页面状态 + 可选操作”中选出下一步操作。
 */

import type { AIConfig } from '../config';
import { logger } from '../logger';
import type { Decision, GameState } from '../types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatChoice {
  message?: { content?: string; reasoning_content?: string };
}

interface ChatResponse {
  choices?: ChatChoice[];
  error?: { message?: string };
}

const SYSTEM_PROMPT = [
  '你是一个 WAP 文字游戏的自动决策助手。',
  '你会收到当前游戏页面状态和一组可选操作。',
  '请只输出一个 JSON 对象，格式：',
  '{"actionId":"<操作编号>","rationale":"<简短中文理由>","confidence":<0到1的数字>}',
  'actionId 必须是给定操作编号之一。不要输出 JSON 以外的任何内容。',
  '如果选中的是表单，且表单提示里有“可填写”字段，可在 JSON 中增加 fieldValues 对象来填写，例如：',
  '{"actionId":"F0","rationale":"搜索粮食","confidence":0.9,"fieldValues":{"keyword":"粮食","amount":"100"}}',
  'fieldValues 的键必须是表单提示中列出的字段名；下拉字段只能填提示给出的选项。',
  '优先选择能推进任务、采集资源、建造升级、领取奖励的操作；',
  '绝对不要选择会消耗付费货币（元宝）或退出登录的操作。',
].join('\n');

export class FreeAIModel {
  private readonly config: AIConfig;
  private lastRequestAt = 0;

  constructor(config: AIConfig) {
    this.config = config;
  }

  get isConfigured(): boolean {
    return this.config.apiKey.trim().length > 0;
  }

  /** 请求模型给出决策；失败时返回 actionId=null，由上层兜底。 */
  async decide(state: GameState): Promise<Decision> {
    if (!this.isConfigured) {
      return { actionId: null, rationale: '未配置免费AI密钥', confidence: 0, source: 'fallback' };
    }
    if (state.actions.length === 0) {
      return { actionId: null, rationale: '当前页面没有可选操作', confidence: 0, source: 'fallback' };
    }

    await this.throttle();
    try {
      const content = await this.chatWithRetry([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: this.buildUserPrompt(state) },
      ]);
      const decision = this.parseDecision(content, state);
      if (decision) return decision;
      logger.warn('免费AI输出无法解析为有效决策，转用启发式');
    } catch (error) {
      logger.warn(`免费AI调用失败：${(error as Error).message}，转用启发式`);
    }
    return { actionId: null, rationale: 'AI不可用', confidence: 0, source: 'fallback' };
  }

  private buildUserPrompt(state: GameState): string {
    const actionLines = state.actions.map((action) => `[${action.id}] ${action.label}`).join('\n');
    const resourceLines =
      Object.entries(state.resources)
        .map(([key, value]) => `${key}=${value}`)
        .join('，') || '（未识别）';
    return [
      `当前页面标题：${state.title}`,
      `当前页面地址：${state.url}`,
      `已识别资源：${resourceLines}`,
      `页面正文摘要：${state.text.slice(0, 1200)}`,
      '',
      '可选操作：',
      actionLines,
      '',
      '请选择最有利于长期发展、且不会消耗元宝的操作。',
    ].join('\n');
  }

  /** 推理模型偶尔会把全部额度用于思考，这里在空返回时自动加大额度重试一次。 */
  private async chatWithRetry(messages: ChatMessage[]): Promise<string> {
    try {
      return await this.chat(messages, this.config.maxTokens);
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('为空')) {
        const retryTokens = Math.max(this.config.maxTokens * 2, 4096);
        logger.warn(`免费AI首次返回为空，使用 maxTokens=${retryTokens} 重试`);
        return await this.chat(messages, retryTokens);
      }
      throw error;
    }
  }

  private async chat(messages: ChatMessage[], maxTokens: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const url = `${this.config.baseURL.replace(/\/+$/, '')}/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${raw.slice(0, 200)}`);
      }

      const parsed = JSON.parse(raw) as ChatResponse;
      if (parsed.error) {
        throw new Error(parsed.error.message ?? '未知AI错误');
      }

      const content = parsed.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('AI 返回内容为空（可能是 maxTokens 不足）');
      }
      return content;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseDecision(content: string, state: GameState): Decision | null {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
    if (typeof parsed !== 'object' || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;
    const rawId = obj.actionId ?? obj.action ?? obj.id;
    const actionId = rawId === undefined || rawId === null ? null : String(rawId);
    if (actionId === null || !state.actions.some((action) => action.id === actionId)) {
      return null;
    }

    const rationale = typeof obj.rationale === 'string' ? obj.rationale : 'AI 决策';
    const confidenceRaw = typeof obj.confidence === 'number' ? obj.confidence : 0.5;
    const confidence = Math.max(0, Math.min(1, confidenceRaw));

    const fieldValues = this.parseFieldValues(obj.fieldValues);

    return { actionId, rationale, confidence, source: 'free-ai', fieldValues };
  }

  /** 解析 AI 返回的表单字段值。 */
  private parseFieldValues(raw: unknown): Record<string, string> | undefined {
    if (typeof raw !== 'object' || raw === null) return undefined;
    const result: Record<string, string> = {};
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      result[name] = String(value);
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const wait = this.config.minRequestIntervalMs - elapsed;
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastRequestAt = Date.now();
  }
}
