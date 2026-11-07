# AGENTS.md

These instructions apply to this repository.

## Repository Overview

- **Product**: Battleheart — a tactical real-time line-drawing party RPG inspired by the original 2011 _Battleheart_, built as a mobile-first Progressive Web Application optimized for static hosting on GitHub Pages.
- **Framework**: Angular 22 (standalone components, inject-based dependency injection, and Angular Signals for reactive state).
- **PWA & Deployment**: Angular Service Worker (`@angular/service-worker`, `ngsw-config.json`), Web App Manifest (`public/manifest.webmanifest`), dynamic subpath base-href, and SPA routing fallback (`scripts/prepare-pages.mjs` creating `404.html`) via GitHub Actions (`.github/workflows/deploy.yml`).
- **Architecture Style**: Client-side single-page application with zero server-side runtime dependency, bespoke replaceable SVG assets (`public/assets/svg/`), procedural Web Audio API sound synthesis, LocalStorage multi-slot saves, and Gamepad API controller support.

---

## Map of Code

```
battleheart/
├── .github/workflows/       # CI validation and GitHub Pages automated deployment
├── docs/                    # Architecture, ADRs, roadmaps, and execution plans
│   ├── ARCHITECTURE.md      # Detailed system architecture
│   ├── DECISIONS.md         # Architectural Decision Records (ADRs)
│   ├── ROADMAP.md           # Project milestones and roadmap
│   └── exec-plans/          # Structured execution plans for non-trivial tasks
│       ├── active/          # Plans currently in progress
│       └── completed/       # Archived, verified execution plans
├── e2e/                     # Playwright cross-viewport smoke test suite
│   └── smoke.spec.ts        # Mobile portrait/landscape, tablet, and desktop tests
├── public/                  # Source-controlled static assets
│   ├── assets/svg/          # Modular replaceable SVG art (heroes/, enemies/, backdrops/)
│   ├── icons/               # PWA icons (72x72 through 512x512, maskable)
│   ├── favicon.ico          # Browser tab favicon
│   └── manifest.webmanifest # Web App Manifest identity and theme configuration
├── scripts/                 # Build and deployment helper scripts
│   └── prepare-pages.mjs    # Generates 404.html SPA fallback for GitHub Pages
├── src/                     # Application source code
│   ├── app/
│   │   ├── core/
│   │   │   ├── models/      # Hero classes, skills, items, enemies, stages, and combat types
│   │   │   └── services/    # AudioService, StorageService, GamepadService, GameStateService, CombatService
│   │   ├── home/            # Realm Hub (World Map, Tavern, Armory, Academy, Saves) + Battlefield Arena
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
npm test -- --watch=false

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
