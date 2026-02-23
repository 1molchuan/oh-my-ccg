---
name: doctor
description: Diagnose and fix oh-my-ccg installation issues
---

# oh-my-ccg Doctor

Diagnose the oh-my-ccg installation and identify issues.

## Checks

1. **Plugin installed**: Verify .claude-plugin exists and is valid JSON
2. **Hooks registered**: Verify hooks/hooks.json exists and all script files present
3. **MCP servers**: Verify bridge/*.cjs files exist
4. **State directory**: Verify .oh-my-ccg/ directory structure
5. **Codex available**: Test `codeagent-wrapper --backend codex --version`
6. **Gemini available**: Test `codeagent-wrapper --backend gemini --version`
7. **OpenSpec available**: Test `npx openspec --version`
8. **Node.js version**: Verify >= 18.x
9. **TypeScript build**: Run `npx tsc --noEmit`

## Output
```
oh-my-ccg Doctor Report:
  ✅ Plugin manifest (.claude-plugin)
  ✅ Hooks (4/4 scripts found)
  ✅ MCP servers (3/3 bridges found)
  ✅ State directory (.oh-my-ccg/)
  ✅ Codex (codeagent-wrapper v5.7.2)
  ❌ Gemini (not found — install: npm i -g @google/gemini-cli)
  ✅ OpenSpec (v1.1.1)
  ✅ Node.js (v22.0.0)
  ✅ TypeScript (zero errors)

Issues found: 1
  [W1] Gemini CLI not installed. Multi-model routing will fall back to Codex only.
       Fix: npm install -g @google/gemini-cli
```

## Auto-fix
If `--fix` flag is present, attempt to resolve issues automatically:
- Create missing directories
- Install missing dependencies
- Regenerate config files
