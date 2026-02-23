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
- **Backend/Logic/Security** → Codex (gpt-5.3-codex via codeagent-wrapper)
- **Frontend/UI/Design** → Gemini (gemini-3-pro-preview via codeagent-wrapper)
- **Cross-validation** → Both in parallel (MANDATORY for reviews)

External model outputs are advisory only — never applied directly. The executor agent rewrites all prototypes to production-grade code matching project conventions.
</multi_model_routing>

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
