# oh-my-ccg

[![version](https://img.shields.io/badge/version-1.0.0-blue)](package.json)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![tests](https://img.shields.io/badge/tests-403_passed-brightgreen)](#开发)

> 统一的 Claude Code 插件 — RPI 工作流 + 多模型编排 + 代理系统

oh-my-ccg 将 **gudaspec RPI 哲学**（约束驱动、零决策执行）、**OMC 代理基础设施**和 **CCG 多模型协作**整合为一个单一插件，让 Claude Code 具备生产级的软件开发能力。

---

## ✨ 特性

- **RPI 工作流** — Research → Plan → Implement，状态跨 `/clear` 持久化
- **15 个专业代理** — 自动按任务类型路由到最合适的模型
- **多模型自动路由** — 后端/逻辑/安全 → Codex，前端/UI/设计 → Gemini
- **3 个 MCP 服务器** — oh-my-ccg-tools / oh-my-ccg-codex / oh-my-ccg-gemini
- **8 个生命周期钩子** — SessionStart / UserPromptSubmit / PreToolUse 等
- **16 个可调用技能** — autopilot / ralph / team / pipeline 等编排模式
- **Team / Ralph / Autopilot** — 并行团队、持久循环、全自动 RPI 周期

---

## 🚀 快速开始

### 前置要求

- [Claude Code](https://claude.ai/code)（claude-code CLI）
- Node.js >= 18
- （可选）Codex CLI：`npm i -g @openai/codex`
- （可选）Gemini CLI：`npm i -g @google/gemini-cli`

### 安装

```bash
# 克隆仓库
git clone https://github.com/1molchuan/oh-my-ccg.git
cd oh-my-ccg

# 安装依赖
npm install

# 编译
npm run build
```

在你的项目中配置 `.mcp.json`，引用 oh-my-ccg 的三个 MCP 服务器：

```json
{
  "mcpServers": {
    "oh-my-ccg-tools":  { "command": "node", "args": ["/path/to/oh-my-ccg/bridge/mcp-server.cjs"] },
    "oh-my-ccg-codex":  { "command": "node", "args": ["/path/to/oh-my-ccg/bridge/codex-server.cjs"] },
    "oh-my-ccg-gemini": { "command": "node", "args": ["/path/to/oh-my-ccg/bridge/gemini-server.cjs"] }
  }
}
```

### 初始化

```
/oh-my-ccg:init
```

---

## 📖 核心工作流（RPI）

| 命令 | 阶段 | 说明 |
|------|------|------|
| `/oh-my-ccg:research "需求描述"` | Research | 需求 → 可验证约束集 |
| `/oh-my-ccg:plan` | Plan | 约束 → 零决策可执行计划 |
| `/oh-my-ccg:impl` | Implement | 按计划机械执行 |
| `/oh-my-ccg:review` | Review | 双模型交叉验证（随时可用）|

> **状态持久化**：每个阶段的输出存储在 `.oh-my-ccg/state/rpi-state.json`，`/clear` 后可自动恢复。

### 典型流程

```bash
/oh-my-ccg:research "添加用户认证功能"
/clear
/oh-my-ccg:plan
/clear
/oh-my-ccg:impl
/oh-my-ccg:review
```

---

## 🤖 代理系统

15 个专业代理，自动多模型路由：

| 代理 | 模型 | 多模型 | 职责 |
|------|------|--------|------|
| explore | Haiku | 仅 Claude | 代码库探索、符号/文件映射 |
| analyst | Opus | +Codex | 需求分析、约束提取 |
| planner | Opus | +Codex +Gemini | 任务分解、执行计划 |
| architect | Opus | +Codex | 系统设计、模块边界 |
| executor | Sonnet | 仅 Claude | 代码实现、重构 |
| debugger | Sonnet | 仅 Claude | 根因分析、回归隔离 |
| verifier | Sonnet | +Codex | 完成度验证、测试充分性 |
| reviewer | Sonnet | +Codex +Gemini | 全面代码审查 |
| test-engineer | Sonnet | +Codex | 测试策略、PBT 属性 |
| designer | Sonnet | +Gemini | UI/UX 设计 |
| build-fixer | Sonnet | 仅 Claude | 构建/类型错误修复 |
| critic | Opus | +Codex | 计划/设计挑战性审查 |
| git-master | Sonnet | 仅 Claude | Git 操作、提交策略 |
| scientist | Sonnet | +Python REPL | 数据分析 |
| writer | Haiku | +Gemini | 文档编写 |

---

## 🔌 MCP 架构

oh-my-ccg 通过 3 个 MCP 服务器提供工具能力：

```
oh-my-ccg-tools   → bridge/mcp-server.cjs   → 纯 Node.js，无外部依赖
oh-my-ccg-codex   → bridge/codex-server.cjs  → 需要 codex CLI
oh-my-ccg-gemini  → bridge/gemini-server.cjs → 需要 gemini CLI
```

### 工具列表

**oh-my-ccg-tools**（状态管理）：
- `rpi_state_read` / `rpi_state_write` — RPI 阶段状态
- `mode_state_read` / `mode_state_write` — 编排模式状态
- `notepad_read` / `notepad_write` — 会话记事本
- `project_memory_read` / `project_memory_write` — 持久项目记忆

**oh-my-ccg-codex**（后端/架构）：`ask_codex`, `wait_for_job`, `check_job_status`, `kill_job`, `list_jobs`

**oh-my-ccg-gemini**（前端/设计）：`ask_gemini`, `wait_for_job`, `check_job_status`, `kill_job`, `list_jobs`

### 降级策略

当外部模型 CLI 未安装时，所有功能仍可仅用 Claude 运行。外部模型是增强，而非必需。

---

## ⚙️ 配置

### HUD 状态栏预设

在 `.oh-my-ccg/config.json` 中配置：

```json
{
  "hud": { "preset": "focused" }
}
```

| 预设 | 行数 | 说明 |
|------|------|------|
| `minimal` | 1 | 仅显示 RPI 阶段和上下文使用率 |
| `focused` | 4 | 默认，显示代理树和任务进度 |
| `full` | 10+ | 包含模型状态和调用计数 |
| `analytics` | 10+ | 包含成本追踪 |

---

## 🧪 开发

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 监听模式
npm run dev

# 运行测试（403 个单元测试）
npm test

# 类型检查
npm run lint

# 清理编译输出
npm run clean
```

### 项目结构

```
oh-my-ccg/
├── src/                    # TypeScript 源码（3310 行）
├── bridge/                 # MCP 服务器（.cjs，无需编译）
│   ├── mcp-server.cjs      # oh-my-ccg-tools
│   ├── codex-server.cjs    # oh-my-ccg-codex
│   └── gemini-server.cjs   # oh-my-ccg-gemini
├── agents/                 # 15 个代理定义（Markdown）
├── skills/                 # 16 个技能定义（Markdown）
├── hooks/                  # 8 个生命周期钩子配置
├── templates/              # 项目模板
└── dist/                   # 编译输出（gitignore）
```

---

## 🙏 致谢

oh-my-ccg 站在三个优秀项目的肩膀上，它们是本项目的核心灵感来源：

### [ccg-workflow](https://www.npmjs.com/package/ccg-workflow)

CCG（Claude + Codex + Gemini）多模型协作工作流的原创实现。提出了"并行双模型交叉验证"的核心理念——Codex 负责后端/逻辑/安全分析，Gemini 负责前端/设计/大上下文分析，两者并行运行互相弥补盲点。oh-my-ccg 的整个多模型路由架构直接源于此项目的设计哲学。

### [openspec](https://www.npmjs.com/package/@fission-ai/openspec)

OpenSpec（OPSX）约束驱动开发规范。提出了"研究产出约束集而非信息堆砌"、"零决策可执行计划"、"实现是纯机械执行"等核心原则。RPI（Research → Plan → Implement）工作流的哲学基础正是来自 OpenSpec 的 gudaspec 设计思想，让 AI 辅助开发从"猜测式"走向"约束驱动式"。

### [oh-my-claudecode](https://github.com/disler/oh-my-claude-code)

OMC（oh-my-claudecode）多代理编排层。构建了完整的专业代理目录（explore/analyst/planner/architect/executor 等 20+ 角色）、MCP 工具路由规则、Team 并行执行框架、Ralph 持久循环模式，以及 Autopilot 全自动执行模式。oh-my-ccg 的代理系统和编排模式直接继承自 OMC 的架构设计。

---

> **oh-my-ccg = oh-my-claudecode 代理基础设施 × ccg-workflow 多模型协作 × openspec 约束驱动哲学**
>
> 三者合一，形成一个内聚的、生产级的 Claude Code 插件。

---

## 📄 License

[MIT](LICENSE) © 2026 1molchuan
