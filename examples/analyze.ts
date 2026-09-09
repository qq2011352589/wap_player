/**
 * analyze - 诊断 WAP 页面的交互构成（链接 / 表单 / 图片 / JS），
 * 用于接入新游戏时判断是否需要 JS 支持。
 *
 * 用法：
 *   node dist/examples/analyze.js                 # 分析游戏入口页
 *   node dist/examples/analyze.js <url>           # 登录后分析指定页面
 */

import { HttpClient, WapParser, loadConfig } from '../src/index';

interface PageStats {
  scripts: number;
  onclick: number;
  javascriptHref: number;
  ajax: boolean;
  forms: number;
  submit: number;
  links: number;
  images: number;
  textInputs: number;
  selects: number;
  length: number;
}

function count(html: string, pattern: RegExp): number {
  return (html.match(pattern) || []).length;
}

function analyzeHtml(html: string): PageStats {
  return {
    scripts: count(html, /<script/gi),
    onclick: count(html, /onclick\s*=/gi),
    javascriptHref: count(html, /href\s*=\s*["']javascript:/gi),
    ajax: /XMLHttpRequest|fetch\s*\(|\$\.(?:ajax|post|get)\s*\(/i.test(html),
    forms: count(html, /<form/gi),
    submit: count(html, /type\s*=\s*["']submit/gi),
    links: count(html, /<a\b/gi),
    images: count(html, /<img/gi),
    textInputs: count(html, /type\s*=\s*["'](?:text|search|number|tel|email)["']/gi),
    selects: count(html, /<select/gi),
    length: html.length,
  };
}

function buildEntryUrl(entryUrl: string, username: string, password: string): string {
  try {
    const url = new URL(entryUrl);
    if (!url.searchParams.has('username')) url.searchParams.set('username', username);
    if (!url.searchParams.has('password')) url.searchParams.set('password', password);
    return url.toString();
  } catch {
    return entryUrl;
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const http = new HttpClient(config.game.userAgent);
  const parser = new WapParser();

  const entryUrl = buildEntryUrl(config.game.entryUrl, config.game.username, config.game.password);
  const entry = await http.get(entryUrl);
  const cookies = Object.keys(http.allCookies());
  console.log(`登录状态：${cookies.length > 0 ? `已登录（${cookies.join(', ')}）` : '未登录'}`);

  const targetUrl = process.argv[2];
  const response = targetUrl ? await http.get(targetUrl) : entry;
  const page = parser.parse(response.url, response.body);
  const stats = analyzeHtml(response.body);

  console.log('\n===== 页面交互分析 =====');
  console.log(`标题      : ${page.title}`);
  console.log(`地址      : ${response.url}`);
  console.log(`页面长度  : ${stats.length} 字符`);
  console.log('');
  console.log('--- 可直接用 HTTP 驱动的元素 ---');
  console.log(`链接 <a>          : ${stats.links}`);
  console.log(`表单 <form>       : ${stats.forms}（提交按钮 ${stats.submit}）`);
  console.log(`文本输入 <input>  : ${stats.textInputs}`);
  console.log(`下拉框 <select>   : ${stats.selects}`);
  console.log(`图片 <img>        : ${stats.images}`);
  console.log('');
  console.log('--- JS 相关（可能需要额外处理）---');
  console.log(`<script> 标签     : ${stats.scripts}`);
  console.log(`onclick 处理      : ${stats.onclick}`);
  console.log(`javascript: 链接  : ${stats.javascriptHref}`);
  console.log(`AJAX 迹象         : ${stats.ajax ? '有' : '无'}`);

  const needsJs = stats.javascriptHref > 0 || stats.ajax;
  console.log('');
  console.log('===== 结论 =====');
  if (!needsJs) {
    console.log('✅ 该页面可由纯 HTTP 框架驱动（本框架可直接处理）');
  } else {
    console.log('⚠️  检测到 JS 依赖，可能需要反向解析 JS 请求或使用无头浏览器');
  }
}

main().catch((error: unknown) => {
  console.error('分析失败：', (error as Error).message);
  process.exitCode = 1;
});
