import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, Subscription } from 'rxjs';
import {
  ARMOR_TIERS,
  HERO_CATALOG,
  STAGE_CATALOG,
  TRINKET_CATALOG,
  WEAPON_TIERS,
} from '../core/models/game-catalog';
import {
  CombatUnit,
  EquipmentTier,
  HeroClassDefinition,
  HeroClassId,
  StageDefinition,
  TrinketDefinition,
} from '../core/models/game.model';
import { AudioService } from '../core/services/audio.service';
import { CombatService } from '../core/services/combat.service';
import { GameStateService } from '../core/services/game-state.service';
import { GamepadService } from '../core/services/gamepad.service';
import { WeatherShaderService } from '../core/services/weather-shader.service';

export type HubTab = 'map' | 'tavern' | 'armory' | 'academy' | 'saves' | 'about';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  protected readonly gameState = inject(GameStateService);
  protected readonly combat = inject(CombatService);
  protected readonly audio = inject(AudioService);
  protected readonly gamepad = inject(GamepadService);
  protected readonly weatherShader = inject(WeatherShaderService);
  private readonly swUpdate = inject(SwUpdate, { optional: true });

  @ViewChild('arenaRef') private arenaRef?: ElementRef<HTMLElement>;

  @ViewChild('weatherCanvas') set weatherCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    if (ref?.nativeElement) {
      this.weatherShader.attach(ref.nativeElement);
      this.weatherShader.setTheme(this.combat.currentStageWeather());
    } else {
      this.weatherShader.detach();
    }
  }

  protected readonly activeTab = signal<HubTab>('map');
  protected readonly inspectedHeroId = signal<HeroClassId>('knight');
  protected readonly selectedStageId = signal<string>('stage-1');

  protected readonly selectedStageEntry = computed(
    () =>
      this.gameState.stages().find((s) => s.stage.id === this.selectedStageId()) ??
      this.gameState.stages()[0],
  );

  protected readonly campaignRoadPoints = computed(() =>
    STAGE_CATALOG.filter((s) => !s.isArena)
      .map((s) => `${s.mapX},${s.mapY}`)
      .join(' '),
  );

  protected readonly inspectedHero = computed(
    () =>
      this.gameState.roster().find((h) => h.def.id === this.inspectedHeroId()) ??
      this.gameState.roster()[0],
  );

  protected readonly trinkets = TRINKET_CATALOG;
  protected readonly Math = Math;

  // Save import/export UI state
  protected readonly saveJsonText = signal('');
  protected readonly saveStatusMsg = signal('');
  readonly forceLandscape = signal(false);

  // Battlefield Line-Drawing Drag State
  protected readonly draggingFromHeroUid = signal<string | null>(null);
  protected readonly dragCurrentX = signal(50);
  protected readonly dragCurrentY = signal(50);
  protected readonly hoveredTargetUid = signal<string | null>(null);

  protected readonly draggingFromHero = computed(() =>
    this.combat.units().find((u) => u.uid === this.draggingFromHeroUid() && u.isHero),
  );

  protected readonly dragLineColor = computed(() => {
    const hero = this.draggingFromHero();
    const target = this.combat.units().find((u) => u.uid === this.hoveredTargetUid());
    if (target) {
      return target.isHero ? '#34d399' : '#ef4444';
    }
    return hero?.accentColor ?? '#38bdf8';
  });

  private gamepadSub?: Subscription;

  ngOnInit(): void {
    if (this.swUpdate?.isEnabled) {
      void this.swUpdate.checkForUpdate().catch((err: unknown) => {
        console.debug('ServiceWorker update check skipped:', err);
      });
      this.swUpdate.versionUpdates
        .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
        .subscribe(() => {
          this.swUpdate?.activateUpdate().then(() => document.location.reload());
        });
    }

    this.gamepad.start();
    this.gamepadSub = this.gamepad.commands$.subscribe((cmd) => {
      if (!this.combat.isRunning()) return;
      switch (cmd.type) {
        case 'prev-hero':
          this.combat.cycleSelectedHero(-1);
          break;
        case 'next-hero':
          this.combat.cycleSelectedHero(1);
          break;
        case 'skill': {
          const sel = this.combat.selectedHeroUid();
          if (sel) {
            this.combat.activateHeroSkill(sel, cmd.index);
          }
          break;
        }
        case 'confirm-reticle': {
          const sel = this.combat.selectedHeroUid();
          if (!sel) break;
          const rx = this.gamepad.reticleX();
          const ry = this.gamepad.reticleY();
          const hitUnit = this.findNearestUnitAt(rx, ry, 9);
          this.combat.issueCommand(sel, hitUnit?.uid ?? null, { x: rx, y: ry });
          break;
        }
        case 'pause':
          this.combat.togglePause();
          break;
      }
    });
  }

  ngOnDestroy(): void {
    this.gamepadSub?.unsubscribe();
    this.weatherShader.detach();
    this.combat.stopBattle();
  }

  @HostListener('window:keydown', ['$event'])
  protected onWindowKeyDown(e: KeyboardEvent): void {
    if (!this.combat.isRunning()) return;
    const heroes = this.combat.heroes();
    if (e.key === '1' && heroes[0]) this.combat.selectHero(heroes[0].uid);
    if (e.key === '2' && heroes[1]) this.combat.selectHero(heroes[1].uid);
    if (e.key === '3' && heroes[2]) this.combat.selectHero(heroes[2].uid);
    if (e.key === '4' && heroes[3]) this.combat.selectHero(heroes[3].uid);
  }

  protected setTab(tab: HubTab): void {
    this.activeTab.set(tab);
    this.audio.playSelect();
  }

  protected selectMapNode(stageId: string): void {
    this.selectedStageId.set(stageId);
    this.audio.playSelect();
  }

  protected switchSlot(slot: number): void {
    if (slot === 1 || slot === 2 || slot === 3) {
      this.gameState.switchSaveSlot(slot);
      this.saveStatusMsg.set(`Switched to Save Slot #${slot}.`);
    }
  }

  protected inspectHero(id: HeroClassId): void {
    this.inspectedHeroId.set(id);
    this.audio.playSelect();
  }

  protected inspectHeroAndOpenArmory(id: HeroClassId): void {
    this.inspectedHeroId.set(id);
    this.activeTab.set('armory');
    this.audio.playSelect();
  }

  protected nextWeaponTier(currentTier: number): EquipmentTier | null {
    return WEAPON_TIERS[currentTier] ?? null;
  }

  protected nextArmorTier(currentTier: number): EquipmentTier | null {
    return ARMOR_TIERS[currentTier] ?? null;
  }

  protected getTrinketById(id: string | null | undefined): TrinketDefinition | null {
    if (!id) return null;
    return TRINKET_CATALOG.find((t) => t.id === id) ?? null;
  }

  protected getHeroDefById(id: HeroClassId | undefined): HeroClassDefinition | null {
    if (!id) return null;
    return HERO_CATALOG[id] ?? null;
  }

  protected launchStage(stage: StageDefinition): void {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
    this.audio.playSelect();
    this.combat.startBattle(stage);
    this.weatherShader.setTheme(this.combat.currentStageWeather());
  }

  toggleForceLandscape(): void {
    const next = !this.forceLandscape();
    this.forceLandscape.set(next);
    if (next && typeof screen !== 'undefined' && 'orientation' in screen) {
      const orient = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      orient.lock?.('landscape').catch(() => undefined);
    }
    this.audio.playSelect();
  }

  protected triggerSkill(heroUid: string, skillIndex: number): void {
    this.combat.activateHeroSkill(heroUid, skillIndex);
  }

  // --- Line-Drawing Pointer Handlers ---

  protected onArenaPointerDown(event: PointerEvent): void {
    if (this.combat.outcome() !== 'ongoing') return;
    const pt = this.pointerToArenaCoords(event);
    if (!pt) return;

    // Check if pointer started on or near a Hero
    const clickedHero = this.findNearestHeroAt(pt.x, pt.y, 11);
    if (clickedHero) {
      this.combat.selectHero(clickedHero.uid);
      this.draggingFromHeroUid.set(clickedHero.uid);
      this.dragCurrentX.set(pt.x);
      this.dragCurrentY.set(pt.y);
      this.hoveredTargetUid.set(null);
      return;
    }

    // Otherwise if a hero is already selected, clicking an enemy or ground issues a quick command
    const selectedUid = this.combat.selectedHeroUid();
    if (selectedUid) {
      const targetUnit = this.findNearestUnitAt(pt.x, pt.y, 10);
      this.combat.issueCommand(selectedUid, targetUnit?.uid ?? null, pt);
    }
  }

  protected onArenaPointerMove(event: PointerEvent): void {
    const fromUid = this.draggingFromHeroUid();
    if (!fromUid) return;

    const pt = this.pointerToArenaCoords(event);
    if (!pt) return;

    this.dragCurrentX.set(pt.x);
    this.dragCurrentY.set(pt.y);

    const candidate = this.findNearestUnitAt(pt.x, pt.y, 10, fromUid);
    this.hoveredTargetUid.set(candidate?.uid ?? null);
  }

  protected onArenaPointerUp(event: PointerEvent): void {
    const fromUid = this.draggingFromHeroUid();
    if (!fromUid) return;

    const pt = this.pointerToArenaCoords(event) ?? {
      x: this.dragCurrentX(),
      y: this.dragCurrentY(),
    };

    const targetUnit = this.findNearestUnitAt(pt.x, pt.y, 10.5, fromUid);
    const dragHero = this.draggingFromHero();

    // Only issue a movement/target command if the user dragged at least a small distance or onto another unit
    if (targetUnit || (dragHero && Math.hypot(pt.x - dragHero.x, pt.y - dragHero.y) > 4)) {
      this.combat.issueCommand(fromUid, targetUnit?.uid ?? null, pt);
    }

    this.draggingFromHeroUid.set(null);
    this.hoveredTargetUid.set(null);
  }

  protected getHeroCommandTargetPos(
    hero: CombatUnit,
  ): { x: number; y: number; color: string } | null {
    if (hero.moveDestination) {
      return {
        x: hero.moveDestination.x,
        y: hero.moveDestination.y,
        color: hero.accentColor,
      };
    }
    if (hero.targetUnitUid) {
      const target = this.combat.units().find((u) => u.uid === hero.targetUnitUid);
      if (target) {
        return {
          x: target.x,
          y: target.y,
          color: target.isHero ? '#34d399' : '#ef4444',
        };
      }
    }
    return null;
  }

  // --- Save Export / Import Handlers ---

  protected handleExportSave(): void {
    const json = this.gameState.exportSave();
    this.saveJsonText.set(json);
    this.saveStatusMsg.set('Save exported! Copy the JSON above to back it up.');
  }

  protected onSaveJsonInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.saveJsonText.set(target.value);
  }

  protected handleImportSave(): void {
    const ok = this.gameState.importSave(this.saveJsonText());
    this.saveStatusMsg.set(
      ok ? 'Save imported successfully!' : 'Invalid save JSON format. Please check and try again.',
    );
  }

  protected handleResetSlot(): void {
    this.gameState.resetCurrentSlot();
    this.saveJsonText.set('');
    this.saveStatusMsg.set(`Save Slot #${this.gameState.activeSlot()} reset to fresh warband.`);
  }

  private pointerToArenaCoords(event: PointerEvent): { x: number; y: number } | null {
    const el = this.arenaRef?.nativeElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    if (this.forceLandscape()) {
      const x = ((event.clientY - rect.top) / rect.height) * 100;
      const y = (1 - (event.clientX - rect.left) / rect.width) * 100;
      return {
        x: Math.max(5, Math.min(95, x)),
        y: Math.max(30, Math.min(92, y)),
      };
    }
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(30, Math.min(92, y)),
    };
  }

  private findNearestHeroAt(x: number, y: number, maxRadius: number): CombatUnit | null {
    let best: CombatUnit | null = null;
    let bestDist = maxRadius;
    for (const h of this.combat.heroes()) {
      // Visual sprite sits slightly above anchor y
      const d = Math.hypot(h.x - x, h.y - 4 - y);
      if (d <= bestDist) {
        bestDist = d;
        best = h;
      }
    }
    return best;
  }

  private findNearestUnitAt(
    x: number,
    y: number,
    maxRadius: number,
    excludeUid?: string,
  ): CombatUnit | null {
    let best: CombatUnit | null = null;
    let bestDist = maxRadius;
    for (const u of this.combat.units()) {
      if (u.uid === excludeUid) continue;
      const d = Math.hypot(u.x - x, u.y - 4 - y);
      if (d <= bestDist) {
        bestDist = d;
        best = u;
      }
    }
    return best;
  }
}
