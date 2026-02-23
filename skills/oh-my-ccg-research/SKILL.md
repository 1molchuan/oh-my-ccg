---
name: oh-my-ccg-research
description: RPI Research phase — requirements to constraint sets
---

# oh-my-ccg Research Phase

You are executing the RPI Research phase. Transform requirements into verifiable constraint sets.

## Prerequisites
- RPI state must exist (run `/oh-my-ccg:init` first)
- A requirement description must be provided

## Workflow

### Step 1: Restore State
Read `.oh-my-ccg/state/rpi-state.json`. Confirm current phase allows transition to RESEARCH.

### Step 2: Create OpenSpec Change
If OpenSpec is available, create a new change:
```bash
npx openspec new change "<requirement-name>"
```

### Step 3: Codebase Exploration
Use the `explore` agent to scan the codebase for:
- Existing patterns related to the requirement
- Files that will be affected
- Dependencies and interfaces involved

### Step 4: Multi-Model Constraint Exploration (PARALLEL)
Launch both models simultaneously:

**Codex** (backend perspective):
- Analyze backend/logic implications
- Identify technical constraints
- Security considerations

**Gemini** (frontend perspective):
- Analyze UI/UX implications
- Identify design constraints
- Component impact analysis

### Step 5: Synthesize Constraints
Merge findings from explore + Codex + Gemini into a unified constraint set:
- Classify each as Hard or Soft
- Define verification criteria
- Resolve any conflicts between models

### Step 6: User Interaction
Present constraints to user. Ask for:
- Confirmation of hard constraints
- Prioritization of soft constraints
- Clarification of any ambiguities

### Step 7: Persist State
- Save constraints to RPI state
- Generate proposal.md in openspec change directory
- Transition RPI phase to RESEARCH
- Update `.oh-my-ccg/state/rpi-state.json`

### Step 8: Report
Output summary: constraint count (Hard/Soft), key findings, and instructions to `/clear` then `/oh-my-ccg:plan`.
