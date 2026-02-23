# oh-my-ccg

[![version](https://img.shields.io/badge/version-1.0.0-blue)](package.json)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![tests](https://img.shields.io/badge/tests-403_passed-brightgreen)](#开发)

> 个人集成配置插件 — RPI 工作流状态机 + OMC 代理继承 + CCG 双模型路由

oh-my-ccg 是一个**个人集成配置插件**——把 [ccg-workflow](https://www.npmjs.com/package/ccg-workflow) 的双模型调用模式、[oh-my-claudecode](https://github.com/disler/oh-my-claude-code) 的代理系统、[openspec](https://www.npmjs.com/package/@fission-ai/openspec) 的约束驱动哲学，整合进一个统一的 Claude Code 插件配置中。

它不是三者的替代品，而是站在它们肩膀上的聚合层。如果你已经在用 OMC 或 CCG，oh-my-ccg 主要带来的是 **RPI 阶段状态机**（跨 `/clear` 持久化）和把三套工作流统一进一个插件的便利性。

---

## ✨ 特性

- **RPI 工作流** — Research → Plan → Implement，状态跨 `/clear` 持久化
- **15 个专业代理** — 继承自 OMC 代理系统（20+ 角色的子集）
- **多模型路由建议** — 按任务域建议路由（后端→Codex，前端→Gemini）——最终路由由 Claude 判断执行
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

## 🔀 与 OMC / CCG 的核心差异

oh-my-ccg 是三者的聚合层，主要增量是**有状态的 RPI 多阶段工程流程**。以下是准确的能力对比：

### 1. 有状态的 RPI 阶段机器

**OMC** 拥有完整的代理系统（notepad 会话记忆、project-memory 跨会话记忆、原生 MCP ask_codex/ask_gemini），可以完成几乎所有任务——但它没有强制 Research→Plan→Implement 的顺序约束，也没有跨 `/clear` 的工程级阶段进度记录。

**CCG** 以 bash 包装器形式提供双模型调用，同样没有多阶段工作流状态。

oh-my-ccg 引入了**形式化的阶段状态机**：

```
init → research → plan → impl → review
```

每个阶段强制完成后才能进入下一阶段，状态持久化在 `.oh-my-ccg/state/rpi-state.json`。执行 `/clear` 清空上下文后，下一个命令会自动从断点恢复，**不会丢失任何工程进度**。

---

### 2. 约束驱动而非任务驱动

**OMC** 和 **CCG** 都是"给我做 X"式的任务驱动模型——你描述目标，模型直接实现。OMC 的各代理可以手动组织约束提取流程，但没有在工作流层面强制要求。

oh-my-ccg 在任务开始前强制经过一个**约束提取阶段**：

```
需求描述
    ↓ (research phase)
约束集（Hard / Soft）
    ├── C001 [Hard] 认证 token 必须在 30 分钟后过期
    │           验证标准：单元测试 auth/token.test.ts
    ├── C002 [Hard] 密码必须通过 bcrypt 哈希存储
    │           验证标准：代码审查无明文存储
    └── C003 [Soft] 支持第三方 OAuth 登录（优先级低）
```

每个约束都有分类（Hard/Soft）和可验证标准。这些约束在整个 plan 和 impl 阶段作为验收条件，防止实现偏离需求。

---

### 3. 零决策计划原则

**OMC** 的 planner 代理可以产出执行方向和任务列表，手动使用时也可做到详细规划；但没有在工作流层面强制要求"歧义消除后才能进入实现"。
**CCG** 没有专门的 plan 阶段，直接进入双模型原型生成。

oh-my-ccg 的 plan 阶段有一个**强制歧义消除审计**：

```
任务拆解完成
    ↓
歧义检查（AmbiguityAudit）：
  "认证中间件应放在哪个层？" → 必须在此阶段解答，不能留到实现时
  "token 刷新策略是什么？" → 必须在此阶段确定
    ↓
零歧义 → 生成 tasks.md（每个任务指定精确文件、函数、测试）
    ↓
进入 impl（纯机械执行，无设计决策）
```

> 计划阶段还会同步提取 **PBT（属性测试）不变量**，每个约束对应可自动化验证的属性。

---

### 4. 原型-重写分离模式

**CCG** 的外部模型输出（Codex/Gemini 生成的代码）需要人工判断是否采用。
**OMC** 的 executor 直接实现，不借助外部模型原型。

oh-my-ccg 建立了明确的**两阶段代码生成流程**：

```
外部模型（Codex/Gemini）生成原型
    ↓  （原型仅作参考，禁止直接应用）
executor 代理重写 → 生产级代码
    ↓
side-effect review（强制副作用检查）：
  - 变更是否超出任务范围？
  - 是否影响未预期的依赖？
  - 接口是否与预期一致？
```

外部模型的输出是**有价值的设计参考**，但最终代码必须由 Claude executor 按照项目约定重写，确保风格一致性和质量可控。

---

### 5. 交叉验证严重性升级

**CCG** 的双模型审查结果是两份独立报告，合并方式由用户自行判断。

oh-my-ccg 的 review 阶段有一条**自动升级规则**：

```
Codex 发现: [Warning] 缺少输入验证 at auth/login.ts:42
Gemini 发现: [Warning] 缺少输入验证 at auth/login.ts:42
                          ↓
合并后自动升级: [Critical] 缺少输入验证（双模型交叉确认）
```

被**两个模型同时报告的问题**自动升级为 Critical 级别，反映了该问题具有更高的客观置信度。

---

### 对比总结

| 能力 | OMC | CCG | oh-my-ccg |
|------|-----|-----|-----------|
| 多代理编排 | ✅ 完整（20+ 角色） | ❌ | ✅ 继承 OMC（15 角色子集） |
| 双模型并行调用 | ✅ 原生 MCP | ✅ bash 包装 | ✅ 原生 MCP（同 OMC） |
| RPI 阶段状态机 | ❌ | ❌ | ✅ 新增 |
| 约束集提取（Markdown 工作流约定） | ❌（可手动） | ❌ | ✅ 新增 |
| 零决策计划强制（Markdown 工作流约定） | ❌（可手动） | ❌ | ✅ 新增 |
| 原型-重写分离 | ❌ | ⚠️ 建议 | ✅ 强制（Markdown 约定） |
| PBT 属性追踪 | ❌ | ❌ | ✅ 新增（Markdown 约定） |
| 交叉验证严重性升级 | ❌ | ❌ | ✅ 新增（Markdown 约定） |
| `/clear` 后阶段恢复 | ❌ | ❌ | ✅ 新增 |
| 无外部模型降级运行 | ✅ | ❌ | ✅ 继承 |

> **注**：标注"Markdown 工作流约定"的能力是通过 CLAUDE.md 提示词约定实现的，依赖 Claude 遵循指示，不是代码层面的强制约束。

---

## ⚠️ 局限性与不足

坦白说，这个项目还远不完美：

- **未经真实项目验证**：RPI 工作流在复杂真实项目中的有效性尚未充分测试，目前更多是理论上合理的工作流设计。
- **代理定义是 Markdown，不是可执行代码**：`agents/` 和 `skills/` 目录下都是 Markdown 工作流描述文件，实际执行仍依赖 Claude Code 读取并遵循，不能保证 Claude 每次都完全照做。
- **与 OMC 高度重叠**：如果你已经安装了 oh-my-claudecode，oh-my-ccg 的大部分代理功能你已经有了，核心增量只有 RPI 状态机和三套配置的整合。
- **MCP bridge 是对 CLI 的简单包装**：oh-my-ccg-codex 和 oh-my-ccg-gemini 本质上和 OMC 的 MCP 工具做同样的事，没有实质性技术创新。
- **单元测试覆盖类型逻辑，无集成测试**：403 个测试验证 TypeScript 类型和状态机逻辑，没有覆盖与真实 Claude Code 环境的集成行为。
- **HUD 功能依赖 Claude 遵循提示词**：HUD 状态栏的渲染是通过提示词约定实现的，不是 Claude Code 的原生 UI 扩展。

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

> **oh-my-ccg = OMC 代理系统 + CCG 双模型调用 + OpenSpec RPI 工作流，整合在一个插件配置里。**
>
> 如果你觉得三套系统分别安装和配置很繁琐，这个项目把它们合在一起。
> 如果你只需要其中一套，直接用原版就好。

---

## 📄 License

[MIT](LICENSE) © 2026 1molchuan
