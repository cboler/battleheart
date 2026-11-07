# AGENTS.md

These instructions apply to this repository and any downstream applications derived from this starter.

## Repository Overview

- **Product**: Angular PWA Starter — a clean, mobile-first Progressive Web Application template optimized for static hosting on GitHub Pages.
- **Framework**: Angular (standalone components, inject-based dependency injection, and Angular Signals for reactive state).
- **PWA & Deployment**: Angular Service Worker (`@angular/service-worker`, `ngsw-config.json`), Web App Manifest (`public/manifest.webmanifest`), dynamic subpath base-href, and SPA routing fallback (`scripts/prepare-pages.mjs` creating `404.html`) via GitHub Actions (`.github/workflows/deploy.yml`).
- **Architecture Style**: Client-side single-page application with zero server-side runtime dependency. Designed to be branched or forked into specific application domains.

> **For Derivations**: When building a new application from this starter, customize this section with your product name, domain description, and application-specific architecture.

---

## Map of Code

```
angular-pwa-starter/
├── .github/workflows/       # CI validation and GitHub Pages automated deployment
├── docs/                    # Architecture, ADRs, roadmaps, and execution plans
│   ├── ARCHITECTURE.md      # Detailed system architecture and derivation guide
│   ├── DECISIONS.md         # Architectural Decision Records (ADRs)
│   ├── ROADMAP.md           # Template baseline and downstream project roadmap
│   └── exec-plans/          # Structured execution plans for non-trivial tasks
│       ├── active/          # Plans currently in progress
│       └── completed/       # Archived, verified execution plans
├── e2e/                     # Playwright cross-viewport smoke test suite
│   └── smoke.spec.ts        # Mobile portrait/landscape, tablet, and desktop tests
├── public/                  # Source-controlled static assets
│   ├── icons/               # PWA icons (72x72 through 512x512, maskable)
│   ├── favicon.ico          # Browser tab favicon
│   └── manifest.webmanifest # Web App Manifest identity and theme configuration
├── scripts/                 # Build and deployment helper scripts
│   └── prepare-pages.mjs    # Generates 404.html SPA fallback for GitHub Pages
├── src/                     # Application source code
│   ├── app/
│   │   ├── home/            # Starter placeholder home component (replace in derivations)
│   │   ├── status/          # PWA diagnostic & base-href verification component
│   │   ├── app.config.ts    # Application providers (router, service worker, global error listeners)
│   │   ├── app.routes.ts    # Application route definitions
│   │   ├── app.ts           # Root shell component with PWA update & install prompts
│   │   └── app.html / .scss # Shell layout and navigation styling
│   ├── index.html           # HTML entrypoint, title, viewport, and meta tags
│   ├── main.ts              # Angular bootstrap entrypoint
│   └── styles.scss          # Mobile-first design system tokens, resets, and utilities
├── angular.json             # Angular CLI workspace configuration
├── ngsw-config.json         # Service worker asset caching and data group rules
└── package.json             # Scripts, dependencies, and package configurations
```

---

## Commands & Quality Gates

Prerequisites: Node.js 22+ and npm 10+.

```bash
# Install dependencies reproducibly from lockfile
npm ci

# Start local development server with auto-reload (http://localhost:4200/)
npm start

# Run unit tests via Vitest (headless, single run)
npm test

# Run ESLint static analysis
npm run lint

# Check and fix formatting with Prettier
npm run format
npm run format:check

# Production build and GitHub Pages deployment preparation
npm run build
npm run build:pages

# Run Playwright multi-viewport smoke tests (mobile, tablet, desktop)
npm run e2e
```

---

## Agent Workflow & Documentation System

When planning and implementing changes, follow this structured documentation cycle:

1. **Consult Architecture**: Review `docs/ARCHITECTURE.md` to understand system boundaries, state management patterns, and static hosting mechanics.
2. **Consult & Record Decisions**: Check `docs/DECISIONS.md` before proposing architectural pivots. Record new non-trivial architectural choices as ADRs.
3. **Check & Update Roadmap**: Refer to `docs/ROADMAP.md` for project milestones and customization checklists. Update item status when features land.
4. **Execution Plans for Non-Trivial Tasks**: For multi-step features, architectural refactoring, or risky changes:
   - Create a plan in `docs/exec-plans/active/YYYY-MM-DD-<slug>.md` using the template defined in `docs/exec-plans/active/README.md`.
   - Implement step-by-step, validating against automated tests and real browser rendering.
   - Once verified and complete, move the plan to `docs/exec-plans/completed/`.
5. **Quality Gate Verification**: Never declare work complete without executing `npm test`, `npm run lint`, `npm run format:check`, and testing locally in a browser.

---

## Guardrails & Invariants

All agents and contributors must preserve the following principles:

### 1. PWA & Static Hosting Integrity

- **Subpath Independence**: Keep the application deployable from subpaths (`https://<owner>.github.io/<repo>/`) as well as root domains (`https://example.com/`). Never hardcode root-relative asset paths or router links (`/` instead of `./` or router link tokens).
- **SPA Fallback Preservation**: Never delete or bypass `scripts/prepare-pages.mjs`. Static hosts like GitHub Pages require `404.html` containing the Angular application bundle to support direct client-side route navigation and browser refresh.
- **Service Worker Lifecycle**: Preserve `@angular/service-worker` in `src/app/app.config.ts` and `ngsw-config.json`. Do not disable service worker caching in production builds.

### 2. Mobile-First & Accessibility Baseline

- **Mobile-First CSS**: Write base styles for narrow viewports first; use `@media (min-width: ...)` breakpoints to enhance tablet and desktop layouts.
- **Touch Target Sizing**: Ensure all buttons, links, and interactive controls maintain a minimum target size of 44x44px (`--touch-target-min`).
- **Safe Area Insets**: Support notched displays using CSS `env(safe-area-inset-top/bottom/left/right)`.
- **Keyboard & Focus States**: Retain accessible `:focus-visible` outlines (`--focus-ring`). Never suppress focus rings with `outline: none` without providing an accessible alternative.
- **Zero Horizontal Scroll**: Prevent accidental horizontal layout overflow across phone portrait, phone landscape, tablet, and desktop viewports.

### 3. YAGNI & Minimal Complexity

- **Native Standards First**: Use native browser Web APIs, standard HTML elements, and CSS custom properties before adding third-party libraries.
- **Angular Built-in Primitives**: Prefer Angular Signals (`signal()`, `computed()`) for reactive state and native control flow (`@if`, `@for`) over heavyweight state management libraries or unnecessary RxJS ceremony.
- **No Unrequested Boilerplate**: Keep components and services focused on their explicit purpose. Avoid speculative abstractions.

### 4. Derivation Guidance

- When converting this starter into a specific product:
  - Replace `src/app/home/` with domain-specific features and views.
  - Rebrand metadata in `src/index.html`, `public/manifest.webmanifest`, and icons in `public/icons/`.
  - Update `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/ROADMAP.md` to reflect the new application domain while retaining the core operational rules.
