<!-- oh-my-ccg:START -->
<!-- oh-my-ccg:VERSION:1.0.0 -->
# oh-my-ccg — Unified Claude Code Plugin

RPI Workflow + Multi-Model Orchestration + Agent System.
Combines gudaspec philosophy (constraint-driven, zero-decision execution), OMC agent infrastructure, and CCG multi-model collaboration into a single plugin.

<rpi_workflow>
The core workflow follows the RPI (Research → Plan → Implement) philosophy:

```
/oh-my-ccg:init           → Environment setup (OpenSpec + Codex + Gemini verification)
/oh-my-ccg:research "X"   → Requirements → verifiable constraint sets
    /clear
/oh-my-ccg:plan            → Constraints → zero-decision executable plan
    /clear
/oh-my-ccg:impl            → Mechanical execution of plan
/oh-my-ccg:review          → Dual-model cross-validation (anytime)
```

**State persists across /clear** in `.oh-my-ccg/state/rpi-state.json`. Each phase automatically restores previous phase output.

Key RPI principles:
- Research produces constraint sets, not information dumps
- Plans have zero remaining decisions — every task is mechanical
- Implementation is pure execution — no architectural decisions
- All external model outputs are prototypes — rewrite to production quality
</rpi_workflow>

<agents>
15 specialized agents with automatic multi-model routing:

| Agent | Model | Multi-Model | Role |
|-------|-------|-------------|------|
| explore | haiku | Claude only | Codebase discovery |
| analyst | opus | +Codex | Requirements & constraint extraction |
| planner | opus | +Codex +Gemini | Task decomposition & planning |
| architect | opus | +Codex | System design & boundaries |
| executor | sonnet | Claude only | Code implementation |
| debugger | sonnet | Claude only | Root-cause analysis |
| verifier | sonnet | +Codex | Completion verification |
| reviewer | sonnet | +Codex +Gemini | Comprehensive code review |
| test-engineer | sonnet | +Codex | Test strategy & PBT properties |
| designer | sonnet | +Gemini | UI/UX design |
| build-fixer | sonnet | Claude only | Build error resolution |
| critic | opus | +Codex | Plan/design challenge |
| git-master | sonnet | Claude only | Git operations |
| scientist | sonnet | +Python REPL | Data analysis |
| writer | haiku | +Gemini | Documentation |

Model tiers: O=Opus (deep analysis), S=Sonnet (implementation), H=Haiku (fast lookup).
Multi-model routing is automatic — agents call ask_codex/ask_gemini MCP tools when beneficial.
</agents>

<multi_model_routing>
Tasks are automatically routed based on domain:
- **Backend/Logic/Security** → Codex (gpt-5.3-codex)
- **Frontend/UI/Design** → Gemini (gemini-3-pro-preview)
- **Cross-validation** → Both in parallel (MANDATORY for reviews)

External model outputs are advisory only — never applied directly. The executor agent rewrites all prototypes to production-grade code matching project conventions.
</multi_model_routing>

<mcp_architecture>
## MCP Server Architecture & Dependencies

oh-my-ccg 通过 3 个 MCP 服务器提供工具能力，定义在 `.mcp.json` 中：

```
oh-my-ccg-tools   → bridge/mcp-server.cjs   → 纯 Node.js，无外部依赖
oh-my-ccg-codex   → bridge/codex-server.cjs  → 需要 codex CLI (npm i -g @openai/codex)
oh-my-ccg-gemini  → bridge/gemini-server.cjs → 需要 gemini CLI (npm i -g @google/gemini-cli)
```

### 重要：MCP 服务器加载机制

- Bridge 服务器是 `.cjs` 文件，**不需要编译**，Node.js 直接运行
- MCP 服务器在 **Claude Code 启动时加载**，修改 bridge 文件后需要 **重启 Claude Code** 才能生效
- `.mcp.json` 使用 `${CLAUDE_PLUGIN_ROOT}` 变量，由 Claude Code 插件系统自动解析为插件安装目录

### MCP 工具可用性检测

在调用 MCP 工具之前，你必须检测工具是否可用：

