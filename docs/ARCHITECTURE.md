# System Architecture

This document describes the architectural foundation of the **Angular PWA Starter** and provides guidance for downstream applications derived from it.

---

## 1. System Overview

The application is structured as a client-side **Progressive Web Application (PWA)** hosted entirely on static infrastructure (such as **GitHub Pages**) with zero server-side application runtime required:

```
[ Web Browser ]
      │
      ├──> [ Angular Service Worker (ngsw-worker.js) ]
      │         ├──> Cached Application Shell & Assets (CacheStorage)
      │         └──> Network Fallback / Dynamic Data Groups
      │
      └──> [ Angular Application Shell ]
                ├──> Standalone Components & UI
                ├──> Angular Signals (Reactivity & State)
                └──> Angular Router (Client-side Navigation)
```

### Key Architectural Characteristics

- **Client-First Execution**: The application executes completely in the user's browser, enabling fast transitions, offline execution, and high privacy.
- **Static Hosting Optimized**: Designed for static hosting environments like GitHub Pages, where URL rewriting is handled client-side via a single-page app (SPA) fallback mechanism.
- **Repository-Name Independence**: Built without hardcoding hosting subpaths, allowing seamless deployment to `https://<owner>.github.io/<repo>/` or custom apex domains `https://example.com/`.

---

## 2. Technology Stack & Key Libraries

| Layer / Concern        | Technology / Library      | Purpose / Justification                                        |
| :--------------------- | :------------------------ | :------------------------------------------------------------- |
| **Framework**          | Angular (v22+)            | Enterprise-grade web framework with standalone components.     |
| **Reactivity & State** | Angular Signals           | Fine-grained reactivity, predictable unidirectional updates.   |
| **Routing**            | Angular Router            | Hashless client-side routing with lazy-loading support.        |
| **Offline & PWA**      | `@angular/service-worker` | Production asset caching, offline boot, and update checks.     |
| **Styling**            | Vanilla SCSS              | Design tokens via CSS custom properties; zero framework bloat. |
| **Unit Testing**       | Vitest (`jsdom`)          | High-speed, headless component and service unit testing.       |
| **E2E Smoke Testing**  | Playwright                | Real browser testing across mobile, tablet, and desktop.       |
| **Code Quality**       | Angular ESLint + Prettier | Automated linting and formatting compliance.                   |
| **Deployment**         | GitHub Actions            | Automated building, testing, and deployment to GitHub Pages.   |

---

## 3. Directory Layout & Boundaries

```
angular-pwa-starter/
├── docs/                     # Architectural, decision, roadmap, and planning records
├── e2e/                      # End-to-end tests validating browser viewports and flows
├── public/                   # Static files served directly without compilation
│   ├── icons/                # PWA icons across standard screen sizes
│   └── manifest.webmanifest  # Install metadata, orientations, and theme colors
├── scripts/                  # Automation scripts for build and deployment pipeline
│   └── prepare-pages.mjs     # Generates 404.html SPA fallback from index.html
├── src/
│   ├── app/                  # Application code
│   │   ├── home/             # Template placeholder views (to be replaced in derivations)
│   │   ├── status/           # PWA runtime inspection & environment diagnostic
│   │   ├── app.config.ts     # Global application providers
│   │   ├── app.routes.ts     # Route table and lazy loading configurations
│   │   ├── app.ts            # Root application coordinator and PWA install prompts
│   │   └── app.html / .scss  # Root shell presentation and banner layout
│   ├── index.html            # HTML document entrypoint
│   ├── main.ts               # Application bootstrap
│   └── styles.scss           # Design system tokens, mobile-first resets, and utilities
```

### Architectural Boundaries

1. **Application Source (`src/app/`)**: Owns business logic, UI components, state management, and user interactions.
2. **Static Assets (`public/`)**: Owns source-controlled static images, manifests, and icons. Files here are copied directly to build output.
3. **Deployment Automation (`scripts/`)**: Encapsulates platform-specific static hosting adaptations (e.g. GitHub Pages fallback creation).
4. **Quality Gates (`e2e/`, `*.spec.ts`)**: Validates that changes do not regress cross-viewport layouts, navigation, or service worker initialization.

---

## 4. State Management & Reactivity

The application uses **Angular Signals** as its primary reactive primitive:

- **Local UI State**: Managed via writable signals (`signal<T>()`) inside components.
- **Derived Computations**: Managed via read-only computed signals (`computed(() => ...)`), ensuring deterministic recalculation only when dependencies change.
- **Side Effects**: Isolated in `effect(() => ...)` or explicit lifecycle methods, guarding against uncontrolled mutation loops.

