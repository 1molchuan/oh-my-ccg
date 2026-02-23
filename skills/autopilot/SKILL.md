---
name: autopilot
description: Full autonomous RPI execution from idea to working code
---

# oh-my-ccg Autopilot

Full automatic RPI cycle: research → plan → impl → review.

## Activation
Trigger: "autopilot", "auto" + requirement description

## Workflow

### Phase 1: Initialize
- Create RPI state with requirement
- Verify Codex + Gemini availability
- Start autopilot state tracking

### Phase 2: Auto-Research
- Run explore agent for codebase context
- Launch Codex + Gemini in parallel for constraint exploration
- Synthesize constraints automatically
- Present constraint summary to user for quick confirmation

### Phase 3: Auto-Plan
- Suggest /clear if context > 80%
- Run planner agent with constraints
- Cross-validate with Codex + Gemini
- Generate zero-decision task list

### Phase 4: Auto-Impl
- Suggest /clear if context > 80%
- Route tasks: frontend→Gemini workers, backend→Codex workers
- Use Team mode if multiple independent tasks
- Use Ralph mode for each task (execute→verify→fix)
- Continue until all tasks pass verification

### Phase 5: Auto-Review
- Run dual-model cross-review
- Fix Critical findings automatically
- Present final report to user

## Context Management
- Monitor context usage after each phase
- Prompt user for /clear when approaching 80%
- State persists in .oh-my-ccg/state/ across /clear

## Cancellation
Use /oh-my-ccg:cancel to stop autopilot at any point.
