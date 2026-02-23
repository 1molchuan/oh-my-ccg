---
name: setup
description: Initial setup wizard for oh-my-ccg
---

# oh-my-ccg Setup

Guided setup wizard for first-time installation.

## Steps

### Step 1: Plugin Verification
Check if oh-my-ccg is properly installed as a Claude Code plugin.
If not installed, guide user through:
```
/plugin marketplace add oh-my-ccg
```

### Step 2: MCP Server Configuration
Verify .mcp.json is properly configured with all 3 servers:
- oh-my-ccg-tools (state, notepad, project memory)
- oh-my-ccg-codex (Codex integration)
- oh-my-ccg-gemini (Gemini integration)

### Step 3: External Tool Verification
Check and guide installation of:
- codeagent-wrapper: `npm install -g codeagent-wrapper`
- OpenSpec CLI: `npm install -g @fission-ai/openspec`
- Codex CLI: `npm install -g @openai/codex`
- Gemini CLI: `npm install -g @google/gemini-cli`

### Step 4: HUD Preset Selection
Ask user to choose HUD preset:
- minimal (1 line — low bandwidth terminals)
- focused (4 lines — daily development, recommended)
- full (10 lines — deep debugging, team collaboration)
- analytics (4 lines — cost tracking)

Save choice to .oh-my-ccg/config.json

### Step 5: OpenSpec Initialization
If OpenSpec CLI is available:
- Run `npx openspec init --tools claude`
- Verify initialization succeeded

### Step 6: Completion Report
Show setup summary and next steps:
```
oh-my-ccg Setup Complete!

  Plugin:   ✅ Installed
  MCP:      ✅ 3 servers configured
  Codex:    ✅ Available
  Gemini:   ✅ Available
  OpenSpec: ✅ Initialized
  HUD:      focused preset

Next: /oh-my-ccg:research "your requirement"
```
