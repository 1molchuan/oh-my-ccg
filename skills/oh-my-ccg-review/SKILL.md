---
name: oh-my-ccg-review
description: Independent dual-model cross-review (available anytime)
---

# oh-my-ccg Review Phase

You are executing an independent dual-model cross-review. This can be run at any time.

## Workflow

### Step 1: Collect Artifacts
Determine what to review:
- If RPI state exists with a change: review that change's implementation
- If git diff has changes: review the diff
- Otherwise: ask user what to review

### Step 2: Dual-Model Review (PARALLEL — MANDATORY)
Launch BOTH models in a single message:

**Codex** (code-reviewer role):
- Logic correctness
- Security vulnerabilities (OWASP Top 10)
- Error handling completeness
- API contract correctness
- Performance hotspots

**Gemini** (designer role):
- Code pattern consistency
- Maintainability assessment
- Component architecture (frontend)
- Cross-module integration issues

### Step 3: Synthesize Findings
Merge findings from both models:
- Deduplicate overlapping issues
- Classify severity: Critical / Warning / Info
- Cross-reference: issues found by BOTH models get elevated severity

### Step 4: Present Report
```
## Review Report

### Critical (must fix)
- [C1] file:line — description (found by: Codex/Gemini/Both)

### Warning (should fix)
- [W1] file:line — description

### Info (nice to have)
- [I1] file:line — description

### Summary
- Total findings: X (C: N, W: N, I: N)
- Cross-validated: N issues found by both models
```

### Step 5: Decision Gate
Ask user:
- **Fix**: Address Critical/Warning issues → loop back to executor
- **Accept**: Archive the review, proceed
- **Defer**: Note issues for later, proceed
