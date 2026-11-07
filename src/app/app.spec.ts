import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { STAGE_CATALOG } from './core/models/game-catalog';
import { CombatService } from './core/services/combat.service';
import { GameStateService } from './core/services/game-state.service';
import { StorageService } from './core/services/storage.service';
import { App } from './app';
import { routes } from './app.routes';
import { HomeComponent } from './home/home.component';
import { StatusComponent } from './status/status.component';

describe('Battleheart Application & Core Mechanics Tests', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App, HomeComponent, StatusComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  describe('App Shell & HomeComponent Warband Hub', () => {
    it('should create the root shell and retain accessible skip-link', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      const skipLink = compiled.querySelector('.skip-link');
      expect(skipLink?.getAttribute('href')).toBe('#main-content');
    });

    it('should render Battleheart warband crest bar and illustrated overworld map', async () => {
      const fixture = TestBed.createComponent(HomeComponent);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.brand-title')?.textContent).toContain('Battleheart');
      expect(compiled.querySelector('.parchment-map-stage')).toBeTruthy();
      expect(compiled.querySelectorAll('.map-pin-node').length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('GameStateService & LocalStorage Persistence', () => {
    it('should initialize with 3 unlocked starter heroes in active party (Knight, Cleric, Rogue)', () => {
      const state = TestBed.inject(GameStateService);
      const party = state.partyHeroes();
      expect(party.length).toBe(3);
      expect(party.map((h) => h.def.id)).toEqual(['knight', 'cleric', 'rogue']);
      expect(state.gold()).toBe(160);
    });

    it('should hire Alden the Wizard and add him as the 4th active party member', () => {
      const state = TestBed.inject(GameStateService);
      const hired = state.hireHero('wizard');
      expect(hired).toBe(true);
      expect(state.partyHeroes().length).toBe(4);
      expect(state.gold()).toBe(10); // 160 - 150
    });

    it('should upgrade weapon tier and persist across reload', () => {
      const state = TestBed.inject(GameStateService);
      const upgraded = state.upgradeWeapon('knight');
      expect(upgraded).toBe(true);

      const knight = state.roster().find((h) => h.def.id === 'knight')!;
      expect(knight.save.weaponTier).toBe(2);

      // Verify persisted in StorageService
      const storage = TestBed.inject(StorageService);
      const reloaded = storage.loadSlot(state.activeSlot());
      expect(reloaded.heroes.knight.weaponTier).toBe(2);
    });

    it('should gate Tier 3 Mithril gear behind Stage 1 completion and unlock after clearing Stage 1', () => {
      const state = TestBed.inject(GameStateService);
      // Give plenty of gold by clearing Stage 1 or awarding rewards
      state.upgradeWeapon('knight'); // Tier 1 -> Tier 2 (Steel)
      // Tier 3 (Mithril) requires unlockStageIndex: 1
      expect(state.upgradeWeapon('knight')).toBe(false);

      // Now clear Stage 1 with plenty of gold
      state.awardBattleRewards(STAGE_CATALOG[0], 500, 100, 3);
      expect(state.highestClearedStageIndex()).toBe(1);
      expect(state.unlockedGearTier()).toBe(3);
      expect(state.upgradeWeapon('knight')).toBe(true);
      const knight = state.roster().find((h) => h.def.id === 'knight')!;
      expect(knight.save.weaponTier).toBe(3);
    });

    it('should allow equipping 2 trinkets simultaneously on a single hero', () => {
      const state = TestBed.inject(GameStateService);
      // Award enough gold and clear Stage 1 to unlock first 3 trinkets
      state.awardBattleRewards(STAGE_CATALOG[0], 800, 100, 3);

      expect(state.buyOrEquipTrinket('knight', 'amulet-vitality')).toBe(true);
      expect(state.buyOrEquipTrinket('knight', 'wind-boots')).toBe(true);

      const knight = state.roster().find((h) => h.def.id === 'knight')!;
      expect(knight.save.trinketId).toBe('amulet-vitality');
      expect(knight.save.secondTrinketId).toBe('wind-boots');
    });

    it('should export and import save profile JSON cleanly', () => {
      const state = TestBed.inject(GameStateService);
      state.hireHero('wizard');
      const exported = state.exportSave();

      state.resetCurrentSlot();
      expect(state.partyHeroes().length).toBe(3);

      const ok = state.importSave(exported);
      expect(ok).toBe(true);
      expect(state.partyHeroes().length).toBe(4);
    });
  });

  describe('CombatService Real-Time Tactical Simulation', () => {
    it('should spawn party heroes and wave 1 enemies on battle start', () => {
      const combat = TestBed.inject(CombatService);
      combat.startBattle(STAGE_CATALOG[0]);

      expect(combat.isRunning()).toBe(true);
      expect(combat.heroes().length).toBe(3);
      expect(combat.enemies().length).toBeGreaterThan(0);
      combat.stopBattle();
    });

    it('should support line-drawing commands to enemy, ally, and ground coordinates', () => {
      const combat = TestBed.inject(CombatService);
      combat.startBattle(STAGE_CATALOG[0]);

      const knight = combat.heroes().find((h) => h.classId === 'knight')!;
      const cleric = combat.heroes().find((h) => h.classId === 'cleric')!;
      const enemy = combat.enemies()[0]!;

      // 1. Drag from Knight to Enemy -> locks attack target
      combat.issueCommand(knight.uid, enemy.uid, null);
      const updatedKnight = combat.heroes().find((h) => h.uid === knight.uid)!;
      expect(updatedKnight.targetUnitUid).toBe(enemy.uid);

      // 2. Drag from Cleric to Knight -> locks heal target
      combat.issueCommand(cleric.uid, knight.uid, null);
      const updatedCleric = combat.heroes().find((h) => h.uid === cleric.uid)!;
      expect(updatedCleric.targetUnitUid).toBe(knight.uid);

      // 3. Drag from Knight to empty ground -> sets move destination
      combat.issueCommand(knight.uid, null, { x: 50, y: 65 });
      const movedKnight = combat.heroes().find((h) => h.uid === knight.uid)!;
      expect(movedKnight.moveDestination).toEqual({ x: 50, y: 65 });

      combat.stopBattle();
    });

    it('should activate hero active skills and start cooldown', () => {
      const combat = TestBed.inject(CombatService);
      combat.startBattle(STAGE_CATALOG[0]);

      const knight = combat.heroes().find((h) => h.classId === 'knight')!;
      const castOk = combat.activateHeroSkill(knight.uid, 0);
      expect(castOk).toBe(true);

      const updatedKnight = combat.heroes().find((h) => h.uid === knight.uid)!;
      expect(updatedKnight.shieldTimer).toBeGreaterThan(0);
      expect(updatedKnight.skills[0].cooldownRemaining).toBeGreaterThan(0);

      combat.stopBattle();
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
    });
  });
});
