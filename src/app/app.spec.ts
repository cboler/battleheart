import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { HomeComponent } from './home/home.component';
import { StatusComponent } from './status/status.component';
import { routes } from './app.routes';

describe('Starter Application Tests', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, HomeComponent, StatusComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  describe('App Shell', () => {
    it('should create the root shell', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      expect(app).toBeTruthy();
    });

    it('should render the starter brand title', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.brand-title')?.textContent).toContain('Angular PWA Starter');
    });

    it('should render accessible navigation links for Home and Status', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#nav-link-home')?.textContent?.trim()).toBe('Home');
      expect(compiled.querySelector('#nav-link-status')?.textContent?.trim()).toBe('Status');
    });

    it('should render skip link for accessibility', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      const skipLink = compiled.querySelector('.skip-link');
      expect(skipLink).toBeTruthy();
      expect(skipLink?.getAttribute('href')).toBe('#main-content');
    });
  });

  describe('HomeComponent', () => {
    it('should render hero title and action buttons', async () => {
      const fixture = TestBed.createComponent(HomeComponent);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#starter-title')?.textContent).toBe('Angular PWA Starter');
      expect(compiled.querySelector('#view-status-btn')).toBeTruthy();
    });

    it('should display starter capabilities cards', async () => {
      const fixture = TestBed.createComponent(HomeComponent);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      const cards = compiled.querySelectorAll('.feature-card');
      expect(cards.length).toBe(4);
    });
  });

  describe('StatusComponent', () => {
    it('should create status component and render base uri diagnostic', async () => {
      const fixture = TestBed.createComponent(StatusComponent);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#status-heading')?.textContent).toContain(
        'Runtime & Routing Verification',
      );
      expect(compiled.querySelector('#base-uri-val')).toBeTruthy();
      expect(compiled.querySelector('#back-home-link')).toBeTruthy();
    });
  });
});
