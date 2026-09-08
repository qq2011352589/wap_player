# WAPGamePlayFramework

> WAP 游戏 AI 玩化工框架 —— 用**免费 AI（spark-x2.5-1.7b）**驱动 WAP 文字游戏自动决策，游戏过程零付费 token 消耗。

---

## 一、项目简介

WAPGamePlayFramework 是一个面向 WAP 文字游戏的自动化玩化工框架，核心思路是：**搭建完成后，无限进行的游戏过程全部由 AI 决策，避免消耗付费 token**。

- **游戏**：风云三國（n6game 平台，即时战斗三国题材）
- **AI 模型**：`spark-x2.5-1.7b`（免费，讯飞 provider，opencode 配置中已确认可用）
- **接入方式**：基于 OpenAI 兼容接口调用免费 AI，模型在「当前页面状态 + 可选操作」中自动选择下一步
- **部署范围**：纯 TypeScript 实现，无第三方运行时依赖，可独立运行

---

## 二、核心特性

| 能力 | 说明 |
|------|------|
| **免费AI决策** | 通过 OpenAI 兼容接口调用 `spark-x2.5-1.7b`，由模型自主决策 |
| **WAP 页面解析** | 正则解析服务端渲染的 HTML，提取链接、表单、正文、资源数值 |
| **Cookie 会话** | 内置 Cookie jar 与重定向跟随，适配 Django 登录态 |
| **安全护栏** | 拦截付费/退出操作；最大步数限制；同一页面重复访问上限，防死循环 |
| **启发式兜底** | AI 不可用或返回非法时，退化为关键词打分决策，框架始终可运行 |
| **零运行时依赖** | 仅使用 Node 内置 `fetch`，无需任何第三方库 |

---

## 三、架构设计

```
src/
├── index.ts                 统一导出入口
├── config.ts                配置管理（免费AI / 游戏 / 循环）
├── types.ts                 共享类型定义
├── logger.ts                日志器
├── ai/
│   ├── FreeAIModel.ts       调用 spark-x2.5-1.7b（含 JSON解析、限流、超时、重试）
│   └── AIController.ts       决策控制器 + 启发式兜底
├── client/
│   ├── HttpClient.ts        带 Cookie 的 HTTP 客户端（重定向跟随）
│   ├── WapParser.ts         HTML -> 页面模型（链接/表单/正文/资源）
│   └── GameClient.ts        登录 / 拉页 / 执行操作
├── game/
│   ├── actionBuilder.ts      页面 -> 可执行操作
│   ├── GameStateManager.ts   状态快照与历史
│   └── GameLoop.ts           主循环 + 安全护栏
└── resource/
    └── ResourceManager.ts    资源识别与追踪（元宝标记为付费）
```

---

## 四、免费AI 机制

### 模型
- **名称**：`spark-x2.5-1.7b`
- **来源**：讯飞 provider，OpenAI 兼容接口
- **地址**：`https://maas-api.cn-huabei-1.xf-yun.com/v2`
- **密钥来源**：优先环境变量 `MAAS_XUNFEI_API_KEY`，其次读取 `~/.local/share/opencode/auth.json` 的 `maas_xunfei.key`

### 决策流程
1. 构造提示词：当前页面标题/地址、已识别资源、页面正文摘要、可选操作列表
2. 调用模型生成决策 JSON：`{"actionId":"<操作编号>","rationale":"<理由>","confidence":<0~1>}`
3. 解析并校验操作编号有效性
4. 记录决策轨迹，支持后续反馈优化

### 安全保障
- 强制使用免费模型，**不调用任何付费模型/付费 token**
- 推理模型 `maxTokens` 提升至 2048，并设置重试策略，应对空返回
- 空返回时自动加大额度重试，仍失败走启发式兜底

---

## 五、安全护栏

| 约束 | 说明 |
|------|------|
| 付费货币拦截 | 硬拦截 `退出登陆 / 充值 / 商城 / 购买 / 元宝 / VIP` 等操作 |
| 步数限制 | 最大步数 `maxSteps`，防止无限循环 |
| 页面重复上限 | 同一 URL 重复访问上限 `maxRepeatedUrls`，打破死循环 |
| 超时控制 | 单次 AI 请求超时 `timeoutMs`，避免挂死 |
| 限流控制 | `minRequestIntervalMs` 控制两次 AI 请求间隔，避免限流 |

---

## 六、快速开始

```bash
# 1. 安装依赖
cd wap-framework
npm install

# 2. 类型检查
npm run check

# 3. 构建
npm run build

# 4. 运行完整游戏循环（默认 20 步）
npm run play

# 5. 查看当前游戏状态（登录态/页面/资源/可选操作）
npm run status
```

