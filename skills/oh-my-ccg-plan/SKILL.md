---
name: oh-my-ccg-plan
description: RPI Plan phase — constraints to zero-decision executable plan
---

# oh-my-ccg Plan Phase

You are executing the RPI Plan phase. Transform constraints into a zero-decision executable plan.

## Prerequisites
- RPI state must be in RESEARCH phase (or resuming PLAN)
- Constraints must be defined in state

## Workflow

### Step 1: Restore State
Read `.oh-my-ccg/state/rpi-state.json`. Load constraints, decisions, and artifacts.

### Step 2: Multi-Model Analysis (PARALLEL)
Launch both models with the constraint set:

**Codex** (planner role):
- Validate constraint feasibility
- Suggest implementation approach for backend tasks
- Identify technical risks

**Gemini** (designer role):
- Validate frontend constraints
- Suggest component decomposition
- Identify UX risks

### Step 3: Task Decomposition
Using the `planner` agent, decompose into ordered tasks:
- Each task must be mechanical (zero decisions)
- Specify exact files, functions, tests
- Mark dependencies between tasks
- Route each task: frontend / backend / fullstack

### Step 4: PBT Property Extraction
For each requirement/constraint, extract testable properties:
- Define invariants
- Specify property-based tests where applicable

### Step 5: Ambiguity Elimination
Audit the plan for any remaining decisions:
- If ambiguities found → use AskUserQuestion to resolve
- Iterate until zero ambiguities remain

### Step 6: Generate Artifacts
- Create specs/ documents (in openspec change dir if available)
- Create design/ documents
- Create tasks.md with full task list
- Update RPI state with artifacts and PBT properties

### Step 7: Transition
- Transition RPI phase to PLAN
- Report: task count, PBT properties, estimated scope
- Instruct user to `/clear` then `/oh-my-ccg:impl`
