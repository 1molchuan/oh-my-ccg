---
name: oh-my-ccg-init
description: Initialize oh-my-ccg environment — verify OpenSpec, Codex, and Gemini
---

# oh-my-ccg Environment Initialization

You are executing the oh-my-ccg initialization skill. Follow these steps exactly:

## Step 1: Verify External Tools

Check availability of required tools:

1. **OpenSpec CLI**: Run `npx openspec --version`. If not available, warn but continue (optional dependency).
2. **codeagent-wrapper**: Run `codeagent-wrapper --version`. If not available, warn that multi-model routing will be limited.
3. **Codex backend**: Run `codeagent-wrapper --backend codex --version` or test with a simple prompt.
4. **Gemini backend**: Run `codeagent-wrapper --backend gemini --version` or test with a simple prompt.

## Step 2: Initialize State Directory

Create the state directory structure:
```
.oh-my-ccg/
  state/
  plans/
  config.json (with defaults if not exists)
```

## Step 3: Initialize OpenSpec (if available)

If OpenSpec CLI is available and project is not already initialized:
- Run `npx openspec init --tools claude`
- Report result

## Step 4: Create Initial RPI State

Create `.oh-my-ccg/state/rpi-state.json` with phase: "init".

## Step 5: Report Status

Output a summary:
```
oh-my-ccg Environment Status:
  OpenSpec:  ✅/❌ (version or "not found")
  Codex:     ✅/❌ (available or "not found")
  Gemini:    ✅/❌ (available or "not found")
  State Dir: ✅ Created
  RPI State: ✅ Initialized (phase: init)
```

If any critical tool is missing, provide installation instructions.