### 命令行参数

```bash
# 自定义循环参数
LOOP_MAX_STEPS=8 LOOP_STEP_DELAY_MS=600 npm run play

# 自定义AI参数
MAAS_XUNFEI_API_KEY=xxx MAAS_XUNFEI_MODEL=spark-x2.5-1.7b npm run play
```

### 冒烟测试

```bash
node dist/examples/smoke.js
```

该测试覆盖：登录 → 页面解析 → 操作构建 → 资源识别 → 免费AI决策 → 操作执行全链路。

### 查看运行状态

有三种方式观察状态：

| 方式 | 说明 |
|------|------|
| 实时日志 | 每步输出决策来源（`free-ai`/`heuristic`）、决策理由、执行的操作 |
| `npm run status` | 查看当前登录态、页面标题/地址、识别资源、可选操作列表 |
| `LoopResult` | 运行结束后返回：步数、访问过的页面、最后资源、停止原因 |

```bash
# 查看登录后的入口页状态
npm run status

# 登录后跳转到指定页面查看状态
node dist/examples/status.js "http://fysg.n6game.cn/game/..."
```

保存运行日志便于持续追踪：

```bash
npm run play > run.log 2>&1 &
tail -f run.log
```

---

## 七、配置说明

### 全局配置

```ts
const config = loadConfig({
  ai: {
    baseURL: 'https://maas-api.cn-huabei-1.xf-yun.com/v2',
    model: 'spark-x2.5-1.7b',
    maxTokens: 2048,        // 推理模型需足够额度输出内容
    minRequestIntervalMs: 1500,
  },
  game: {
    entryUrl: 'http://fysg.n6game.cn/tdcq_player/index/',
    username: 'a1345772',
    password: 'a1345772',
  },
  loop: {
    maxSteps: 50,
    stepDelayMs: 800,
    maxRepeatedUrls: 3,
  },
  logLevel: 'info',
});
```

### 环境变量优先级

| 优先级 | 来源 |
|--------|------|
| 1 | 显式 `overrides` |
| 2 | 环境变量（如 `MAAS_XUNFEI_API_KEY`、`MAAS_XUNFEI_BASE_URL`、`MAAS_XUNFEI_MODEL`、`WAP_ENTRY_URL` 等） |
| 3 | 代码内置默认值 |

### AI 密钥获取

1. 配置环境变量：`MAAS_XUNFEI_API_KEY=<ak>`
2. 或在 `~/.local/share/opencode/auth.json` 中写入 `"maas_xunfei": { "key": "<ak>" }`

---

## 八、目录结构

```
wap-framework/
├── src/
│   ├── index.ts                统一导出
│   ├── config.ts / types.ts / logger.ts
│   ├── ai/                     免费AI决策模块
│   ├── client/                 客户端层（HTTP/解析/客户端）
│   ├── game/                   游戏层（循环/状态/操作）
│   └── resource/               资源管理
├── examples/
│   ├── play.ts                 完整游戏循环示例
│   └── smoke.ts                端到端冒烟测试
├── package.json / tsconfig.json
├── README.md
└── .env.example
```

---

## 九、安全与合规

- **仅读页面 + 执行操作**：框架不修改游戏服务端逻辑，仅读取与交互
- **付费规避**：元宝等付费货币相关操作被硬拦截，杜绝误消耗
- **责任说明**：框架用于个人学习与研究，请遵守游戏服务条款

---

## 十、扩展方向

1. **多游戏适配**：只需替换 `config.ts` 中的游戏入口与参数，即可接入不同 WAP 游戏
2. **AI 策略记忆**：为决策模型补充长期状态与目标记忆
3. **资源可视化**：在状态快照中增强资源变化的可视化统计
4. **多角色/多阵容**：支持多武将、多阵容组合决策优化
5. **自动化流程**：串联任务执行、资源采集、战斗等完整自动化流程

---

## 附录：验证结果

| 验证项 | 结果 |
|--------|------|
| TypeScript 编译（`tsc --noEmit`） | ✅ 通过（exit 0） |
| 端到端冒烟测试 | ✅ 通过（登录→解析→AI决策→执行） |
| 完整循环（4 步） | ✅ 全部 `[free-ai]` 决策 |
| 免费AI可用性 | ✅ `spark-x2.5-1.7b` 返回有效 JSON 决策 |

> 该框架在 `spark-x2.5-1.7b` 免费模型驱动下，游戏过程不产生任何付费 token 消耗。
