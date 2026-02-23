---
name: team
description: Parallel team execution with N coordinated workers
---

# oh-my-ccg Team Mode

Coordinate N parallel workers for independent tasks.

## Activation
Command: `/oh-my-ccg:team N "task description"` where N is worker count.
Or automatically triggered during impl phase when independent tasks detected.

## Workflow

1. **Analyze tasks**: Identify independent task groups from the plan
2. **Create team**: TeamCreate with task list
3. **Spawn workers**: Launch N executor agents
4. **Route tasks**:
   - Frontend tasks → workers with Gemini enhancement
   - Backend tasks → workers with Codex enhancement
   - General tasks → standard executor workers
5. **Monitor**: Track completion via TaskList
6. **Verify**: Run verifier on all completed work
7. **Fix loop**: If issues found, assign fixes to available workers
8. **Cleanup**: Shutdown workers, delete team

## Task Distribution
- Each worker claims one task at a time
- Workers prefer tasks in ID order (lowest first)
- When a task completes, worker claims next available
- Blocked tasks wait for dependencies to resolve

## Parallel Guidelines
- Maximum 5 concurrent workers (configurable)
- Each worker gets its own executor agent
- Workers share state via task list
- Workers must not modify same files simultaneously

## Cancellation
/oh-my-ccg:cancel sends shutdown to all workers.
