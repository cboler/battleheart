import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="hero-section" aria-labelledby="starter-title">
      <div class="badge-pill">
        <span class="status-indicator"></span>
        Production-Ready Starter
      </div>
      <h1 id="starter-title" class="hero-title">Angular PWA Starter</h1>
      <p class="hero-subtitle">
        A clean, mobile-first Angular foundation with service-worker offline caching, standalone
        architecture, and automated GitHub Pages deployment.
      </p>

      <div class="actions-group">
        <a routerLink="/status" class="button button-primary" id="view-status-btn">
          Verify Runtime Status & SPA Deep-Link
        </a>
        <a
          href="https://github.com/cboler/angular-pwa-starter"
          target="_blank"
          rel="noopener noreferrer"
          class="button button-secondary"
          id="github-repo-link"
        >
          View on GitHub
        </a>
      </div>
    </section>

    <section class="features-grid" aria-label="Starter Capabilities">
      <article class="feature-card">
        <div class="card-icon" aria-hidden="true">⚡</div>
        <h2>Modern Angular Baseline</h2>
        <p>
          Built on current stable standalone components, strict TypeScript, SCSS, Vitest unit
          testing, and ESLint.
        </p>
        <div class="tech-tag">Angular 22 • Standalone • Vitest</div>
      </article>

      <article class="feature-card">
        <div class="card-icon" aria-hidden="true">📱</div>
        <h2>Mobile-First Responsive</h2>
        <p>
          Pre-configured safe areas, accessible 44px minimum tap targets, no accidental horizontal
          overflow, and reduced-motion preferences.
        </p>
        <div class="tech-tag">Phone • Tablet • Desktop</div>
      </article>

      <article class="feature-card">
        <div class="card-icon" aria-hidden="true">📦</div>
        <h2>Installable PWA & Offline</h2>
        <p>
          Web app manifest with standalone display mode and production service-worker caching for
          reliable offline shell startup.
        </p>
        <div class="tech-tag">Manifest • NGSW • Offline Shell</div>
      </article>

      <article class="feature-card">
        <div class="card-icon" aria-hidden="true">🚀</div>
        <h2>GitHub Pages Ready</h2>
        <p>
          Repository-name agnostic base path configuration, automated GitHub Actions workflow, and
          404 client-side SPA routing fallback.
        </p>
        <div class="tech-tag">GitHub Actions • Dynamic Base Path • 404 Fallback</div>
      </article>
    </section>

    <section class="specs-panel" aria-labelledby="quick-check-heading">
      <h2 id="quick-check-heading" class="specs-title">Starter Diagnostics</h2>
      <div class="specs-row">
        <span class="spec-label">Network Status:</span>
        <span
          class="spec-value"
          [class.status-online]="isOnline()"
          [class.status-offline]="!isOnline()"
        >
          {{ isOnline() ? 'Online' : 'Offline' }}
        </span>
      </div>
      <div class="specs-row">
        <span class="spec-label">Active Viewport Profile:</span>
        <span class="spec-value" id="viewport-indicator">{{ currentViewport() }}</span>
      </div>
      <div class="specs-row">
        <span class="spec-label">Template Status:</span>
        <span class="spec-value status-ready">Ready for "Use this template"</span>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .hero-section {
        text-align: center;
        padding: var(--space-8) var(--space-4);
        max-width: 720px;
        margin: 0 auto;
      }

      .badge-pill {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) var(--space-3);
        background-color: var(--bg-surface-elevated);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-full);
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
        font-weight: 500;
        margin-bottom: var(--space-4);
      }

      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--color-success);
      }

      .hero-title {
        font-size: clamp(1.75rem, 5vw, 2.5rem);
        font-weight: 700;
        letter-spacing: -0.025em;
        margin-bottom: var(--space-3);
      }

      .hero-subtitle {
        font-size: clamp(1rem, 2.5vw, 1.125rem);
        line-height: 1.6;
        color: var(--text-secondary);
        margin-bottom: var(--space-6);
      }

      .actions-group {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
        justify-content: center;
        margin-bottom: var(--space-4);
      }

      .button-primary {
        background-color: var(--color-primary);
        color: var(--text-inverse);
        font-weight: 600;
        transition: background-color 0.15s ease;
        &:hover {
          background-color: var(--color-primary-hover);
          text-decoration: none;
        }
      }

      .button-secondary {
        background-color: var(--bg-surface-elevated);
        color: var(--text-primary);
        border: 1px solid var(--border-muted);
        transition: background-color 0.15s ease;
        &:hover {
          background-color: var(--bg-surface-hover);
          text-decoration: none;
        }
      }

      .features-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-4);
        margin: var(--space-6) 0;

        @media (min-width: 640px) {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      .feature-card {
        background-color: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
        padding: var(--space-6);
        display: flex;
        flex-direction: column;

        h2 {
          font-size: var(--font-size-lg);
          margin: var(--space-2) 0 var(--space-2) 0;
        }

        p {
          font-size: var(--font-size-sm);
          margin-bottom: var(--space-4);
          flex-grow: 1;
        }
      }

      .card-icon {
        font-size: 1.75rem;
        margin-bottom: var(--space-2);
      }

      .tech-tag {
        font-family: var(--font-mono);
        font-size: var(--font-size-xs);
        color: var(--color-primary);
        background-color: rgba(56, 189, 248, 0.08);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
        align-self: flex-start;
      }

      .specs-panel {
        background-color: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
        padding: var(--space-4) var(--space-6);
        margin-top: var(--space-6);
      }

      .specs-title {
        font-size: var(--font-size-base);
        margin-bottom: var(--space-3);
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .specs-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-2) 0;
        border-bottom: 1px solid var(--border-subtle);
        font-size: var(--font-size-sm);

        &:last-child {
          border-bottom: none;
        }
      }

      .spec-label {
        color: var(--text-secondary);
      }

      .spec-value {
        font-family: var(--font-mono);
        color: var(--text-primary);
      }

      .status-online {
        color: var(--color-success);
      }

      .status-offline {
        color: var(--color-error);
      }

      .status-ready {
        color: var(--color-primary);
      }
    `,
  ],
})
export class HomeComponent implements OnInit, OnDestroy {
  protected readonly isOnline = signal(typeof navigator !== 'undefined' ? navigator.onLine : true);
  protected readonly currentViewport = signal('Evaluating...');

  private resizeListener?: () => void;
  private onlineListener?: () => void;
  private offlineListener?: () => void;

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.updateViewport();
      this.resizeListener = () => this.updateViewport();
      window.addEventListener('resize', this.resizeListener);

      this.onlineListener = () => this.isOnline.set(true);
      this.offlineListener = () => this.isOnline.set(false);
      window.addEventListener('online', this.onlineListener);
      window.addEventListener('offline', this.offlineListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      if (this.resizeListener) window.removeEventListener('resize', this.resizeListener);
      if (this.onlineListener) window.removeEventListener('online', this.onlineListener);
      if (this.offlineListener) window.removeEventListener('offline', this.offlineListener);
    }
  }

  private updateViewport(): void {
    const width = window.innerWidth;
    if (width < 640) {
      this.currentViewport.set(`Phone (${width}px)`);
    } else if (width < 1024) {
      this.currentViewport.set(`Tablet (${width}px)`);
    } else {
      this.currentViewport.set(`Desktop (${width}px)`);
    }
  }
}
