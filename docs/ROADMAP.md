# Project Roadmap

This document outlines the milestones for the **Angular PWA Starter** baseline and provides a structured roadmap template for downstream projects.

---

## Part 1: Starter Template Baseline

The foundational starter provides production-ready infrastructure out-of-the-box:

- [x] **Angular 22+ Standalone Baseline**: Modern Angular bootstrap, inject-based DI, and Signals reactivity.
- [x] **Service Worker & PWA Caching**: Pre-configured `@angular/service-worker` with `prefetch` and `lazy` asset groups.
- [x] **Automated GitHub Pages Deployment**: Fully automated GitHub Actions workflow with dynamic subpath `--base-href` resolution.
- [x] **SPA 404 Routing Fallback**: `scripts/prepare-pages.mjs` generating `404.html` from `index.html` to eliminate static host route refresh errors.
- [x] **Mobile-First Design System**: Vanilla SCSS design tokens, touch targets >= 44px, safe area insets, `:focus-visible` outlines, and zero horizontal scroll.
- [x] **Comprehensive Quality Gates**: Vitest unit testing, Playwright multi-viewport smoke tests, Angular ESLint, and Prettier formatting.
- [x] **Agent Documentation Suite**: `AGENTS.md`, `GEMINI.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and execution plan templates.

---

## Part 2: Downstream Derivation Onboarding Checklist

When creating a new project from this template, complete the following customization tasks:

### 1. Rebrand Application Identity

- [ ] Update `<title>`, `<meta name="description">`, and `<meta name="theme-color">` in `src/index.html`.
- [ ] Update `title` signal in `src/app/app.ts`.
- [ ] Update `name`, `short_name`, and `description` in `public/manifest.webmanifest`.

### 2. Replace Icons and Visual Assets

- [ ] Replace standard icons in `public/icons/` (72x72 through 512x512 PNGs, including maskable icon).
- [ ] Replace browser favicon in `public/favicon.ico`.

### 3. Replace Placeholder Views

- [ ] Replace `src/app/home/` with your application's domain UI and primary views.
- [ ] Retain or adapt `src/app/status/` as an internal diagnostic and environment verification screen.
- [ ] Update route definitions in `src/app/app.routes.ts`.

### 4. Implement Domain State & Persistence

- [ ] Model domain types in `src/app/core/models/`.
- [ ] Implement state services in `src/app/core/services/` using Angular Signals.
- [ ] Add client-side persistence (e.g. `localStorage`, `IndexedDB`, or native Web APIs) if the application operates offline.

### 5. Configure Dynamic API Caching (If Applicable)

- [ ] If your application consumes external HTTP APIs, configure `dataGroups` in `ngsw-config.json` choosing appropriate cache strategies (`freshness` or `performance`).

### 6. Expand Test Suites

- [ ] Add unit tests for new services and components in `src/app/**/*.spec.ts`.
- [ ] Update `e2e/smoke.spec.ts` with domain-specific smoke assertions and critical user journeys.

---

## Part 3: Downstream Project Roadmap Template

> **For Derivations**: Replace this section with your application's phased delivery milestones.

### Phase 1: MVP & Core User Flow

- [ ] **Milestone 1.1: Core Domain Entities & State**: Define models, core state signals, and validation rules.
- [ ] **Milestone 1.2: Primary Interactive View**: Implement the primary user interface and essential interaction controls.
- [ ] **Milestone 1.3: User Flow Smoke Test**: Add Playwright assertions validating the happy-path user journey across viewports.

### Phase 2: Offline Persistence & Interactivity

- [ ] **Milestone 2.1: Local Storage / IndexedDB Sync**: Persist user data locally so changes survive browser reloads.
- [ ] **Milestone 2.2: Offline Indicator & Error Handling**: Provide feedback to users when actions require network connectivity.
- [ ] **Milestone 2.3: Undo/Redo or State Reset**: Provide safe recovery options for destructive user operations.

### Phase 3: Platform Capabilities & Polish

- [ ] **Milestone 3.1: Native Web Platform APIs**: Integrate relevant platform APIs (Web Share, Web Audio, Clipboard, Notifications, etc.).
- [ ] **Milestone 3.2: Keyboard Shortcuts & Controller Support**: Add keyboard shortcuts and accessibility affordances for power users.
- [ ] **Milestone 3.3: Animation & Micro-interactions**: Add CSS transitions adhering to `prefers-reduced-motion`.

### Phase 4: Production Hardening & Auditing

- [ ] **Milestone 4.1: Lighthouse PWA & A11y Audit**: Ensure 95+ scores on Performance, Accessibility, and Best Practices.
- [ ] **Milestone 4.2: Bundle Budget Verification**: Verify production bundles stay within configured budgets in `angular.json`.
- [ ] **Milestone 4.3: Real Device Verification**: Verify touch responsiveness and safe area insets on physical mobile devices.

---

## Part 4: Technical Debt & Maintenance Backlog

Use this section to track known simplifications, performance ceilings, or refactoring opportunities:

| Item ID | Description                    | Severity | Ceiling / Known Constraint                             | Target Phase |
| :------ | :----------------------------- | :------- | :----------------------------------------------------- | :----------- |
| _TD-01_ | _Example: In-memory list scan_ | _Low_    | _Degrades above 500 items; migrate to IndexedDB index_ | _Phase 2_    |
