---
name: oh-my-ccg-impl
description: RPI Impl phase — mechanical execution of zero-decision plan
---

# oh-my-ccg Implementation Phase

You are executing the RPI Impl phase. Execute the plan mechanically.

## Prerequisites
- RPI state must be in PLAN phase (or resuming IMPL)
- Tasks must be defined in state/artifacts

## Workflow

### Step 1: Restore State
Read `.oh-my-ccg/state/rpi-state.json`. Load task list and progress.

### Step 2: Assess Parallelism
Check task dependencies:
- If multiple independent tasks exist → use Team mode for parallel execution
- If tasks are sequential → execute one by one with executor agent

### Step 3: Execute Tasks
For each task (or batch of parallel tasks):

1. **Route to appropriate model**:
   - Frontend tasks → Get Gemini prototype first, then executor rewrites to production
   - Backend tasks → Get Codex prototype first, then executor rewrites to production
   - General tasks → executor implements directly

2. **Executor implements**:
   - Read task spec completely
   - Explore existing code patterns
   - Implement with production quality
   - Run type checks and tests

3. **Side-effect review** (MANDATORY before committing):
   - Verify changes stay within task scope
   - Check no unintended dependencies affected
   - Confirm interfaces match expectations

### Step 4: Cross-Review
After all tasks complete, run reviewer agent:
- Codex reviews logic/security
- Gemini reviews patterns/maintainability
- Fix any Critical findings immediately

### Step 5: Verify
Run verifier agent:
- All tests pass
- Build succeeds
- No type errors
- Constraints satisfied

### Step 6: Update State
- Mark tasks complete in state
- Transition to IMPL phase
- If all tasks done → prompt for `/oh-my-ccg:review`

### Ralph Integration
If ralph mode is active:
- Execute → Verify → Pass? → Complete
- Execute → Verify → Fail? → Fix → Repeat (up to max iterations)
