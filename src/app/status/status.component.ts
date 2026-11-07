import { Component, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-status',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="status-container" aria-labelledby="status-heading">
      <div class="header-nav">
        <a routerLink="/" class="back-link" id="back-home-link"> ← Back to Home </a>
      </div>

      <h1 id="status-heading">Runtime & Routing Verification</h1>
      <p class="status-description">
        This screen verifies that Angular client-side routing and deep linking function properly.
        When hosted on GitHub Pages, refreshing this page or navigating directly to
        <code>/status</code> loads the application shell via the automated <code>404.html</code> SPA
        fallback.
      </p>

      <div class="diagnostics-card">
        <h2>Environment & PWA Diagnostics</h2>

        <dl class="diagnostics-list">
          <div class="diag-item">
            <dt>Base URI (document.baseURI):</dt>
            <dd>
              <code id="base-uri-val">{{ baseUri() }}</code>
            </dd>
          </div>

          <div class="diag-item">
            <dt>Current Route Path:</dt>
            <dd><code id="current-path-val">/status</code></dd>
          </div>

          <div class="diag-item">
            <dt>Display Mode:</dt>
            <dd id="display-mode-val">{{ displayMode() }}</dd>
          </div>

          <div class="diag-item">
            <dt>Service Worker Support:</dt>
            <dd [class.status-supported]="hasSw()" [class.status-unsupported]="!hasSw()">
              {{ hasSw() ? 'Supported in Browser' : 'Not Supported' }}
            </dd>
          </div>

          <div class="diag-item">
            <dt>Service Worker Controller:</dt>
            <dd id="sw-controller-val">{{ swController() }}</dd>
          </div>
        </dl>
      </div>

      <div class="info-box">
        <h3>GitHub Pages Repository Subpath Note</h3>
        <p>
          In production, GitHub Pages deploys this starter at
          <code>https://&lt;owner&gt;.github.io/&lt;repo&gt;/</code>. The GitHub Actions workflow
          injects the exact repository path into <code>--base-href</code> dynamically, so all
          routing, service-worker caching, and relative asset loads succeed regardless of the
          repository's name.
        </p>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .status-container {
        max-width: 720px;
        margin: 0 auto;
        padding: var(--space-6) var(--space-4);
      }

      .header-nav {
        margin-bottom: var(--space-4);
      }

      .back-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-size-sm);
        color: var(--color-primary);
        text-decoration: none;
        min-height: var(--touch-target-min);

        &:hover {
          text-decoration: underline;
        }
      }

      h1 {
        font-size: clamp(1.5rem, 4vw, 2rem);
        margin-bottom: var(--space-2);
      }

      .status-description {
        font-size: var(--font-size-base);
        line-height: 1.6;
        margin-bottom: var(--space-6);
      }

      .diagnostics-card {
        background-color: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
        padding: var(--space-6);
        margin-bottom: var(--space-6);

        h2 {
          font-size: var(--font-size-lg);
          margin-bottom: var(--space-4);
        }
      }

      .diagnostics-list {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .diag-item {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding-bottom: var(--space-3);
        border-bottom: 1px solid var(--border-subtle);

        @media (min-width: 540px) {
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
        }

        &:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        dt {
          color: var(--text-secondary);
          font-size: var(--font-size-sm);
        }

        dd {
          margin: 0;
          font-family: var(--font-mono);
          font-size: var(--font-size-sm);
          color: var(--text-primary);
        }
      }

      .status-supported {
        color: var(--color-success);
      }

      .status-unsupported {
        color: var(--color-warning);
      }

      .info-box {
        background-color: rgba(56, 189, 248, 0.05);
        border: 1px solid rgba(56, 189, 248, 0.2);
        border-radius: var(--radius-lg);
        padding: var(--space-4) var(--space-6);

        h3 {
          color: var(--color-primary);
          font-size: var(--font-size-base);
          margin-bottom: var(--space-2);
        }

        p {
          margin: 0;
          font-size: var(--font-size-sm);
          line-height: 1.5;
          color: var(--text-secondary);
        }
      }
    `,
  ],
})
export class StatusComponent implements OnInit {
  protected readonly baseUri = signal('/');
  protected readonly displayMode = signal('browser');
  protected readonly hasSw = signal(
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  );
  protected readonly swController = signal('None (active in production build)');

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      this.baseUri.set(document.baseURI || '/');
    }

    if (typeof window !== 'undefined') {
      if (typeof window.matchMedia === 'function') {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        this.displayMode.set(isStandalone ? 'standalone (PWA Installed)' : 'browser');
      }

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        this.swController.set('Active & Controlling Page');
      }
    }
  }
}