### Signals vs. RxJS Decision Matrix

- **Use Signals for**:
  - Primitive state (booleans, counters, input values, active selections).
  - Synchronous derived state (filtered lists, computed totals).
  - Template binding and UI rendering.
- **Use RxJS for**:
  - Asynchronous event streaming with debouncing or throttling.
  - Multi-request race condition management (switchMap).
  - Angular Service Worker event subscriptions (`SwUpdate.versionUpdates`).

---

## 5. Routing & Static Hosting Mechanics

GitHub Pages is a static file host that does not provide native URL rewrite rules for client-side routing. Navigating directly or refreshing on a route like `/status` on a static host normally produces an HTTP 404 error.

This starter solves this problem with a clean build hook:

```
[ Direct Route Request: /status ]
               │
               ▼
   [ GitHub Pages Server ]
               │ (File /status/index.html does not exist)
               ▼
       [ Serves 404.html ]  <── Generated by scripts/prepare-pages.mjs
               │                (contains Angular bundle + <base href>)
               ▼
      [ Browser Executes App ]
               │
               ▼
     [ Angular Router Activates ]
               │ (Detects URL is /status)
               ▼
     [ Renders Status View Cleanly ]
```

### Subpath Independence

The GitHub Actions workflow uses `@actions/configure-pages` to dynamically inject the `--base-href`:

- Root user sites (`https://<user>.github.io/`) receive `--base-href /`.
- Project subpath sites (`https://<user>.github.io/<repo>/`) receive `--base-href /<repo>/`.

No hardcoded URLs exist in the source code.

---

## 6. PWA & Offline Strategy

Offline capabilities are governed by `@angular/service-worker` through `ngsw-config.json`:

1. **App Shell Asset Group (`prefetch`)**:
   - Includes `index.html`, `favicon.ico`, and all compiled JS/CSS bundles.
   - Downloaded and cached immediately upon installation to ensure the shell boots instantly without internet access.
2. **Assets Group (`lazy`)**:
   - Includes images, icons, and static documents in `public/`.
   - Downloaded on-demand when first requested and cached for subsequent offline use.
3. **Dynamic Data Groups (For Derivations)**:
   - When downstream applications introduce external REST APIs, define `dataGroups` in `ngsw-config.json` choosing either `freshness` (network-first with cache fallback) or `performance` (cache-first with background revalidation).

---

## 7. Styling & Mobile-First Foundation

The application uses **Vanilla SCSS** structured around CSS Custom Properties (`src/styles.scss`):

- **Mobile-First Breakpoints**: Base styles target 320px+ viewports. Media queries expand layout for tablets (`min-width: 640px`) and desktops (`min-width: 1024px`).
- **Touch Target Ergonomics**: All interactive elements satisfy `--touch-target-min: 44px`.
- **Safe Area Insets**: Handled via `env(safe-area-inset-top/bottom/left/right)` to adapt gracefully to modern mobile screens and notches.
- **Accessibility Baseline**: Focus visibility (`:focus-visible`), readable contrast ratios, and `prefers-reduced-motion` compliance are built directly into the core stylesheet.
- **No Accidental Horizontal Overflow**: Containers use flexbox/grid with fluid max-widths to guarantee zero horizontal scrollbars.

---

## 8. Testing & Quality Strategy

Quality gates run automatically in local workflows and GitHub Actions CI:

```
npm run lint         ──> Angular ESLint verifies code style & best practices
npm run format:check ──> Prettier verifies code formatting
npm test             ──> Vitest runs unit test suites in headless JSDOM
npm run build        ──> Angular build checks budgets & compile errors
npm run e2e          ──> Playwright tests shell across mobile, tablet, and desktop
```

---

## 9. Downstream Derivation Guide

When creating a new application from this starter, follow these recommendations:

1. **Feature Directory Structure**: Create feature folders under `src/app/features/<feature-name>/` with standalone components, models, and tests colocated.
2. **Core Services**: Place shared singleton services (e.g. storage, sound, sensor, or API clients) in `src/app/core/services/`.
3. **Domain Models**: Place pure TypeScript interfaces and types in `src/app/core/models/`.
4. **Preserve Deployment Hooks**: Do not alter `scripts/prepare-pages.mjs` or the base-href injection in `.github/workflows/deploy.yml` unless migrating to a different hosting platform.
5. **Update Documentation**: Maintain `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/ROADMAP.md` as the application's domain and architecture evolve.