1. **oh-my-ccg-tools** 工具（`rpi_state_read` 等）：只要插件加载成功就可用，无外部依赖
2. **oh-my-ccg-codex** 工具（`ask_codex`）：需要 `codex` CLI 已全局安装
3. **oh-my-ccg-gemini** 工具（`ask_gemini`）：需要 `gemini` CLI 已全局安装

### 降级策略

如果 MCP 工具不可用（插件未加载或 CLI 未安装），按以下策略降级：

| 工具 | 降级方案 |
|------|----------|
| `rpi_state_read/write` | 直接用 Read/Write 操作 `.oh-my-ccg/state/rpi-state.json` 文件 |
| `mode_state_read/write` | 直接用 Read/Write 操作对应的 state JSON 文件 |
| `notepad_read/write` | 直接用 Read/Write 操作 `.oh-my-ccg/notepad.md` 文件 |
| `project_memory_read/write` | 直接用 Read/Write 操作 `.oh-my-ccg/project-memory.json` 文件 |
| `ask_codex` | 跳过 Codex 分析，仅用 Claude Agent 完成对应任务（如架构审查、代码审查等） |
| `ask_gemini` | 跳过 Gemini 分析，仅用 Claude Agent 完成对应任务（如设计审查、文档编写等） |

**核心原则**：oh-my-ccg 的所有功能在没有外部模型时仍可运行（仅用 Claude），外部模型是增强而非必需。
</mcp_architecture>

<tool_routing>
## Tool Routing — How to Call External Models

Each MCP server (oh-my-ccg-codex, oh-my-ccg-gemini) provides 5 个工具：
`ask_*`, `wait_for_job`, `check_job_status`, `kill_job`, `list_jobs`

### Codex (Backend/Logic/Security)
**oh-my-ccg-codex** MCP server — 5 tools:
- `ask_codex`: 发送分析请求。参数：`agent_role`, `prompt`, `context_files`, `background`, `model`, `reasoning_effort`
- `wait_for_job(job_id, timeout_ms)`: 阻塞等待后台任务完成（指数退避轮询）
- `check_job_status(job_id)`: 非阻塞状态检查
- `kill_job(job_id, signal)`: 终止运行中的任务
- `list_jobs(status_filter, limit)`: 列出任务

Roles: architect, planner, critic, analyst, code-reviewer, security-reviewer, test-engineer

### Gemini (Frontend/Design/Large Context)
**oh-my-ccg-gemini** MCP server — 5 tools:
- `ask_gemini`: 发送分析请求。参数：`agent_role`, `prompt`, `files`, `background`, `model`
- `wait_for_job(job_id, timeout_ms)`: 阻塞等待后台任务完成（指数退避轮询）
- `check_job_status(job_id)`: 非阻塞状态检查
- `kill_job(job_id, signal)`: 终止运行中的任务
- `list_jobs(status_filter, limit)`: 列出任务

Roles: designer, writer, vision
Model fallback chain: gemini-3-pro-preview → gemini-3-flash-preview → gemini-2.5-pro → gemini-2.5-flash

### Parallel Cross-Validation Pattern (MANDATORY for reviews)
在**同一条消息**中并行调用两个 MCP 工具：
```
Step 1: 同时发起（单条消息）
  ask_codex(agent_role="code-reviewer", background=true)  → job_id_1
  ask_gemini(agent_role="designer", background=true)       → job_id_2

Step 2: 并行等待结果（单条消息）
  wait_for_job(job_id_1)  → codex_result   (oh-my-ccg-codex server)
  wait_for_job(job_id_2)  → gemini_result  (oh-my-ccg-gemini server)

Step 3: 综合两者结果
```

### State Management
Use the **oh-my-ccg-tools** MCP server:
- `rpi_state_read` / `rpi_state_write` — RPI phase state (persists across /clear)
- `mode_state_read` / `mode_state_write` — Orchestration mode state (ralph, team, autopilot)
- `notepad_read` / `notepad_write` — Session memory
- `project_memory_read` / `project_memory_write` — Persistent project memory

### OpenSpec (Optional CLI)
If OpenSpec CLI is available, use directly via Bash:
- `npx openspec new change "<name>"`
- `npx openspec instructions <id> --change "<name>"`
If OpenSpec is not installed, skip these steps and manage artifacts via file system.

