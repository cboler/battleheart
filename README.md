# Angular PWA Starter

A clean, production-ready, mobile-first **Angular PWA** template repository pre-configured for automated deployment to **GitHub Pages**.

## Purpose

Starting a modern Angular Progressive Web Application hosted on GitHub Pages typically requires solving several subtle integration hurdles:

- Service worker caching and offline startup behavior
- Dynamic subpath base href configuration when hosted on `https://<owner>.github.io/<repo>/`
- Client-side SPA routing fallback on GitHub Pages (preventing 404s on refresh)
- Mobile-first CSS foundation, touch targets, safe-area insets, and accessibility defaults
- Multi-viewport smoke tests and linting gates

This template provides a production-quality, minimal foundation solving these infrastructure requirements out-of-the-box so you can focus immediately on your application.

---

## Creating a New Project

To create your own application from this starter:

1. Click the green **"Use this template"** button at the top of this GitHub repository and select **"Create a new repository"**.
2. Choose your repository name (e.g., `my-angular-app`).
3. Clone your newly created repository locally:
   ```bash
   git clone https://github.com/<your-username>/<your-repo-name>.git
   cd <your-repo-name>
   ```
4. Install dependencies:
   ```bash
   npm ci
   ```
5. In your GitHub repository settings under **Settings > Pages**, set **Build and deployment > Source** to **GitHub Actions**.
6. When you push to `main`, the automated workflow builds and deploys your PWA to `https://<your-username>.github.io/<your-repo-name>/`.

---

## Local Development

Start the local development server:

```bash
npm start
```

Navigate to `http://localhost:4200/` in your browser. The app will automatically reload when you modify source files.

---

## Validation & Developer Commands

Run all quality gates and tests:

| Command                | Purpose                                                                          |
| :--------------------- | :------------------------------------------------------------------------------- |
| `npm start`            | Runs Angular local dev server (`ng serve`)                                       |
| `npm run build`        | Builds production application with bundle size checks                            |
| `npm run build:pages`  | Builds production application and generates GitHub Pages `404.html` SPA fallback |
| `npm test`             | Executes unit tests via Vitest (`ng test --watch=false`)                         |
| `npm run lint`         | Runs ESLint analysis via Angular ESLint (`ng lint`)                              |
| `npm run format`       | Formats codebase using Prettier                                                  |
| `npm run format:check` | Verifies code formatting compliance                                              |
| `npm run e2e`          | Runs Playwright smoke suite across phone, tablet, and desktop viewports          |

---

## GitHub Pages Deployment

Deployment is fully automated via GitHub Actions (`.github/workflows/deploy.yml`).

### Repository-Name Independence

The workflow dynamically resolves your repository's subpath using `actions/configure-pages@v5`:

```bash
npm run build -- --base-href ${{ steps.pages.outputs.base_path }}/
```

- User/Organization Pages (`https://<owner>.github.io/`) receive `--base-href /`
- Project Pages (`https://<owner>.github.io/<repo>/`) receive `--base-href /<repo>/`

You never need to hardcode the repository name or your GitHub username.

### SPA Client-Side Routing Fallback

GitHub Pages is a static host that returns a 404 response when a user directly navigates to or refreshes a client-side route (such as `/status`).

During deployment, `scripts/prepare-pages.mjs` duplicates the generated `dist/browser/index.html` to `dist/browser/404.html`. When GitHub Pages encounters a direct route request, it serves `404.html` with the Angular application bundle and the correct `<base href>`, allowing Angular Router to take control and display the requested route without error.

---

## PWA Customization

To rebrand the starter for your project, replace the following values:

1. **Application Identity & Document Title**:
   - `src/index.html`: Update `<title>`, `<meta name="description">`, and `<meta name="theme-color">`.
   - `src/app/app.ts`: Update the `title` signal.
2. **Web App Manifest**:
   - `public/manifest.webmanifest`: Update `name`, `short_name`, `description`, `theme_color`, and `background_color`.
3. **App Icons**:
   - `public/icons/`: Replace the PNG icons (sizes 72x72 through 512x512) and maskable icons.
   - `public/favicon.ico`: Replace the browser favicon.
4. **Offline Caching Rules**:
   - `ngsw-config.json`: Adjust static asset groups or add dynamic data API caching groups (`dataGroups`) as needed.
5. **Application Views**:
   - Replace placeholder components in `src/app/home/` and `src/app/status/` with your application's domain UI and routes.

---

## Documentation & Agent Guides

Comprehensive documentation and instructions for developers and AI agents:

- **[AGENTS.md](AGENTS.md)**: Agent instructions, map of code, commands, quality gates, and guardrails.
- **[GEMINI.md](GEMINI.md)**: Operational coding rules and the simplicity ladder.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: Detailed system architecture, technology stack, and derivation guidance.
- **[docs/DECISIONS.md](docs/DECISIONS.md)**: Architectural Decision Records (ADRs).
- **[docs/ROADMAP.md](docs/ROADMAP.md)**: Starter baseline, derivation onboarding checklist, and roadmap template.
- **[docs/exec-plans/](docs/exec-plans/active/README.md)**: Structured execution plans (active and completed).

---

## Design Philosophy

This starter embraces **YAGNI** (You Aren't Gonna Need It) and modern web standards:

- **Zero unnecessary runtime dependencies**: Standalone Angular components with native browser APIs.
- **Modern tooling**: Vitest for fast, headless unit tests; Playwright for cross-viewport validation; ESLint + Prettier for code consistency.
- **Mobile-first baseline**: Built-in safe-area insets, touch targets (>= 44px), responsive typography, and reduced-motion support.
- **Deliberate separation**: Common PWA and GitHub Pages deployment mechanics are completely solved, leaving architecture and product design entirely to the descendant project.

## License

[MIT](LICENSE)
