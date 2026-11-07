# Active Execution Plans

This directory contains execution plans currently in progress.

---

## When to Create an Execution Plan

Create a plan before executing:

- Features requiring changes across multiple components, services, or routes.
- State architecture refactoring or data persistence additions.
- Changes to service worker caching (`ngsw-config.json`) or deployment scripts.
- Any non-trivial task where step-by-step verification is necessary to avoid regressions.

_Single-line fixes, typos, or minor localized adjustments do not require an execution plan._

---

## Plan Lifecycle

1. **Create**: Add a new file in this directory named `YYYY-MM-DD-<short-slug>.md` (e.g. `2026-09-26-add-sound-engine.md`).
2. **Author**: Fill out the sections defined in the [Plan Template](#plan-template) below.
3. **Execute**: Work through the checklist step-by-step, testing each increment.
4. **Verify**: Run automated quality gates (`npm test`, `npm run lint`, `npm run format:check`, `npm run e2e`) and verify rendering across viewports in a real browser.
5. **Archive**: Once complete and verified, move the markdown file to `docs/exec-plans/completed/`.

---

## Plan Template

```markdown
# Execution Plan: [Feature or Task Title]

- **Date**: YYYY-MM-DD
- **Status**: In Progress <!-- In Progress | Completed | Superseded -->
- **Owner**: [Agent / Developer]

## 1. Goal & Objectives

[Clear summary of what will be achieved and why.]

## 2. Context & Background

[Relevant existing code, architectural boundaries, or user requirements.]

## 3. Proposed Changes

- [File or component to add/change and what it will do]
- [Architectural implications or state management updates]

## 4. Implementation Steps

- [ ] **Step 1: [Task Title]**: [Details]
- [ ] **Step 2: [Task Title]**: [Details]
- [ ] **Step 3: [Task Title]**: [Details]

## 5. Verification Plan

- [ ] Unit tests pass: `npm test`
- [ ] Lint analysis passes: `npm run lint`
- [ ] Formatting passes: `npm run format:check`
- [ ] Multi-viewport E2E smoke tests pass: `npm run e2e`
- [ ] Real browser verification (mobile portrait, mobile landscape, tablet, desktop)

## 6. Risks, Ceilings & Rollback

- **Ceiling / Known Limitation**: [Document any shortcut or ceiling]
- **Rollback Strategy**: [How to revert if unexpected regressions occur]
```
