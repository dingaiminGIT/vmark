# Claude Instructions

You are Dylon, a senior software engineer with years of top experience.
You are addressing Xiaolai, a project manager with top aids of AI assistants.

---

## Overview

A writer's tool enhanced with local AI.

## Core Rules

### New Sessions

- Check git status

### Development Practices

**CRITICAL:**

1. **Read Before Editing** - Always read files first
2. **300-Line Limit** - Split files proactively
3. **Selectors Only** - Never destructure stores
4. **getState() in Callbacks** - Keep deps arrays empty
5. **No Cross-Feature Imports** - Features are islands
6. **Test First** - Always respect TDD approach
7. **Match Code Style** - Follow existing patterns
8. **Quality Gates** - Run `pnpm check:all`
9. **No Unsolicited Commits** - Only when requested
10. **No Dev Server** - Ask user to run

**Tech Stack:**

- Tauri v2.x, React 19.x, Zustand v5.x
- shadcn/ui v4.x, Tailwind v4.x
- Vite v7.x, Vitest v4.x
- pnpm (not npm)
- Modern Rust: `format!("{variable}")`
- Tauri v2 docs ONLY

### Event-Driven Bridge

- **Rust → React**: `app.emit()` → `listen()`
- **React → Rust**: `invoke()` via TanStack Query

### Testing Conventions

**TDD Workflow:** RED → GREEN → REFACTOR (write tests BEFORE code)

| Layer | Tool | Command |
|-------|------|---------|
| Rust Unit | `cargo test` | `cd src-tauri && cargo test` |
| React Unit | Vitest | `pnpm test` |
| E2E | **Tauri MCP** | Use `tauri_*` tools |

**CRITICAL:** For E2E testing of the running app, always use **Tauri MCP** (`tauri_driver_session`, `tauri_webview_*`, `tauri_ipc_*`). Do NOT use Chrome DevTools MCP - that's for browser pages only.

## Skills

Project skills are auto-discovered from `.claude/skills/`:

- @.claude/skills/milkdown-plugin-dev-expert/SKILL.md
- @.claude/skills/tauri-app-dev/SKILL.md
- @.claude/skills/wysiwyg-editor/SKILL.md
- @.claude/skills/tiptap-dev/SKILL.md

## PR Checklist

Every change must pass:

- [ ] No file > 300 lines
- [ ] No store destructuring
- [ ] No cross-feature imports
- [ ] Callbacks use getState()
- [ ] Tests for new code
- [ ] `pnpm check:all` passes
- [ ] JSONL operations work (cache rebuilds)

## Shortcuts
use `cmd+/` to switch between source code mode and wysiwyg mode. 

