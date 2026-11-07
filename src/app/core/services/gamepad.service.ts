import { DOCUMENT, inject, Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { Subject } from 'rxjs';

export type GamepadCommand =
  | { type: 'prev-hero' }
  | { type: 'next-hero' }
  | { type: 'skill'; index: 0 | 1 }
  | { type: 'confirm-reticle' }
  | { type: 'cancel' }
  | { type: 'pause' };

@Injectable({ providedIn: 'root' })
export class GamepadService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);

  public readonly connected = signal(false);
  public readonly controllerName = signal('');
  public readonly activeMode = signal<'pointer' | 'keyboard' | 'gamepad'>('pointer');

  // Battlefield reticle coordinates (in arena %: x in [7, 93], y in [36, 88])
  public readonly reticleX = signal(52);
  public readonly reticleY = signal(62);

  private readonly commandSource = new Subject<GamepadCommand>();
  public readonly commands$ = this.commandSource.asObservable();

  private rafId: number | null = null;
  private lastButtons: boolean[] = [];
  private lastPollTime = 0;

  public start(): void {
    const view = this.document.defaultView;
    if (this.rafId !== null || !view) return;

    view.addEventListener('pointerdown', this.onPointer);
    view.addEventListener('keydown', this.onKeyDown);

    if (typeof view.navigator?.getGamepads === 'function') {
      this.zone.runOutsideAngular(() => {
        this.lastPollTime = performance.now();
        this.rafId = view.requestAnimationFrame(this.poll);
      });
    }
  }

  public ngOnDestroy(): void {
    const view = this.document.defaultView;
    if (this.rafId !== null && view) {
      view.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    view?.removeEventListener('pointerdown', this.onPointer);
    view?.removeEventListener('keydown', this.onKeyDown);
    this.commandSource.complete();
  }

  public moveReticle(dx: number, dy: number): void {
    this.reticleX.set(Math.max(7, Math.min(93, this.reticleX() + dx)));
    this.reticleY.set(Math.max(36, Math.min(88, this.reticleY() + dy)));
  }

  private readonly onPointer = (): void => {
    if (this.activeMode() !== 'pointer') {
      this.activeMode.set('pointer');
    }
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.isEditing()) return;
    if (['1', '2', '3', '4', 'q', 'w', 'Q', 'W', ' ', 'Tab'].includes(e.key)) {
      this.activeMode.set('keyboard');
    }
    if (e.key === 'q' || e.key === 'Q') {
      this.commandSource.next({ type: 'skill', index: 0 });
    } else if (e.key === 'w' || e.key === 'W') {
      this.commandSource.next({ type: 'skill', index: 1 });
    } else if (e.key === ' ') {
      e.preventDefault();
      this.commandSource.next({ type: 'pause' });
    }
  };

  private readonly poll = (now: number): void => {
    const view = this.document.defaultView;
    if (!view) return;

    const dt = Math.min(0.1, (now - this.lastPollTime) / 1000);
    this.lastPollTime = now;

    let pad: Gamepad | undefined;
    try {
      pad = Array.from(view.navigator.getGamepads()).find((p): p is Gamepad => !!p?.connected);
    } catch {
      // Ignore restricted frame errors
    }

    if (!!pad !== this.connected()) {
      this.zone.run(() => {
        this.connected.set(!!pad);
        this.controllerName.set(pad?.id ?? '');
      });
    }

    if (pad && !this.document.hidden && !this.isEditing()) {
      const pressed = pad.buttons.map((b) => b.pressed);
      const edge = (idx: number) => Boolean(pressed[idx] && !this.lastButtons[idx]);

      // Stick or D-Pad movement
      let ax = pad.axes[0] ?? 0;
      let ay = pad.axes[1] ?? 0;
      if (Math.abs(ax) < 0.22) ax = 0;
      if (Math.abs(ay) < 0.22) ay = 0;

      if (pressed[14]) ax = -1;
      if (pressed[15]) ax = 1;
      if (pressed[12]) ay = -1;
      if (pressed[13]) ay = 1;

      if (ax !== 0 || ay !== 0) {
        this.zone.run(() => {
          this.activeMode.set('gamepad');
          this.moveReticle(ax * 48 * dt, ay * 42 * dt);
        });
      }

      if (edge(0) || edge(1) || edge(2) || edge(3) || edge(4) || edge(5) || edge(9)) {
        this.zone.run(() => {
          this.activeMode.set('gamepad');
          if (edge(4)) this.commandSource.next({ type: 'prev-hero' }); // LB
          if (edge(5)) this.commandSource.next({ type: 'next-hero' }); // RB
          if (edge(0)) this.commandSource.next({ type: 'confirm-reticle' }); // A
          if (edge(1)) this.commandSource.next({ type: 'cancel' }); // B
          if (edge(2)) this.commandSource.next({ type: 'skill', index: 0 }); // X
          if (edge(3)) this.commandSource.next({ type: 'skill', index: 1 }); // Y
          if (edge(9)) this.commandSource.next({ type: 'pause' }); // Start
        });
      }

      this.lastButtons = pressed;
    }

    this.rafId = view.requestAnimationFrame(this.poll);
  };

  private isEditing(): boolean {
    return !!this.document.activeElement?.closest('input, textarea, select');
  }
}

