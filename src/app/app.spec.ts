import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { STAGE_CATALOG } from './core/models/game-catalog';
import { CombatService } from './core/services/combat.service';
import { GameStateService } from './core/services/game-state.service';
import { StorageService } from './core/services/storage.service';
import { WeatherShaderService } from './core/services/weather-shader.service';
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

    it('should toggle forced 90-degree widescreen landscape mode via toggleForceLandscape()', async () => {
      const fixture = TestBed.createComponent(HomeComponent);
      await fixture.whenStable();
      const comp = fixture.componentInstance;
      const compiled = fixture.nativeElement as HTMLElement;
      const shell = compiled.querySelector('.bh-shell')!;

      expect(comp.forceLandscape()).toBe(false);
      expect(shell.classList.contains('force-landscape')).toBe(false);

      comp.toggleForceLandscape();
      fixture.detectChanges();
      expect(comp.forceLandscape()).toBe(true);
      expect(shell.classList.contains('force-landscape')).toBe(true);

      comp.toggleForceLandscape();
      fixture.detectChanges();
      expect(comp.forceLandscape()).toBe(false);
      expect(shell.classList.contains('force-landscape')).toBe(false);
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

    it('should progressively gate hero recruitment behind story campaign stages', () => {
      const state = TestBed.inject(GameStateService);
      // Give plenty of gold on Stage 0 (by resetting or checking before stage 1 is cleared)
      // At Stage 0, Monk requires Stage 2 (`unlockStageIndex: 2`)
      expect(state.hireHero('monk')).toBe(false);

      // Clear Stage 1 -> unlocks Lyra the Ranger (`unlockStageIndex: 1`), but Monk still locked
      const res1 = state.awardBattleRewards(STAGE_CATALOG[0], 500, 100, 3);
      expect(res1.unlockedHeroName).toContain('Lyra');
      expect(state.hireHero('ranger')).toBe(true);
      expect(state.hireHero('monk')).toBe(false);

      // Clear Stage 2 -> unlocks Kenji the Wind-Step Monk (`unlockStageIndex: 2`)
      const res2 = state.awardBattleRewards(STAGE_CATALOG[1], 500, 100, 3);
      expect(res2.unlockedHeroName).toContain('Kenji');
      expect(state.hireHero('monk')).toBe(true);
    });

    it('should configure Kenji the Monk as a high-evasion Dodge Tank with Mantra of Wind', () => {
      const state = TestBed.inject(GameStateService);
      const monk = state.roster().find((h) => h.def.id === 'monk')!;
      expect(monk.def.role).toBe('tank');
      expect(monk.def.tankType).toBe('dodge');
      expect(monk.dodgeChance).toBeGreaterThanOrEqual(0.3);
      expect(monk.def.primaryActiveSkill.effectType).toBe('wind-stance');
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

    it('should pull aggro onto a non-tank DPS when attacking an untanked enemy and snap aggro back when Tank taunts', () => {
      const combat = TestBed.inject(CombatService);
      combat.startBattle(STAGE_CATALOG[0]);

      const knight = combat.heroes().find((h) => h.classId === 'knight')!;
      const rogue = combat.heroes().find((h) => h.classId === 'rogue')!;
      const enemy = combat.enemies()[0]!;

      // Move Rogue into melee with Enemy 1 and step simulation so Rogue strikes untanked enemy
      combat.issueCommand(rogue.uid, enemy.uid, null);
      // Place Rogue right next to enemy to trigger attack on next step
      combat.units.update((list) =>
        list.map((u) =>
          u.uid === rogue.uid ? { ...u, x: enemy.x - 4, y: enemy.y, attackTimer: 0 } : u,
        ),
      );
      combat.step(0.05);

      const aggroedEnemy = combat.enemies().find((e) => e.uid === enemy.uid)!;
      expect(aggroedEnemy.targetUnitUid).toBe(rogue.uid);
      expect(combat.squishyTargetedUids().has(rogue.uid)).toBe(true);

      // Now drag Tank (Knight) onto the enemy to intercept & taunt!
      combat.issueCommand(knight.uid, enemy.uid, null);
      const tauntedEnemy = combat.enemies().find((e) => e.uid === enemy.uid)!;
      expect(tauntedEnemy.targetUnitUid).toBe(knight.uid);
      expect(tauntedEnemy.tankHoldTimer).toBeGreaterThan(0);
      expect(combat.squishyTargetedUids().has(rogue.uid)).toBe(false);

      combat.stopBattle();
    });

    it('should allow Monk Dodge Tank to activate Wind Stance, taunt nearby enemies, and boost evasion', () => {
      const state = TestBed.inject(GameStateService);
      state.awardBattleRewards(STAGE_CATALOG[0], 500, 100, 3);
      state.awardBattleRewards(STAGE_CATALOG[1], 500, 100, 3);
      expect(state.hireHero('monk')).toBe(true);

      const combat = TestBed.inject(CombatService);
      combat.startBattle(STAGE_CATALOG[0]);

      const monk = combat.heroes().find((h) => h.classId === 'monk')!;
      const enemy = combat.enemies()[0]!;
      // Place Monk near enemy and activate Mantra of Wind (`wind-stance`)
      combat.units.update((list) =>
        list.map((u) => (u.uid === monk.uid ? { ...u, x: enemy.x - 5, y: enemy.y } : u)),
      );
      expect(combat.activateHeroSkill(monk.uid, 0)).toBe(true);

      const updatedMonk = combat.heroes().find((h) => h.uid === monk.uid)!;
      const updatedEnemy = combat.enemies().find((e) => e.uid === enemy.uid)!;
      expect(updatedMonk.evasionTimer).toBeGreaterThan(0);
      expect(updatedEnemy.targetUnitUid).toBe(monk.uid);
      expect(updatedEnemy.tankHoldTimer).toBeGreaterThan(0);

      combat.stopBattle();
    });

    it('should place Monk in front-line Tank slot and have Healer auto-target Monk when Knight is swapped out', () => {
      const state = TestBed.inject(GameStateService);
      state.awardBattleRewards(STAGE_CATALOG[0], 500, 100, 3);
      state.awardBattleRewards(STAGE_CATALOG[1], 500, 100, 3);
      expect(state.hireHero('monk')).toBe(true);
      // Swap out Knight so Monk is the sole Tank in the party
      expect(state.toggleHeroInParty('knight')).toBe(true);

      const combat = TestBed.inject(CombatService);
      combat.startBattle(STAGE_CATALOG[0]);

      const monk = combat.heroes().find((h) => h.classId === 'monk')!;
      const cleric = combat.heroes().find((h) => h.classId === 'cleric')!;
      expect(cleric.targetUnitUid).toBe(monk.uid);
      expect(combat.healerBeams()[0]?.x2).toBe(monk.x);

      combat.stopBattle();
    });

    it('should never counter-punch ranged archers or projectiles when Monk dodges, only melee attackers in range', () => {
      const state = TestBed.inject(GameStateService);
      state.awardBattleRewards(STAGE_CATALOG[0], 500, 100, 3);
      state.awardBattleRewards(STAGE_CATALOG[1], 500, 100, 3);
      expect(state.hireHero('monk')).toBe(true);

      const combat = TestBed.inject(CombatService);
      combat.startBattle(STAGE_CATALOG[1]); // Stage 2 has Goblin Sniper ('goblin-archer')
      for (let i = 0; i < 10; i++) {
        combat.step(0.1); // Advance 1.0s (clamped to 0.1s per step) to spawn delayed archer
      }

      const monk = combat.heroes().find((h) => h.classId === 'monk')!;
      const archer = combat.enemies().find((e) => e.enemyId === 'goblin-archer')!;
      expect(archer).toBeTruthy();
      const initialArcherHp = archer.hp;

      // Give Monk max dodge and spawn an incoming arrow projectile from the archer
      combat.units.update((list) =>
        list.map((u) =>
          u.uid === monk.uid
            ? { ...u, dodgeChance: 1.0, evasionTimer: 6, counterOnDodge: true }
            : u,
        ),
      );
      combat.projectiles.set([
        {
          id: 'proj-test-arrow',
          sourceUid: archer.uid,
          fromHero: false,
          x: monk.x + 0.5,
          y: monk.y,
          targetUid: monk.uid,
          targetX: monk.x,
          targetY: monk.y,
          speed: 34,
          color: '#ef4444',
          size: 7,
          isHeal: false,
          value: 20,
        },
      ]);

      combat.step(0.05);
      const archerAfterArrow = combat.enemies().find((e) => e.uid === archer.uid)!;
      expect(archerAfterArrow.hp).toBe(initialArcherHp);

      combat.stopBattle();
    });

    it('should generate and claim openable War Chest loot applying gold multiplier without gear skipping', () => {
      const state = TestBed.inject(GameStateService);
      const res = state.awardBattleRewards(STAGE_CATALOG[0], 115, 95, 3);
      expect(res.warChest).toBeTruthy();
      expect(res.warChest?.opened).toBe(false);
      expect(res.warChest?.multiplier).toBeGreaterThanOrEqual(1.25);
      expect(res.warChest?.bonusGold).toBeGreaterThan(0);

      const preClaimGold = state.gold();
      const claimed = state.claimWarChestLoot(res.warChest!);
      expect(claimed.opened).toBe(true);
      expect(state.gold()).toBe(preClaimGold + claimed.bonusGold);

      // Verify gear was not skipped for free
      const knight = state.roster().find((h) => h.def.id === 'knight')!;
      expect(knight.save.weaponTier).toBe(1);
    });

    it('should gate Doomvale Champions Crest behind 15+ Endless Colosseum kills even after Stage 6 is cleared', () => {
      const state = TestBed.inject(GameStateService);
      // Clear Stage 6 with plenty of gold, but 0 Arena kills
      state.awardBattleRewards(STAGE_CATALOG[5], 5000, 500, 3, 0);
      expect(state.buyOrEquipTrinket('knight', 'bis-arena-warcrest')).toBe(false);

      // Now achieve 15 kills in Stage 10 (Endless Colosseum)
      const arenaStage = STAGE_CATALOG.find((s) => s.isArena)!;
      state.awardBattleRewards(arenaStage, 270, 210, 3, 15);
      expect(state.arenaBestKills()).toBe(15);
      expect(state.buyOrEquipTrinket('knight', 'bis-arena-warcrest')).toBe(true);
    });

    it('should preserve rewards and show cash-out summary when retreating from Endless Arena with kills', () => {
      const state = TestBed.inject(GameStateService);
      const combat = TestBed.inject(CombatService);
      const arenaStage = STAGE_CATALOG.find((s) => s.isArena)!;
      const startGold = state.gold();

      combat.startBattle(arenaStage);
      combat.arenaKills.set(16);
      combat.retreatOrCashOut();

      expect(combat.outcome()).toBe('victory');
      expect(combat.lastRewardSummary()?.gold).toBe(16 * 20);
      expect(state.gold()).toBeGreaterThan(startGold);
      expect(state.arenaBestKills()).toBe(16);
      combat.stopBattle();
    });

    it('should allow Lady Valeria (Paladin) to draw aggro with Holy Radiance (consecration) and Hammer of Justice (Smite)', () => {
      const state = TestBed.inject(GameStateService);
      const combat = TestBed.inject(CombatService);

      // Unlock and hire Paladin
      state.awardBattleRewards(STAGE_CATALOG[3], 2000, 500, 3);
      state.hireHero('paladin');

      combat.startBattle(STAGE_CATALOG[0]);
      const paladin = combat.heroes().find((h) => h.classId === 'paladin')!;
      expect(paladin).toBeTruthy();

      const enemy = combat.enemies()[0];
      expect(enemy).toBeTruthy();

      // Fire Holy Radiance (skill 0)
      const initialThreat = paladin.threat;
      combat.activateHeroSkill(paladin.uid, 0);

      const paladinAfter = combat.heroes().find((h) => h.uid === paladin.uid)!;
      expect(paladinAfter.threat).toBeGreaterThan(initialThreat);
      const enemyAfter = combat.enemies().find((e) => e.uid === enemy.uid)!;
      expect(enemyAfter.targetUnitUid).toBe(paladin.uid);

      combat.stopBattle();
    });

    it('should automatically cast ready hero skills off cooldown when Auto-Cast Mode is enabled', () => {
      const combat = TestBed.inject(CombatService);
      combat.startBattle(STAGE_CATALOG[0]);
      combat.toggleAutoCastSkills();
      expect(combat.autoCastSkills()).toBe(true);

      combat.step(0.05);
      const knight = combat.heroes().find((h) => h.classId === 'knight')!;
      expect(knight.shieldTimer).toBeGreaterThan(0);
      expect(knight.skills[0].cooldownRemaining).toBeGreaterThan(0);

      combat.stopBattle();
    });

    it('should map stages to environmental shader themes and handle screenshake', () => {
      const combat = TestBed.inject(CombatService);

      combat.startBattle(STAGE_CATALOG[0]); // Stage 1 (Verdant Outskirts)
      expect(combat.currentStageWeather()).toBe('sunlight');

      const spiderStage = STAGE_CATALOG.find((s) => s.id === 'stage-3')!;
      combat.startBattle(spiderStage);
      expect(combat.currentStageWeather()).toBe('rain');

      const slimeStage = STAGE_CATALOG.find((s) => s.id === 'stage-4')!;
      combat.startBattle(slimeStage);
      expect(combat.currentStageWeather()).toBe('toxic-spores');

      const mountainStage = STAGE_CATALOG.find((s) => s.id === 'stage-6')!;
      combat.startBattle(mountainStage);
      expect(combat.currentStageWeather()).toBe('blizzard');

      const cryptStage = STAGE_CATALOG.find((s) => s.id === 'stage-7')!;
      combat.startBattle(cryptStage);
      expect(combat.currentStageWeather()).toBe('crypt-mist');

      const dragonStage = STAGE_CATALOG.find((s) => s.id === 'stage-9')!;
      combat.startBattle(dragonStage);
      expect(combat.currentStageWeather()).toBe('volcano-fire');

      const arenaStage = STAGE_CATALOG.find((s) => s.isArena)!;
      combat.startBattle(arenaStage);
      expect(combat.currentStageWeather()).toBe('colosseum-glory');

      // Screenshake test
      expect(combat.screenShake()).toBe(0);
      combat.triggerScreenShake(1.5);
      expect(combat.screenShake()).toBe(1.5);
      combat.step(0.1);
      expect(combat.screenShake()).toBeLessThan(1.5);

      combat.stopBattle();
    });

    it('should sanitize and strip unearned Champion Crest from save profile if arenaBestKills < 15', () => {
      const storage = TestBed.inject(StorageService);
      const rawCorruptedProfile = {
        version: 1,
        gold: 1000,
        completedStageIds: ['stage-1', 'stage-6'],
        stageStars: { 'stage-1': 3, 'stage-6': 3 },
        arenaBestKills: 8, // Less than the required 15!
        ownedTrinkets: ['trinket-wolf-tooth', 'bis-arena-warcrest'],
        heroes: {
          knight: {
            unlocked: true,
            inParty: true,
            level: 5,
            xp: 0,
            weaponTier: 2,
            armorTier: 2,
            trinketId: 'bis-arena-warcrest',
            secondTrinketId: null,
          },
        },
      };

      const normalized = storage.sanitizeProfile(rawCorruptedProfile as never);
      expect(normalized.ownedTrinkets).not.toContain('bis-arena-warcrest');
      expect(normalized.ownedTrinkets).toContain('trinket-wolf-tooth');
      expect(normalized.heroes.knight.trinketId).toBeNull();
    });

    it('should attach WeatherShaderService to canvas, set themes, and detach cleanly', () => {
      const weather = TestBed.inject(WeatherShaderService);
      const canvas = document.createElement('canvas');
      weather.attach(canvas);
      weather.setTheme('volcano-fire');
      expect(weather.activeTheme()).toBe('volcano-fire');
      weather.triggerLightning();
      weather.detach();
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