### File Operations
Use Claude's native tools (Read, Write, Edit, Glob, Grep) — no MCP wrapper needed.
</tool_routing>

<orchestration_modes>
**Team** — Parallel execution with N workers for independent tasks:
  `/oh-my-ccg:team N "task"` → spawn workers, route by domain, monitor, verify, cleanup

**Ralph** — Persistent execute → verify → fix loop:
  Trigger: "ralph" / "don't stop". Max 10 iterations. Execute → Verify(tests+build+LSP) → Pass? Complete : Fix → Repeat.

**Autopilot** — Full automatic RPI cycle:
  Trigger: "autopilot" / "auto". Auto research → plan → impl → review. Suggests /clear at 80% context.

Cancel any mode: `/oh-my-ccg:cancel` (use `--force` to delete all state)
</orchestration_modes>

<state_management>
All state lives in `.oh-my-ccg/`:
```
.oh-my-ccg/
  state/
    rpi-state.json       # Core RPI state (persists across /clear)
    ralph-state.json     # Ralph loop state
    team-state.json      # Team mode state
    autopilot-state.json # Autopilot state
    hud-state.json       # HUD metrics (tool/agent/skill counts)
    session-history.json # Session history (last 50)
  config.json            # Project configuration
  notepad.md             # Session memory (priority/working/manual)
  project-memory.json    # Persistent project memory
  plans/                 # Planning documents
```

**Notepad** — Three-section session memory:
- `priority`: Max 500 chars, always loaded at session start
- `working`: Timestamped entries, auto-pruned after 7 days
- `manual`: Permanent entries, never auto-pruned

**Project Memory** — Persistent across sessions:
- Sections: techStack, build, conventions, structure, notes, directives
- Directives survive compaction and have priority levels
</state_management>

<hooks>
8 hooks for lifecycle management:
- **UserPromptSubmit**: Magic keyword detection → skill injection
- **SessionStart**: RPI state restoration, context injection
- **PreToolUse**: Parallel execution suggestions
- **PostToolUse**: Result verification, HUD metric tracking
- **Stop**: Persistent mode enforcement (ralph/autopilot)
- **PreCompact**: State backup before compaction
- **SubagentStart/Stop**: Agent lifecycle tracking
- **SessionEnd**: Cleanup and session history
</hooks>

<hud_config>
HUD statusline presets: `minimal` | `focused` (default) | `full` | `analytics`

Configure in `.oh-my-ccg/config.json`:
```json
{
  "hud": { "preset": "focused" }
}
```

HUD shows: RPI phase (color-coded), context usage, agent tree, task progress, model status, call counts.
Presets: minimal (1 line), focused (4 lines), full (10+ lines with model status), analytics (cost tracking).
</hud_config>

<commands>
| Command | Description |
|---------|-------------|
| `/oh-my-ccg:init` | Initialize environment |
| `/oh-my-ccg:research "desc"` | Research: requirements → constraints |
| `/oh-my-ccg:plan` | Plan: constraints → zero-decision plan |
| `/oh-my-ccg:impl` | Implement: execute plan mechanically |
| `/oh-my-ccg:review` | Review: dual-model cross-validation |
| `/oh-my-ccg:autopilot "desc"` | Full auto RPI cycle |
| `/oh-my-ccg:ralph` | Persistent execute-verify-fix loop |
| `/oh-my-ccg:team N "task"` | Parallel team execution |
| `/oh-my-ccg:plan-mode` | Strategic planning (--consensus, --review) |
| `/oh-my-ccg:note` | Session notepad (priority/working/manual) |
| `/oh-my-ccg:deepinit` | Deep codebase init with AGENTS.md |
| `/oh-my-ccg:doctor` | Diagnose installation issues |
| `/oh-my-ccg:trace` | Agent flow trace timeline |
| `/oh-my-ccg:setup` | First-time setup wizard |
| `/oh-my-ccg:cancel` | Cancel active modes |
| `/oh-my-ccg:help` | Show help |
</commands>
<!-- oh-my-ccg:END -->
