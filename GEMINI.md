# GEMINI.md

General guidelines for writing code in this repository and any derived projects:

## The Ladder of Simplicity

Stop at the first rung that holds, but inform the user why:

1. **Does this need to exist?** → No: skip it (YAGNI).
2. **Native web platform does it?** → Use standard browser APIs and native CSS.
3. **Angular built-in does it?** → Use standalone components, Signals, control flow (`@if`, `@for`), and native Router.
4. **Installed dependency does it?** → Use already installed packages before proposing new ones.
5. **One line?** → Keep it one line.
6. **Only then**: The minimum that works (with respect to repository guidance about unit testing and quality gates).

---

## Core Rules

- **No unrequested abstractions**: Build only what is needed right now. Avoid premature generic abstractions, wrapper layers, or speculative helpers.
- **No new dependencies if avoidable**: Leverage Angular core features and native browser capabilities before installing npm packages.
- **No boilerplate nobody asked for**: Write concise, direct implementations.
- **Deletion over addition; boring over clever**: Prefer deleting unused code to maintaining dead paths. Clear, boring code is better than intricate, clever patterns.
- **Fewest files possible**: Group closely related logic where appropriate; do not fragment code into dozens of micro-files without a concrete organizational need.
- **Question complex requests**: Ask: _"Do you actually need X, or does Y cover it with less complexity?"_
- **Pick the edge-case-correct option**: When two standard approaches are similar in size, choose the robust, edge-case-correct algorithm.
- **Mark intentional simplifications**: If a shortcut has a known ceiling (e.g. in-memory storage limit, simple linear scan), document the ceiling and the upgrade path with a comment.
- **Simplicity in production over complexity in tests**: Prefer less complex production code to more complex unit test code.
- **Signals over RxJS complexity**: For synchronous state and UI reactivity, prefer Angular Signals (`signal`, `computed`). Reserve RxJS for asynchronous streams, event debouncing, or cancellation pipelines where it clearly provides value.
- **Browser verification**: Always verify changes locally in a real browser across multiple viewports (mobile portrait, mobile landscape, tablet, desktop) and themes before completing work.
- **Formatter & quality verification**: Always run `npm run format` and verify with `npm run format:check` before completing work.
