/**
 * HtmlReport - 把一次运行的状态渲染成 HTML，便于通过 GitHub Pages 查看。
 */

import type { Decision, GameState } from '../types';

export interface ReportInput {
  generatedAt: Date;
  steps: number;
  stopReason: string;
  states: ReadonlyArray<GameState>;
  decisions: ReadonlyArray<Decision>;
  aiModel: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 生成一份自包含的 HTML 状态报告。 */
export function renderHtmlReport(input: ReportInput): string {
  const lastState = input.states[input.states.length - 1];
  const resources = lastState?.resources ?? {};

  const resourceRows =
    Object.entries(resources)
      .map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${value}</td></tr>`)
      .join('') || '<tr><td colspan="2" class="muted">当前会话未识别到资源数值</td></tr>';

  const decisionRows =
    input.decisions
      .map(
        (decision, index) => `<tr>
          <td>${index + 1}</td>
          <td><span class="badge ${decision.source}">${decision.source}</span></td>
          <td>${escapeHtml(decision.actionId ?? '-')}</td>
          <td>${escapeHtml(decision.rationale)}</td>
          <td>${decision.confidence.toFixed(2)}</td>
        </tr>`,
      )
      .join('') || '<tr><td colspan="5" class="muted">暂无决策记录</td></tr>';

  const pageRows =
    input.states
      .map(
        (state) => `<tr>
          <td>${state.step}</td>
          <td>${escapeHtml(state.title)}</td>
          <td class="url">${escapeHtml(state.url)}</td>
          <td>${state.actions.length}</td>
        </tr>`,
      )
      .join('') || '<tr><td colspan="4" class="muted">暂无页面记录</td></tr>';

  const freeAiCount = input.decisions.filter((decision) => decision.source === 'free-ai').length;
  const heuristicCount = input.decisions.filter((decision) => decision.source === 'heuristic').length;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>WAPGamePlayFramework · 状态报告</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; background: #0d1117; color: #e6edf3; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 28px 0 12px; color: #7d8590; text-transform: uppercase; letter-spacing: .06em; }
  .meta { color: #7d8590; font-size: 13px; margin-bottom: 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 14px 16px; }
  .card .label { font-size: 12px; color: #7d8590; }
  .card .value { font-size: 22px; font-weight: 600; margin-top: 6px; }
  table { width: 100%; border-collapse: collapse; background: #161b22; border: 1px solid #30363d; border-radius: 10px; overflow: hidden; font-size: 13px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #21262d; vertical-align: top; }
  th { background: #1c2128; color: #7d8590; font-weight: 600; }
  tr:last-child td { border-bottom: none; }
  .url { word-break: break-all; color: #58a6ff; }
  .muted { color: #7d8590; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .badge.free-ai { background: #1f6feb33; color: #58a6ff; }
  .badge.heuristic { background: #9e6a0333; color: #d29922; }
  .badge.fallback { background: #6e768133; color: #8b949e; }
  footer { margin-top: 32px; color: #7d8590; font-size: 12px; }
</style>
</head>
<body>
  <h1>WAPGamePlayFramework · 状态报告</h1>
  <div class="meta">
    生成时间：${escapeHtml(input.generatedAt.toISOString())} ·
    免费AI模型：${escapeHtml(input.aiModel)}
  </div>

  <div class="cards">
    <div class="card"><div class="label">执行步数</div><div class="value">${input.steps}</div></div>
    <div class="card"><div class="label">免费AI决策</div><div class="value">${freeAiCount}</div></div>
    <div class="card"><div class="label">启发式兜底</div><div class="value">${heuristicCount}</div></div>
    <div class="card"><div class="label">停止原因</div><div class="value" style="font-size:14px">${escapeHtml(input.stopReason)}</div></div>
  </div>

  <h2>资源状态</h2>
  <table><thead><tr><th>资源</th><th>数量</th></tr></thead><tbody>${resourceRows}</tbody></table>

  <h2>决策记录</h2>
  <table><thead><tr><th>#</th><th>来源</th><th>操作</th><th>理由</th><th>置信度</th></tr></thead><tbody>${decisionRows}</tbody></table>

  <h2>页面轨迹</h2>
  <table><thead><tr><th>步</th><th>标题</th><th>地址</th><th>可选操作</th></tr></thead><tbody>${pageRows}</tbody></table>

  <footer>由 GitHub Actions 自动生成 · 游戏过程由免费AI（spark-x2.5-1.7b）决策，零付费 token</footer>
</body>
</html>`;
}
