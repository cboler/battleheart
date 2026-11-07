import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { ENEMY_CATALOG } from '../models/game-catalog';
import {
  ArenaHazardZone,
  ArenaRingEffect,
  ArenaTelegraphEffect,
  CombatUnit,
  EnemyId,
  FloatingText,
  Projectile,
  StageDefinition,
} from '../models/game.model';
import { AudioService } from './audio.service';
import { GameStateService } from './game-state.service';

export type BattleOutcome = 'ongoing' | 'victory' | 'defeat';

@Injectable({ providedIn: 'root' })
export class CombatService implements OnDestroy {
  private readonly gameState = inject(GameStateService);
  private readonly audio = inject(AudioService);

  public readonly activeStage = signal<StageDefinition | null>(null);
  public readonly isRunning = signal(false);
  public readonly isPaused = signal(false);
  public readonly outcome = signal<BattleOutcome>('ongoing');

  public readonly waveIndex = signal(0);
  public readonly totalWaves = signal(1);
  public readonly arenaKills = signal(0);

  public readonly units = signal<CombatUnit[]>([]);
  public readonly projectiles = signal<Projectile[]>([]);
  public readonly floatingTexts = signal<FloatingText[]>([]);
  public readonly ringEffects = signal<ArenaRingEffect[]>([]);
  public readonly telegraphs = signal<ArenaTelegraphEffect[]>([]);
  public readonly hazardZones = signal<ArenaHazardZone[]>([]);

  public readonly selectedHeroUid = signal<string | null>(null);

  // Rewards summary upon completion
  public readonly lastRewardSummary = signal<{
    gold: number;
    xp: number;
    stars: number;
    leveledUpHeroes: string[];
    bonusLootName: string;
    droppedRelicName: string | null;
    unlockedHeroName: string | null;
  } | null>(null);

  public readonly heroes = computed(() => this.units().filter((u) => u.isHero));
  public readonly enemies = computed(() => this.units().filter((u) => !u.isHero));
  public readonly selectedHero = computed(
    () => this.units().find((u) => u.uid === this.selectedHeroUid()) ?? null,
  );
  public readonly healerBeams = computed(() => {
    const all = this.units();
    const allies = all.filter((u) => u.isHero && u.hp > 0);
    const beams: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const h of allies) {
      if (h.role !== 'healer' || h.stunTimer > 0) continue;
      let target = allies.find((a) => a.uid === h.targetUnitUid);
      if (!target) {
        const injured = [...allies]
          .filter((a) => a.hp < a.maxHp)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        target = injured[0];
      }
      if (target) {
        beams.push({
          id: `beam-${h.uid}`,
          x1: h.x,
          y1: h.y - 4,
          x2: target.x,
          y2: target.y - 4,
        });
      }
    }
    return beams;
  });

  /**
   * Visual danger lines from enemies to any NON-TANK hero they are currently hunting!
   * Immediately alerts the player: "Use your tank to intercept/taunt or your squishy dies!"
   */
  public readonly enemyAggroLines = computed(() => {
    const all = this.units();
    const heroes = all.filter((u) => u.isHero && u.hp > 0);
    const enemies = all.filter((u) => !u.isHero && u.hp > 0);
    const lines: { id: string; x1: number; y1: number; x2: number; y2: number; heroUid: string }[] =
      [];
    for (const en of enemies) {
      const target = heroes.find((h) => h.uid === en.targetUnitUid);
      if (target && target.role !== 'tank') {
        lines.push({
          id: `aggro-${en.uid}`,
          x1: en.x,
          y1: en.y - 2,
          x2: target.x,
          y2: target.y - 2,
          heroUid: target.uid,
        });
      }
    }
    return lines;
  });

  public readonly squishyTargetedUids = computed(
    () => new Set(this.enemyAggroLines().map((l) => l.heroUid)),
  );

  private rafId: number | null = null;
  private lastFrameTime = 0;
  private uidCounter = 1;
  private pendingSpawns: { enemyId: EnemyId; spawnAtElapsed: number }[] = [];
  private waveElapsedSec = 0;

  public startBattle(stage: StageDefinition): void {
    this.stopLoop();
    this.activeStage.set(stage);
    this.outcome.set('ongoing');
    this.isPaused.set(false);
    this.waveIndex.set(0);
    this.totalWaves.set(stage.isArena ? 99 : stage.waves.length);
    this.arenaKills.set(0);
    this.projectiles.set([]);
    this.floatingTexts.set([]);
    this.ringEffects.set([]);
    this.telegraphs.set([]);
    this.hazardZones.set([]);
    this.lastRewardSummary.set(null);

    // Spawn Party Heroes on left side of arena
    const party = this.gameState.partyHeroes();
    const startPositions = [
      { x: 26, y: 58 }, // Front-top (Tank)
      { x: 14, y: 50 }, // Back-top (Healer)
      { x: 24, y: 74 }, // Front-bottom (Melee DPS)
      { x: 14, y: 72 }, // Back-bottom (Ranged/Support)
    ];

    const heroUnits: CombatUnit[] = party.map((h, i) => {
      const pos = startPositions[i] ?? { x: 20, y: 60 };
      const passiveIds = new Set<string>();
      if (h.save.level >= 2) {
        passiveIds.add(
          h.save.skillChoices.tier1 === 'A'
            ? h.def.skillTiers[0].optionA.id
            : h.def.skillTiers[0].optionB.id,
        );
      }
      if (h.save.level >= 4) {
        passiveIds.add(
          h.save.skillChoices.tier2 === 'A'
            ? h.def.skillTiers[1].optionA.id
            : h.def.skillTiers[1].optionB.id,
        );
      }
      if (h.save.level >= 6) {
        passiveIds.add(
          h.save.skillChoices.tier3 === 'A'
            ? h.def.skillTiers[2].optionA.id
            : h.def.skillTiers[2].optionB.id,
        );
      }

      return {
        uid: `hero-${h.def.id}`,
        isHero: true,
        classId: h.def.id,
        name: h.def.name,
        svgAsset: h.def.svgAsset,
        accentColor: h.def.accentColor,
        role: h.def.role,
        isBoss: false,
        scale: 1,
        x: pos.x,
        y: pos.y,
        facing: 'right',
        targetUnitUid: h.def.role === 'healer' && party[0] ? `hero-${party[0].def.id}` : null,
        moveDestination: null,
        maxHp: h.maxHp,
        hp: h.maxHp,
        attack: h.attack,
        defense: h.defense,
        attackRange: h.def.attackRange,
        attackIntervalSec: h.attackIntervalSec,
        attackTimer: 0.4,
        moveSpeed: h.moveSpeed,
        critChance: h.critChance,
        dodgeChance: h.dodgeChance,
        counterOnDodge: h.counterOnDodge,
        lifesteal: h.lifesteal,
        threat: 0,
        threatMultiplier: h.def.threatMultiplier,
        skills: h.activeSkills.map((sk) => ({
          def: sk,
          cooldownRemaining: 0,
          maxCooldown: Number(((sk.cooldownSec ?? 10) * h.cooldownMultiplier).toFixed(1)),
        })),
        specialTimer: 0,
        specialIntervalSec: 0,
        shieldTimer: 0,
        evasionTimer: 0,
        weakenTimer: 0,
        invulnerableTimer: 0,
        stunTimer: 0,
        slowTimer: 0,
        hasteTimer: 0,
        attackBuffTimer: 0,
        poisonTimer: 0,
        poisonDps: passiveIds.has('venom-coating') || passiveIds.has('venom-tips') ? 1 : 0,
        regenTimer: 9999,
        regenHps: Math.round(h.maxHp * h.regenPctPerSec),
        attackAnimTimer: 0,
        hurtAnimTimer: 0,
      };
    });

    this.units.set(heroUnits);
    this.selectedHeroUid.set(heroUnits[0]?.uid ?? null);
    this.queueWave(0);
    this.isRunning.set(true);

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.lastFrameTime = performance.now();
      this.rafId = window.requestAnimationFrame(this.loop);
    }
  }

  public stopBattle(): void {
    this.stopLoop();
    this.isRunning.set(false);
    this.activeStage.set(null);
  }

  public togglePause(): void {
    this.isPaused.set(!this.isPaused());
    this.audio.playSelect();
  }

  public selectHero(uid: string): void {
    const unit = this.units().find((u) => u.uid === uid && u.isHero && u.hp > 0);
    if (unit) {
      this.selectedHeroUid.set(uid);
      this.audio.playSelect();
    }
  }

  public cycleSelectedHero(delta: 1 | -1): void {
    const livingHeroes = this.units().filter((u) => u.isHero && u.hp > 0);
    if (livingHeroes.length === 0) return;
    const currentIdx = livingHeroes.findIndex((h) => h.uid === this.selectedHeroUid());
    const nextIdx =
      currentIdx === -1 ? 0 : (currentIdx + delta + livingHeroes.length) % livingHeroes.length;
    this.selectedHeroUid.set(livingHeroes[nextIdx].uid);
    this.audio.playSelect();
  }

  /**
   * Core Battleheart Line-Drawing Command:
   * - Dragging from a Hero to an Enemy locks the Hero onto that Enemy (or moves & attacks).
   * - Dragging from a Cleric/Healer to an Ally locks the Healer onto healing that Ally.
   * - Dragging from a Hero to empty ground orders the Hero to walk to that spot.
   */
  public issueCommand(
    heroUid: string,
    targetUnitUid: string | null,
    groundPoint: { x: number; y: number } | null,
  ): void {
    const all = [...this.units()];
    const heroIdx = all.findIndex((u) => u.uid === heroUid && u.isHero && u.hp > 0);
    if (heroIdx === -1) return;

    const hero = { ...all[heroIdx] };

    if (targetUnitUid && targetUnitUid !== heroUid) {
      const target = all.find((u) => u.uid === targetUnitUid && u.hp > 0);
      if (target) {
        if (target.isHero) {
          // Dropped on an Ally: Healers lock heal target; non-healers walk near the ally
          if (hero.role === 'healer') {
            hero.targetUnitUid = target.uid;
            hero.moveDestination = null;
          } else {
            hero.moveDestination = {
              x: this.clampX(target.x + 5),
              y: this.clampY(target.y + 3),
            };
          }
        } else {
          // Dropped on an Enemy: Focus attack on this enemy!
          // If the hero is a Tank, dragging them onto an enemy also taunts/intercepts that enemy!
          hero.targetUnitUid = target.uid;
          hero.moveDestination = null;
          if (hero.role === 'tank') {
            hero.threat += 110;
            const targetIdx = all.findIndex((u) => u.uid === target.uid);
            if (targetIdx !== -1) {
              all[targetIdx] = {
                ...all[targetIdx],
                targetUnitUid: hero.uid,
                tankHoldTimer: 5.5,
                aggroResetTimer: 6.5,
              };
            }
            this.addText(hero.x, hero.y - 8, '🛡️ TAUNT!', '#38bdf8', false);
          }
        }
        all[heroIdx] = hero;
        this.units.set(all);
        this.selectedHeroUid.set(heroUid);
        this.audio.playCommandLock();
        return;
      }
    }

    if (groundPoint) {
      hero.moveDestination = {
        x: this.clampX(groundPoint.x),
        y: this.clampY(groundPoint.y),
      };
      // Ranged and healers clear sticky target when repositioned so they can kite cleanly
      all[heroIdx] = hero;
      this.units.set(all);
      this.selectedHeroUid.set(heroUid);
      this.audio.playCommandLock();
    }
  }

  public activateHeroSkill(heroUid: string, skillIndex: number): boolean {
    if (this.outcome() !== 'ongoing' || this.isPaused()) return false;
    const all = [...this.units()];
    const heroIdx = all.findIndex((u) => u.uid === heroUid && u.isHero && u.hp > 0);
    if (heroIdx === -1) return false;

    const hero = { ...all[heroIdx], skills: all[heroIdx].skills.map((s) => ({ ...s })) };
    const slot = hero.skills[skillIndex];
    if (!slot || slot.cooldownRemaining > 0) return false;

    slot.cooldownRemaining = slot.maxCooldown;
    hero.attackAnimTimer = 0.35;
    all[heroIdx] = hero;

    const livingAllies = all.filter((u) => u.isHero && u.hp > 0);
    const livingEnemies = all.filter((u) => !u.isHero && u.hp > 0);

    switch (slot.def.effectType) {
      case 'shield-wall': {
        hero.shieldTimer = 6;
        hero.threat += 250;
        for (const en of livingEnemies) {
          if (this.dist(hero, en) <= 38) {
            en.targetUnitUid = hero.uid;
            en.tankHoldTimer = 6.5;
            en.aggroResetTimer = 7.0;
          }
        }
        this.addRing(hero.x, hero.y, 18, '#38bdf8');
        this.addText(hero.x, hero.y - 8, 'SHIELD WALL!', '#38bdf8', true);
        this.audio.playSkillCast();
        break;
      }
      case 'wind-stance': {
        hero.evasionTimer = 6;
        hero.threat += 260;
        for (const en of livingEnemies) {
          if (this.dist(hero, en) <= 40) {
            en.targetUnitUid = hero.uid;
            en.tankHoldTimer = 6.5;
            en.aggroResetTimer = 7.0;
          }
        }
        this.addRing(hero.x, hero.y, 20, '#fb923c');
        this.addText(hero.x, hero.y - 8, '💨 WIND STANCE!', '#38bdf8', true);
        this.audio.playSkillCast();
        break;
      }
      case 'war-cry': {
        if (hero.role === 'tank') {
          hero.threat += 320;
          for (const en of livingEnemies) {
            en.targetUnitUid = hero.uid;
            en.tankHoldTimer = 6.5;
            en.aggroResetTimer = 7.0;
          }
        }
        for (const al of livingAllies) {
          al.attackBuffTimer = 6;
        }
        this.addRing(hero.x, hero.y, 35, '#fbbf24');
        this.addText(hero.x, hero.y - 8, 'WAR CRY!', '#fbbf24', true);
        this.audio.playSkillCast();
        break;
      }
      case 'cleave':
      case 'blade-flurry':
      case 'rampage': {
        const mult =
          slot.def.effectType === 'cleave' ? 2.2 : slot.def.effectType === 'rampage' ? 2.7 : 2.6;
        let totalDealt = 0;
        let hitAny = false;
        for (const en of livingEnemies) {
          if (this.dist(hero, en) <= 24) {
            const raw = Math.round(hero.attack * mult);
            this.applyDamage(hero, en, raw, true);
            totalDealt += raw;
            if (hero.role === 'tank') {
              en.targetUnitUid = hero.uid;
              en.tankHoldTimer = 4.5;
            }
            hitAny = true;
          }
        }
        if (!hitAny && livingEnemies[0]) {
          const raw = Math.round(hero.attack * mult);
          this.applyDamage(hero, livingEnemies[0], raw, true);
          totalDealt += raw;
          if (hero.role === 'tank') {
            livingEnemies[0].targetUnitUid = hero.uid;
            livingEnemies[0].tankHoldTimer = 4.5;
          }
        }
        if (slot.def.effectType === 'rampage' && totalDealt > 0) {
          this.applyHeal(hero, Math.round(totalDealt * 0.25), false);
          this.addText(hero.x, hero.y - 8, '🪓 RAMPAGE!', '#ef4444', true);
        }
        this.addRing(hero.x, hero.y, 22, hero.accentColor);
        this.audio.playSlash();
        break;
      }
      case 'undying-rage': {
        hero.invulnerableTimer = 4.5;
        hero.hasteTimer = 6;
        hero.attackBuffTimer = 6;
        this.addRing(hero.x, hero.y, 20, '#ef4444');
        this.addText(hero.x, hero.y - 9, '🔥 UNDYING FRENZY!', '#ef4444', true);
        this.audio.playSkillCast();
        break;
      }
      case 'soul-drain': {
        const target =
          livingEnemies.find((e) => e.uid === hero.targetUnitUid) ??
          [...livingEnemies].sort((a, b) => b.attack - a.attack)[0];
        if (target) {
          const dmg = Math.round(hero.attack * 2.8);
          this.applyDamage(hero, target, dmg, true);
          target.weakenTimer = 6;
          this.addRing(target.x, target.y, 16, '#a855f7');
          this.addText(target.x, target.y - 9, '🟣 WEAKENED (-35% DMG)!', '#c084fc', true);
          const mend = Math.round(hero.attack * 1.45);
          this.applyHeal(hero, mend, false);
          const lowestAlly = [...livingAllies].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          if (lowestAlly && lowestAlly.uid !== hero.uid) {
            this.applyHeal(lowestAlly, mend, false);
          }
        }
        this.audio.playSkillCast();
        break;
      }
      case 'hex-curse': {
        for (const en of livingEnemies) {
          this.applyDamage(hero, en, Math.round(hero.attack * 1.6), false);
          en.weakenTimer = 6;
          en.slowTimer = 6;
          this.addRing(en.x, en.y, 14, '#a855f7');
        }
        this.addText(hero.x, hero.y - 8, '🟣 COVENANT HEX (-35% DMG)!', '#c084fc', true);
        this.audio.playSkillCast();
        break;
      }
      case 'group-heal': {
        const healAmt = Math.round(hero.attack * 3.0);
        for (const al of livingAllies) {
          this.applyHeal(al, healAmt, true);
          this.addRing(al.x, al.y, 12, '#34d399');
        }
        this.audio.playHeal();
        break;
      }
      case 'divine-shield': {
        const target =
          livingAllies.find((a) => a.uid === hero.targetUnitUid) ??
          [...livingAllies].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (target) {
          target.shieldTimer = 6;
          this.applyHeal(target, Math.round(hero.attack * 1.8), true);
          this.addRing(target.x, target.y, 15, '#fde047');
          this.addText(target.x, target.y - 8, 'BARRIER!', '#fde047', true);
        }
        this.audio.playHeal();
        break;
      }
      case 'holy-nova':
      case 'consecration':
      case 'chi-burst': {
        const dmg = Math.round(hero.attack * 2.0);
        const heal = Math.round(hero.attack * 1.7);
        for (const en of livingEnemies) {
          this.applyDamage(hero, en, dmg, true);
          if (hero.role === 'tank' && this.dist(hero, en) <= 32) {
            en.targetUnitUid = hero.uid;
            en.tankHoldTimer = 5.5;
            en.aggroResetTimer = 6.5;
          }
        }
        for (const al of livingAllies) {
          this.applyHeal(al, heal, false);
        }
        this.addRing(hero.x, hero.y, 32, '#fde047');
        this.audio.playSkillCast();
        break;
      }
      case 'sneak-attack':
      case 'flying-kick': {
        const target =
          livingEnemies.find((e) => e.uid === hero.targetUnitUid) ??
          [...livingEnemies].sort((a, b) => a.hp - b.hp)[0];
        if (target) {
          hero.x = this.clampX(target.x - 6);
          hero.y = this.clampY(target.y);
          hero.moveDestination = null;
          hero.targetUnitUid = target.uid;
          this.applyDamage(hero, target, Math.round(hero.attack * 3.3), true);
          if (slot.def.effectType === 'flying-kick') {
            target.stunTimer = Math.max(target.stunTimer, 2.5);
            if (hero.role === 'tank') {
              for (const en of livingEnemies) {
                if (this.dist(hero, en) <= 28) {
                  en.targetUnitUid = hero.uid;
                  en.tankHoldTimer = 5.5;
                  en.aggroResetTimer = 6.5;
                }
              }
            }
          } else {
            target.poisonTimer = 5;
            target.poisonDps = Math.round(hero.attack * 0.4);
          }
          this.addRing(target.x, target.y, 16, hero.accentColor);
        }
        this.audio.playSlash();
        break;
      }
      case 'smoke-bomb': {
        hero.threat = 0;
        for (const en of livingEnemies) {
          if (en.targetUnitUid === hero.uid) {
            en.targetUnitUid = null;
            en.lastAttackerUid = null;
          }
          if (this.dist(hero, en) <= 28) {
            en.stunTimer = 3.5;
            this.addText(en.x, en.y - 6, 'STUNNED', '#cbd5e1', false);
          }
        }
        this.addRing(hero.x, hero.y, 26, '#94a3b8');
        this.audio.playSkillCast();
        break;
      }
      case 'fireball': {
        const target = livingEnemies.find((e) => e.uid === hero.targetUnitUid) ?? livingEnemies[0];
        if (target) {
          for (const en of livingEnemies) {
            if (this.dist(target, en) <= 24) {
              this.applyDamage(hero, en, Math.round(hero.attack * 2.8), true);
            }
          }
          this.addRing(target.x, target.y, 24, '#f97316');
        }
        this.audio.playFireball();
        break;
      }
      case 'blizzard':
      case 'lullaby': {
        for (const en of livingEnemies) {
          this.applyDamage(hero, en, Math.round(hero.attack * 1.85), false);
          en.slowTimer = 5;
          en.stunTimer = 2.2;
          this.addRing(en.x, en.y, 14, '#38bdf8');
        }
        this.audio.playSkillCast();
        break;
      }
      case 'chain-lightning':
      case 'multishot': {
        for (const en of livingEnemies.slice(0, 5)) {
          this.applyDamage(hero, en, Math.round(hero.attack * 2.25), true);
          this.addRing(en.x, en.y, 12, '#fde047');
        }
        this.audio.playArrow();
        break;
      }
      case 'lay-on-hands': {
        const lowest = [...livingAllies].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (lowest) {
          this.applyHeal(lowest, Math.round(lowest.maxHp * 0.55), true);
          lowest.shieldTimer = 4;
          this.addRing(lowest.x, lowest.y, 16, '#fde047');
        }
        this.audio.playHeal();
        break;
      }
      case 'Smite':
      case 'palm-strike': {
        const target = livingEnemies.find((e) => e.uid === hero.targetUnitUid) ?? livingEnemies[0];
        if (target) {
          this.applyDamage(hero, target, Math.round(hero.attack * 3.0), true);
          target.stunTimer = 3.5;
          this.addText(target.x, target.y - 7, 'STUNNED!', '#fde047', true);
          this.addRing(target.x, target.y, 16, '#fde047');
        }
        this.audio.playFireball();
        break;
      }
      case 'song-of-vigor':
      case 'song-of-war': {
        for (const al of livingAllies) {
          this.applyHeal(al, Math.round(hero.attack * 1.6), false);
          al.hasteTimer = 6.5;
          al.attackBuffTimer = 6.5;
          this.addRing(al.x, al.y, 14, '#10b981');
        }
        this.addText(hero.x, hero.y - 8, 'ANTHEM!', '#10b981', true);
        this.audio.playHeal();
        break;
      }
      case 'snipe':
      case 'frost-arrow': {
        const target = livingEnemies.find((e) => e.uid === hero.targetUnitUid) ?? livingEnemies[0];
        if (target) {
          this.applyDamage(hero, target, Math.round(hero.attack * 3.4), true);
          if (slot.def.effectType === 'frost-arrow') {
            target.slowTimer = 5;
            target.stunTimer = 1.8;
          }
          this.addRing(target.x, target.y, 14, '#22c55e');
        }
        this.audio.playArrow();
        break;
      }
    }

    this.units.set(all.filter((u) => u.hp > 0));
    this.checkWaveOrBattleCompletion();
    return true;
  }

  /**
   * Steps simulation by `dt` seconds (can be called directly in unit tests or via RAF).
   */
  public step(dt: number): void {
    if (!this.isRunning() || this.isPaused() || this.outcome() !== 'ongoing') return;

    const clampedDt = Math.min(0.1, Math.max(0.001, dt));
    this.waveElapsedSec += clampedDt;

    // 1. Check pending wave spawns
    if (this.pendingSpawns.length > 0) {
      const ready = this.pendingSpawns.filter((s) => s.spawnAtElapsed <= this.waveElapsedSec);
      this.pendingSpawns = this.pendingSpawns.filter((s) => s.spawnAtElapsed > this.waveElapsedSec);
      if (ready.length > 0) {
        const spawned = ready.map((r, idx) => this.createEnemyUnit(r.enemyId, idx));
        this.units.set([...this.units(), ...spawned]);
      }
    }

    const allUnits = this.units().map((u) => ({
      ...u,
      skills: u.skills.map((s) => ({ ...s })),
    }));

    // 2. Update each unit
    for (const unit of allUnits) {
      if (unit.hp <= 0) continue;

      // Cooldowns & timers
      for (const sk of unit.skills) {
        if (sk.cooldownRemaining > 0) {
          sk.cooldownRemaining = Math.max(0, sk.cooldownRemaining - clampedDt);
        }
      }
      unit.shieldTimer = Math.max(0, unit.shieldTimer - clampedDt);
      unit.evasionTimer = Math.max(0, unit.evasionTimer - clampedDt);
      unit.weakenTimer = Math.max(0, unit.weakenTimer - clampedDt);
      unit.invulnerableTimer = Math.max(0, unit.invulnerableTimer - clampedDt);
      unit.stunTimer = Math.max(0, unit.stunTimer - clampedDt);
      unit.slowTimer = Math.max(0, unit.slowTimer - clampedDt);
      unit.hasteTimer = Math.max(0, unit.hasteTimer - clampedDt);
      unit.attackBuffTimer = Math.max(0, unit.attackBuffTimer - clampedDt);
      unit.attackAnimTimer = Math.max(0, unit.attackAnimTimer - clampedDt);
      unit.hurtAnimTimer = Math.max(0, unit.hurtAnimTimer - clampedDt);
      unit.isMoving = false;

      // Poison DoT
      if (unit.poisonTimer > 0) {
        const prevFloor = Math.floor(unit.poisonTimer);
        unit.poisonTimer = Math.max(0, unit.poisonTimer - clampedDt);
        if (Math.floor(unit.poisonTimer) < prevFloor && unit.poisonDps > 0) {
          unit.hp = Math.max(0, unit.hp - unit.poisonDps);
          this.addText(unit.x, unit.y - 5, `-${unit.poisonDps}`, '#4ade80', false);
        }
      }

      // Passive Regeneration (Heroes & Regenerating Slimes)
      if (unit.regenHps > 0 && unit.hp > 0 && unit.hp < unit.maxHp) {
        const prevFloor = Math.floor(this.waveElapsedSec);
        const currFloor = Math.floor(this.waveElapsedSec + clampedDt);
        if (currFloor > prevFloor) {
          unit.hp = Math.min(unit.maxHp, unit.hp + unit.regenHps);
          if (!unit.isHero) {
            this.addText(unit.x, unit.y - 6, `+${unit.regenHps}`, '#a3e635', false);
          }
        }
      }

      if (unit.hp <= 0 || unit.stunTimer > 0) continue;

      // Movement & Target Acquisition
      if (unit.isHero) {
        this.stepHeroUnit(unit, allUnits, clampedDt);
      } else {
        this.stepEnemyUnit(unit, allUnits, clampedDt);
      }
    }

    // 3. Step Projectiles
    const remainingProjectiles: Projectile[] = [];
    for (const proj of this.projectiles()) {
      const target = allUnits.find((u) => u.uid === proj.targetUid && u.hp > 0);
      const tx = target ? target.x : proj.targetX;
      const ty = target ? target.y : proj.targetY;
      const dx = tx - proj.x;
      const dy = ty - proj.y;
      const d = Math.hypot(dx, dy);

      if (d <= proj.speed * clampedDt + 2.5) {
        // Impact!
        if (target && target.hp > 0) {
          if (proj.isHeal) {
            this.applyHeal(target, proj.value, false);
          } else {
            const attacker =
              allUnits.find((u) => u.uid === proj.sourceUid) ??
              allUnits.find((u) => u.isHero === proj.fromHero);
            this.applyDamage(attacker ?? null, target, proj.value, false);
          }
        }
      } else {
        remainingProjectiles.push({
          ...proj,
          x: proj.x + (dx / d) * proj.speed * clampedDt,
          y: proj.y + (dy / d) * proj.speed * clampedDt,
          targetX: tx,
          targetY: ty,
        });
      }
    }
    this.projectiles.set(remainingProjectiles);

    // 4. Step Floating Combat Text & Ring Effects
    this.floatingTexts.set(
      this.floatingTexts()
        .map((ft) => ({ ...ft, y: ft.y - 5.5 * clampedDt, life: ft.life - clampedDt }))
        .filter((ft) => ft.life > 0),
    );
    this.ringEffects.set(
      this.ringEffects()
        .map((r) => ({ ...r, life: r.life - clampedDt }))
        .filter((r) => r.life > 0),
    );

    // 4b. Step Boss Danger Telegraphs (gives player ~2.0s to drag-kite heroes out of red circle!)
    const activeTelegraphs: ArenaTelegraphEffect[] = [];
    for (const tel of this.telegraphs()) {
      const source = allUnits.find((u) => u.uid === tel.sourceUid && u.hp > 0);
      if (!source || source.stunTimer > 0) continue; // Stunned or slain boss cancels telegraph!
      const nextElapsed = tel.elapsed + clampedDt;
      if (nextElapsed >= tel.duration) {
        // Detonate!
        const heroesInBlast = allUnits.filter(
          (u) => u.isHero && u.hp > 0 && this.dist(tel, u) <= tel.radius,
        );
        for (const h of heroesInBlast) {
          const mult = tel.ability === 'ground-slam' ? 1.55 : 1.35;
          this.applyDamage(source, h, Math.round(source.attack * mult), true);
          if (tel.ability === 'ground-slam') {
            h.stunTimer = 1.8;
          } else if (tel.ability === 'petrify-gaze') {
            h.stunTimer = 3.2;
          }
        }

        // Spawn lingering Acid Pool / Scorched Magma Hazard Zone if applicable
        if (tel.ability === 'acid-pool' || tel.ability === 'fire-breath') {
          this.hazardZones.set([
            ...this.hazardZones(),
            {
              id: `haz-${this.uidCounter++}`,
              x: tel.x,
              y: tel.y,
              radius: tel.radius * 0.85,
              dps: tel.ability === 'acid-pool' ? 14 : 18,
              color: tel.ability === 'acid-pool' ? '#84cc16' : '#ef4444',
              label: tel.ability === 'acid-pool' ? 'ACID!' : 'BURN!',
              remainingSec: 5.5,
              maxSec: 5.5,
            },
          ]);
        }

        // Boss Aggro Reset mechanic: forces player to re-taunt with Tank after dodging/eating slam!
        const enemyDef = source.enemyId ? ENEMY_CATALOG[source.enemyId] : null;
        if (enemyDef?.dropsThreatOnSpecial) {
          source.tankHoldTimer = 0;
          source.aggroResetTimer = 5.5;
          for (const h of allUnits) {
            if (h.isHero && h.role === 'tank') {
              h.threat = Math.max(0, Math.round(h.threat * 0.15));
            }
          }
          // Redirect boss onto a non-tank hero until the player re-taunts!
          const squishies = allUnits.filter((u) => u.isHero && u.hp > 0 && u.role !== 'tank');
          const allLivingHeroes = allUnits.filter((u) => u.isHero && u.hp > 0);
          const nextVictim =
            squishies[Math.floor(Math.random() * squishies.length)] ?? allLivingHeroes[0];
          source.targetUnitUid = nextVictim?.uid ?? null;
          this.addText(source.x, source.y - 14, '⚠️ AGGRO RESET! RE-TAUNT!', '#fde047', true);
        }

        this.addRing(tel.x, tel.y, tel.radius, tel.color);
        this.addText(
          tel.x,
          tel.y - 8,
          heroesInBlast.length === 0 ? 'DODGED!' : `${tel.label}!`,
          heroesInBlast.length === 0 ? '#34d399' : tel.color,
          true,
        );
        this.audio.playFireball();
      } else {
        activeTelegraphs.push({ ...tel, elapsed: nextElapsed });
      }
    }
    this.telegraphs.set(activeTelegraphs);

    // 4c. Step Lingering Ground Hazard Zones (Acid Pools & Magma Patches)
    const prevTickSec = Math.floor(this.waveElapsedSec);
    const currTickSec = Math.floor(this.waveElapsedSec + clampedDt);
    const nextHazards: ArenaHazardZone[] = [];
    for (const haz of this.hazardZones()) {
      const rem = haz.remainingSec - clampedDt;
      if (rem <= 0) continue;
      if (currTickSec > prevTickSec) {
        for (const h of allUnits) {
          if (h.isHero && h.hp > 0 && this.dist(haz, h) <= haz.radius) {
            h.hp = Math.max(0, h.hp - haz.dps);
            h.hurtAnimTimer = 0.15;
            this.addText(h.x, h.y - 6, `-${haz.dps} ${haz.label}`, haz.color, false);
          }
        }
      }
      nextHazards.push({ ...haz, remainingSec: rem });
    }
    this.hazardZones.set(nextHazards);

    // 5. Handle Enemy Deaths, Slime Splitting (`splitsOnDeath`), and Arena Kills
    const newlyDeadEnemies = allUnits.filter((u) => !u.isHero && u.hp <= 0);
    const splitChildren: CombatUnit[] = [];
    if (newlyDeadEnemies.length > 0) {
      this.arenaKills.set(this.arenaKills() + newlyDeadEnemies.length);
      for (const fallen of newlyDeadEnemies) {
        const def = fallen.enemyId ? ENEMY_CATALOG[fallen.enemyId] : null;
        if (def?.splitsOnDeath) {
          this.addRing(fallen.x, fallen.y, 16, '#84cc16');
          this.addText(
            fallen.x,
            fallen.y - 8,
            `SPLIT! x${def.splitsOnDeath.count}`,
            '#a3e635',
            true,
          );
          for (let s = 0; s < def.splitsOnDeath.count; s++) {
            const child = this.createEnemyUnit(def.splitsOnDeath.enemyId, s);
            child.x = this.clampX(fallen.x + (s === 0 ? -4 : 4));
            child.y = this.clampY(fallen.y + (s === 0 ? -3 : 3));
            splitChildren.push(child);
          }
        }
      }
    }

    const surviving = [...allUnits.filter((u) => u.hp > 0), ...splitChildren];
    this.units.set(surviving);

    // Ensure selectedHeroUid points to a living hero
    if (
      this.selectedHeroUid() &&
      !surviving.some((u) => u.uid === this.selectedHeroUid() && u.isHero)
    ) {
      const nextHero = surviving.find((u) => u.isHero);
      this.selectedHeroUid.set(nextHero?.uid ?? null);
    }

    this.checkWaveOrBattleCompletion();
  }

  public ngOnDestroy(): void {
    this.stopLoop();
  }

  private stepHeroUnit(hero: CombatUnit, allUnits: CombatUnit[], dt: number): void {
    const speed =
      hero.moveSpeed * (hero.slowTimer > 0 ? 0.55 : 1) * (hero.hasteTimer > 0 ? 1.25 : 1);

    // 1. If ordered to walk to a ground destination, move there first
    if (hero.moveDestination) {
      const dx = hero.moveDestination.x - hero.x;
      const dy = hero.moveDestination.y - hero.y;
      const d = Math.hypot(dx, dy);
      if (d <= 1.8) {
        hero.x = hero.moveDestination.x;
        hero.y = hero.moveDestination.y;
        hero.moveDestination = null;
      } else {
        hero.x = this.clampX(hero.x + (dx / d) * speed * dt);
        hero.y = this.clampY(hero.y + (dy / d) * speed * dt);
        hero.facing = dx >= 0 ? 'right' : 'left';
        hero.isMoving = true;
        return;
      }
    }

    // 2. Healer Logic (Cleric heals either locked target or lowest HP % ally)
    if (hero.role === 'healer') {
      const allies = allUnits.filter((u) => u.isHero && u.hp > 0);
      let healTarget = allies.find((a) => a.uid === hero.targetUnitUid && a.hp < a.maxHp);
      if (!healTarget) {
        // Auto-select most injured ally
        const injured = allies
          .filter((a) => a.hp < a.maxHp)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        healTarget = injured[0] ?? allies.find((a) => a.uid === hero.targetUnitUid) ?? allies[0];
      }

      if (healTarget) {
        hero.facing = healTarget.x >= hero.x ? 'right' : 'left';
        const rateMult = hero.hasteTimer > 0 ? 1.35 : 1;
        hero.attackTimer -= dt * rateMult;
        if (hero.attackTimer <= 0) {
          hero.attackTimer = hero.attackIntervalSec;
          hero.attackAnimTimer = 0.28;
          const isCrit = Math.random() < hero.critChance;
          const baseHeal = hero.attack * (hero.attackBuffTimer > 0 ? 1.25 : 1);
          const finalHeal = Math.round(baseHeal * (isCrit ? 1.6 : 1));
          this.spawnProjectile(hero, healTarget, '#34d399', true, finalHeal);
          this.audio.playHeal();
        }
      }
      return;
    }

    // 3. Combat Hero Logic (Tank, Melee DPS, Ranged DPS, Support)
    const enemies = allUnits.filter((u) => !u.isHero && u.hp > 0);
    if (enemies.length === 0) return;

    let target = enemies.find((e) => e.uid === hero.targetUnitUid);
    if (!target) {
      // Pick nearest enemy
      target = [...enemies].sort((a, b) => this.dist(hero, a) - this.dist(hero, b))[0];
      hero.targetUnitUid = target.uid;
    }

    const d = this.dist(hero, target);
    hero.facing = target.x >= hero.x ? 'right' : 'left';

    if (d > hero.attackRange) {
      const dx = target.x - hero.x;
      const dy = target.y - hero.y;
      hero.x = this.clampX(hero.x + (dx / d) * speed * dt);
      hero.y = this.clampY(hero.y + (dy / d) * speed * dt);
      hero.isMoving = true;
    } else {
      // Barbarian Berserker Passive: attacks faster & hits up to +55% harder as his HP drops!
      const missingHpRatio =
        hero.classId === 'barbarian' ? Math.max(0, 1 - hero.hp / Math.max(1, hero.maxHp)) : 0;
      const berserkMult = 1 + missingHpRatio * 0.55;
      const rateMult = (hero.hasteTimer > 0 ? 1.35 : 1) * berserkMult;
      hero.attackTimer -= dt * rateMult;
      if (hero.attackTimer <= 0) {
        hero.attackTimer = hero.attackIntervalSec;
        hero.attackAnimTimer = 0.25;

        const isCrit = Math.random() < hero.critChance;
        const rawDmg =
          hero.attack * berserkMult * (hero.attackBuffTimer > 0 ? 1.25 : 1) * (isCrit ? 1.75 : 1);
        const dmg = Math.round(rawDmg);

        if (hero.attackRange > 20) {
          const color =
            hero.classId === 'wizard'
              ? '#f97316'
              : hero.classId === 'witch'
                ? '#a855f7'
                : hero.classId === 'bard'
                  ? '#10b981'
                  : '#fde047';
          this.spawnProjectile(hero, target, color, false, dmg);
          this.audio.playArrow();
        } else {
          this.applyDamage(hero, target, dmg, isCrit);
          this.audio.playSlash();
        }

        // Witch hex passive: basic shadow bolts weaken target enemy damage for 3.5s
        if (hero.classId === 'witch') {
          target.weakenTimer = Math.max(target.weakenTimer, 3.5);
        }

        // Paladin / Bard passive party splash heal on basic attack
        if (hero.classId === 'paladin' || hero.classId === 'bard') {
          const allies = allUnits
            .filter((u) => u.isHero && u.hp > 0 && u.hp < u.maxHp)
            .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
          if (allies[0]) {
            this.applyHeal(allies[0], Math.round(hero.attack * 0.3), false);
          }
        }
      }
    }
  }

  private stepEnemyUnit(enemy: CombatUnit, allUnits: CombatUnit[], dt: number): void {
    const heroes = allUnits.filter((u) => u.isHero && u.hp > 0);
    if (heroes.length === 0) return;

    const speed = enemy.moveSpeed * (enemy.slowTimer > 0 ? 0.5 : 1);

    // Boss & Special Enemy Abilities
    if (enemy.specialAbility && enemy.specialIntervalSec > 0) {
      enemy.specialTimer += dt;
      if (enemy.specialTimer >= enemy.specialIntervalSec) {
        enemy.specialTimer = 0;
        this.triggerEnemySpecial(enemy, allUnits);
      }
    }

    // Healer Enemy (Goblin Shaman / Necromancer mends injured monsters)
    const def = enemy.enemyId ? ENEMY_CATALOG[enemy.enemyId] : null;
    if (def?.isHealer) {
      const injuredAllies = allUnits
        .filter((u) => !u.isHero && u.hp > 0 && u.hp < u.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      if (injuredAllies[0]) {
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = enemy.attackIntervalSec;
          enemy.attackAnimTimer = 0.28;
          this.spawnProjectile(enemy, injuredAllies[0], '#a855f7', true, enemy.attack * 2);
          this.addText(enemy.x, enemy.y - 8, '💜 DARK MEND', '#c084fc', false);
          return;
        }
      }
    }

    // Target acquisition: authentic Battleheart per-enemy aggro!
    // 1. Tick down Tank Hold timer & Periodic Aggro Reset timer
    enemy.tankHoldTimer = Math.max(0, (enemy.tankHoldTimer ?? 0) - dt);
    enemy.aggroResetTimer = (enemy.aggroResetTimer ?? 5.5) - dt;

    let target = heroes.find((h) => h.uid === enemy.targetUnitUid);

    // 2. If targeting a Tank who walked out of melee range (kiting or chasing another mob) without Shield Wall/Wind Stance, drop aggro immediately!
    if (
      target &&
      target.role === 'tank' &&
      target.shieldTimer <= 0 &&
      target.evasionTimer <= 0 &&
      this.dist(enemy, target) > enemy.attackRange + 8 &&
      (enemy.tankHoldTimer ?? 0) < 3.5
    ) {
      enemy.tankHoldTimer = 0;
      target = undefined;
    }

    // 3. Frequent Aggro Resets: if not firmly held by a Tank taunt/strike, enemy periodically resets aggro onto whoever hit it last or a squishy!
    if (enemy.aggroResetTimer <= 0) {
      enemy.aggroResetTimer = 5.0 + (this.uidCounter % 3) * 0.8;
      if ((enemy.tankHoldTimer ?? 0) <= 0) {
        const squishies = heroes.filter((h) => h.role !== 'tank');
        const lastNonTank = heroes.find(
          (h) => h.uid === enemy.lastAttackerUid && h.role !== 'tank',
        );
        const newTarget =
          lastNonTank ?? squishies[Math.floor(Math.random() * squishies.length)] ?? heroes[0];
        if (newTarget && newTarget.uid !== enemy.targetUnitUid) {
          enemy.targetUnitUid = newTarget.uid;
          target = newTarget;
          this.addText(enemy.x, enemy.y - 9, '⚠️ AGGRO RESET!', '#fbbf24', false);
        }
      }
    }

    // 4. Initial / fallback target acquisition: distribute across party & prioritize last attacker or squishies if untanked!
    if (!target) {
      const lastAttacker = heroes.find((h) => h.uid === enemy.lastAttackerUid);
      if (lastAttacker) {
        target = lastAttacker;
      } else {
        const squishies = heroes.filter((h) => h.role !== 'tank');
        const enemyNum = Number(enemy.uid.replace(/\D/g, '')) || 0;
        // Fast flankers and secondary wave spawns hunt your Rogue, Wizard, or Cleric unless intercepted by your Tank!
        if (
          squishies.length > 0 &&
          (enemyNum % 2 === 1 ||
            enemy.enemyId === 'dire-wolf' ||
            enemy.enemyId === 'mini-slime' ||
            enemy.enemyId === 'goblin-archer')
        ) {
          target = squishies[enemyNum % squishies.length];
        } else {
          target = [...heroes].sort((a, b) => this.dist(enemy, a) - this.dist(enemy, b))[0];
        }
      }
      enemy.targetUnitUid = target?.uid ?? null;
    }

    if (!target) return;

    const d = this.dist(enemy, target);
    enemy.facing = target.x >= enemy.x ? 'right' : 'left';

    // Ranged sniper kiting: if a melee hero closes within 13 units of a non-boss ranged enemy, step back while firing!
    if (def?.isRanged && !def?.isBoss && d < 13 && enemy.x < 90) {
      const dx = enemy.x - target.x;
      const dy = enemy.y - target.y;
      const norm = Math.max(1, Math.hypot(dx, dy));
      enemy.x = this.clampX(enemy.x + (dx / norm) * speed * 0.65 * dt);
      enemy.y = this.clampY(enemy.y + (dy / norm) * speed * 0.65 * dt);
      enemy.isMoving = true;
    }

    if (d > enemy.attackRange) {
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      enemy.x = this.clampX(enemy.x + (dx / d) * speed * dt);
      enemy.y = this.clampY(enemy.y + (dy / d) * speed * dt);
      enemy.isMoving = true;
    } else {
      enemy.attackTimer -= dt;
      if (enemy.attackTimer <= 0) {
        enemy.attackTimer = enemy.attackIntervalSec;
        enemy.attackAnimTimer = 0.25;
        if (enemy.attackRange > 20) {
          this.spawnProjectile(enemy, target, '#ef4444', false, enemy.attack);
        } else {
          this.applyDamage(enemy, target, enemy.attack, false);
        }
      }
    }
  }

  private triggerEnemySpecial(enemy: CombatUnit, allUnits: CombatUnit[]): void {
    const heroes = allUnits.filter((u) => u.isHero && u.hp > 0);
    const monsters = allUnits.filter((u) => !u.isHero && u.hp > 0);
    if (heroes.length === 0) return;

    switch (enemy.specialAbility) {
      case 'ground-slam': {
        this.telegraphs.set([
          ...this.telegraphs(),
          {
            id: `tel-${this.uidCounter++}`,
            sourceUid: enemy.uid,
            x: enemy.x,
            y: enemy.y,
            radius: 26,
            color: '#f97316',
            label: 'GROUND SLAM',
            elapsed: 0,
            duration: 2.0,
            ability: 'ground-slam',
          },
        ]);
        this.addText(enemy.x, enemy.y - 10, '⚠️ SLAM WINDUP!', '#fbbf24', true);
        break;
      }
      case 'petrify-gaze': {
        const victim = heroes[Math.floor(Math.random() * heroes.length)];
        if (victim) {
          this.telegraphs.set([
            ...this.telegraphs(),
            {
              id: `tel-${this.uidCounter++}`,
              sourceUid: enemy.uid,
              x: victim.x,
              y: victim.y,
              radius: 20,
              color: '#10b981',
              label: 'PETRIFYING GAZE',
              elapsed: 0,
              duration: 2.0,
              ability: 'petrify-gaze',
            },
          ]);
          this.addText(
            victim.x,
            victim.y - 10,
            '⚠️ GAZE ON ' + victim.name.toUpperCase() + '!',
            '#10b981',
            true,
          );
        }
        break;
      }
      case 'acid-pool': {
        const meleeVictim = heroes.find((h) => h.uid === enemy.targetUnitUid) ?? heroes[0] ?? enemy;
        this.telegraphs.set([
          ...this.telegraphs(),
          {
            id: `tel-${this.uidCounter++}`,
            sourceUid: enemy.uid,
            x: meleeVictim.x,
            y: meleeVictim.y,
            radius: 25,
            color: '#84cc16',
            label: 'CAUSTIC ERUPTION',
            elapsed: 0,
            duration: 2.0,
            ability: 'acid-pool',
          },
        ]);
        this.addText(enemy.x, enemy.y - 10, '⚠️ ACID POOL WINDUP!', '#a3e635', true);
        break;
      }
      case 'fire-breath': {
        const targetHero = heroes[0] ?? enemy;
        this.telegraphs.set([
          ...this.telegraphs(),
          {
            id: `tel-${this.uidCounter++}`,
            sourceUid: enemy.uid,
            x: targetHero.x,
            y: targetHero.y,
            radius: 28,
            color: '#ef4444',
            label: 'INFERNO BREATH',
            elapsed: 0,
            duration: 2.1,
            ability: 'fire-breath',
          },
        ]);
        this.addText(enemy.x, enemy.y - 10, '⚠️ BREATH WINDUP!', '#ef4444', true);
        break;
      }
      case 'dark-mend': {
        const target = [...monsters].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (target) {
          this.applyHeal(target, Math.round(enemy.attack * 2.4), true);
          this.addRing(target.x, target.y, 14, '#a855f7');
        }
        break;
      }
      case 'enrage': {
        enemy.attackBuffTimer = 5;
        this.addText(enemy.x, enemy.y - 8, 'ENRAGED!', '#ef4444', false);
        break;
      }
    }
  }

  private applyDamage(
    attacker: CombatUnit | null,
    target: CombatUnit,
    rawAmount: number,
    isCrit: boolean,
  ): void {
    if (target.invulnerableTimer > 0 || target.hp <= 0) return;

    // Witch Hex / Weaken debuff: weakened enemies deal 35% less damage!
    const effectiveRaw =
      attacker && attacker.weakenTimer > 0 ? Math.round(rawAmount * 0.65) : rawAmount;

    // Dodge Tank & Evasion Mechanic (Monk Wind Stance, Rogue agility, Zephyr Greaves):
    if (target.isHero && (!attacker || !attacker.isHero)) {
      const totalDodge = Math.min(
        0.85,
        (target.dodgeChance ?? 0) + (target.evasionTimer > 0 ? 0.52 : 0),
      );
      if (totalDodge > 0 && Math.random() < totalDodge) {
        if (attacker && target.role === 'tank') {
          attacker.targetUnitUid = target.uid;
          attacker.tankHoldTimer = Math.max(attacker.tankHoldTimer ?? 0, 3.8);
          attacker.aggroResetTimer = Math.max(attacker.aggroResetTimer ?? 0, 5.8);
        }
        this.addText(target.x, target.y - 7, '💨 DODGE!', '#38bdf8', false);
        // Monk Dodge Tank Counter-Attack!
        if (
          attacker &&
          attacker.hp > 0 &&
          (target.counterOnDodge || target.evasionTimer > 0) &&
          this.dist(target, attacker) <= 18
        ) {
          target.attackAnimTimer = 0.22;
          const counterDmg = Math.max(
            4,
            Math.round((target.attack * 0.85 * 100) / (100 + Math.max(0, attacker.defense) * 3.5)),
          );
          attacker.hp = Math.max(0, attacker.hp - counterDmg);
          attacker.hurtAnimTimer = 0.16;
          this.addText(attacker.x, attacker.y - 8, `⚡ COUNTER -${counterDmg}!`, '#fb923c', true);
        }
        return;
      }
    }

    // "Use Your Tank or Everybody Dies" Mitigation:
    // Plate Tanks mitigate heavy blows with armor; Dodge Tank (Monk) relies on high evasion + martial stance;
    // Non-tank squishies take 1.55x unshielded damage when they pull aggro!
    let dmg: number;
    if (target.isHero) {
      if (target.role === 'tank') {
        const armorFactor = target.classId === 'monk' ? 3.8 : 5.8;
        const mitigation = 100 / (100 + Math.max(0, target.defense) * armorFactor);
        dmg = Math.max(2, Math.round(effectiveRaw * mitigation));
      } else {
        const mitigation = 100 / (100 + Math.max(0, target.defense) * 1.8);
        dmg = Math.max(5, Math.round(effectiveRaw * 1.55 * mitigation));
      }
    } else {
      const mitigation = 100 / (100 + Math.max(0, target.defense) * 3.5);
      dmg = Math.max(2, Math.round(effectiveRaw * mitigation));
    }

    if (target.shieldTimer > 0) {
      dmg = Math.max(1, Math.round(dmg * 0.35));
    }

    target.hp = Math.max(0, target.hp - dmg);
    target.hurtAnimTimer = 0.18;

    if (attacker) {
      attacker.threat += dmg * attacker.threatMultiplier;
      if (attacker.lifesteal > 0 && attacker.hp > 0) {
        const leech = Math.max(1, Math.round(dmg * attacker.lifesteal));
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + leech);
      }
      if (attacker.poisonDps > 0 && !target.isHero) {
        target.poisonTimer = 4;
        target.poisonDps = Math.max(2, Math.round(attacker.attack * 0.32));
      }

      // Hit-Driven Aggro ("Whoever hits them last" + Tank Hold):
      if (attacker.isHero && !target.isHero && target.hp > 0) {
        target.lastAttackerUid = attacker.uid;
        if (attacker.role === 'tank') {
          // Tank melee strike holds this specific enemy's attention for 3.2s
          target.targetUnitUid = attacker.uid;
          target.tankHoldTimer = Math.max(target.tankHoldTimer ?? 0, 3.2);
          target.aggroResetTimer = Math.max(target.aggroResetTimer ?? 0, 5.8);
        } else {
          const tankHold = target.tankHoldTimer ?? 0;
          // If no Tank is actively holding this enemy, OR if DPS lands a big crit/burst while not hard-taunted, enemy turns on the attacker!
          if (tankHold <= 0 || (isCrit && tankHold < 3.5 && Math.random() < 0.55)) {
            const switched = target.targetUnitUid !== attacker.uid;
            target.tankHoldTimer = 0;
            target.targetUnitUid = attacker.uid;
            if (switched) {
              this.addText(attacker.x, attacker.y - 9, '⚠️ AGGRO!', '#ef4444', true);
            }
          }
        }
      }
    }

    this.addText(
      target.x,
      target.y - 6,
      isCrit ? `${dmg}!` : `-${dmg}`,
      target.isHero ? '#f87171' : isCrit ? '#fde047' : '#f8fafc',
      isCrit,
    );
  }

  private applyHeal(target: CombatUnit, amount: number, isCrit: boolean): void {
    if (target.hp <= 0) return;
    const healed = Math.max(1, Math.round(amount));
    target.hp = Math.min(target.maxHp, target.hp + healed);
    this.addText(target.x, target.y - 7, `+${healed}`, '#34d399', isCrit);
  }

  private spawnProjectile(
    from: CombatUnit,
    to: CombatUnit,
    color: string,
    isHeal: boolean,
    value: number,
  ): void {
    const p: Projectile = {
      id: `proj-${this.uidCounter++}`,
      sourceUid: from.uid,
      fromHero: from.isHero,
      x: from.x,
      y: from.y - 3,
      targetUid: to.uid,
      targetX: to.x,
      targetY: to.y - 3,
      speed: 34,
      color,
      size: isHeal ? 8 : 7,
      isHeal,
      value,
    };
    this.projectiles.set([...this.projectiles(), p]);
  }

  private queueWave(waveIdx: number): void {
    const stage = this.activeStage();
    if (!stage) return;

    this.waveIndex.set(waveIdx);
    this.waveElapsedSec = 0;
    this.pendingSpawns = [];
    const waveLeadDelay = waveIdx > 0 ? 0.9 : 0;

    if (stage.isArena) {
      // Procedural escalating wave for Endless Arena
      const pool: EnemyId[] = [
        'goblin-scout',
        'goblin-archer',
        'giant-slime',
        'goblin-shaman',
        'dire-wolf',
        'orc-brute',
        'skeleton-warrior',
        'dark-necromancer',
      ];
      const count = Math.min(7, 2 + Math.floor(waveIdx / 2));
      for (let i = 0; i < count; i++) {
        const pick = pool[(waveIdx + i) % pool.length];
        this.pendingSpawns.push({
          enemyId: pick,
          spawnAtElapsed: waveLeadDelay + i * 1.35,
        });
      }
      if (waveIdx > 0 && waveIdx % 4 === 0) {
        this.pendingSpawns.push({
          enemyId: 'cave-troll',
          spawnAtElapsed: waveLeadDelay + 1.8,
        });
      }
    } else {
      const wave = stage.waves[waveIdx] ?? [];
      for (const group of wave) {
        for (let i = 0; i < group.count; i++) {
          this.pendingSpawns.push({
            enemyId: group.enemyId,
            spawnAtElapsed: waveLeadDelay + group.delaySec + i * 1.25,
          });
        }
      }
    }

    // Immediately spawn 0-delay enemies
    const immediate = this.pendingSpawns.filter((s) => s.spawnAtElapsed <= 0);
    this.pendingSpawns = this.pendingSpawns.filter((s) => s.spawnAtElapsed > 0);
    if (immediate.length > 0) {
      const spawned = immediate.map((r, idx) => this.createEnemyUnit(r.enemyId, idx));
      this.units.set([...this.units(), ...spawned]);
    }
  }

  private createEnemyUnit(enemyId: EnemyId, offsetIdx: number): CombatUnit {
    const def = ENEMY_CATALOG[enemyId];
    const stage = this.activeStage();
    const waveScale = stage?.isArena ? 1 + this.waveIndex() * 0.14 : 1;

    const spawnY = 44 + ((offsetIdx * 13 + this.uidCounter * 7) % 38);
    const spawnX = 87 + (offsetIdx % 3) * 2.5;

    return {
      uid: `enemy-${this.uidCounter++}`,
      isHero: false,
      enemyId: def.id,
      name: def.name,
      svgAsset: def.svgAsset,
      accentColor: '#ef4444',
      role: 'enemy',
      isBoss: def.isBoss,
      scale: def.scale,
      x: spawnX,
      y: spawnY,
      facing: 'left',
      targetUnitUid: null,
      moveDestination: null,
      maxHp: Math.round(def.maxHp * waveScale),
      hp: Math.round(def.maxHp * waveScale),
      attack: Math.round(def.attack * waveScale),
      defense: def.defense,
      attackRange: def.attackRange,
      attackIntervalSec: def.attackIntervalSec,
      attackTimer: 0.6 + (offsetIdx % 3) * 0.25,
      moveSpeed: def.moveSpeed,
      critChance: 0.05,
      dodgeChance: 0,
      lifesteal: 0,
      threat: 0,
      threatMultiplier: 1,
      skills: [],
      specialAbility: def.specialAbility,
      specialTimer: 0,
      specialIntervalSec: def.specialIntervalSec ?? 8,
      shieldTimer: 0,
      evasionTimer: 0,
      weakenTimer: 0,
      invulnerableTimer: 0,
      stunTimer: 0,
      slowTimer: 0,
      hasteTimer: 0,
      attackBuffTimer: 0,
      poisonTimer: 0,
      poisonDps: 0,
      regenTimer: 9999,
      regenHps: Math.round((def.regenHps ?? 0) * waveScale),
      attackAnimTimer: 0,
      hurtAnimTimer: 0,
    };
  }

  private checkWaveOrBattleCompletion(): void {
    if (this.outcome() !== 'ongoing') return;
    const stage = this.activeStage();
    if (!stage) return;

    const livingHeroes = this.units().filter((u) => u.isHero && u.hp > 0);
    const livingEnemies = this.units().filter((u) => !u.isHero && u.hp > 0);

    if (livingHeroes.length === 0) {
      this.outcome.set('defeat');
      this.stopLoop();
      this.audio.playDefeat();

      // In Endless Arena, award gold & XP proportional to kills even on defeat
      const kills = this.arenaKills();
      const goldEarned = stage.isArena ? kills * 18 : Math.round(stage.goldReward * 0.25);
      const xpEarned = stage.isArena ? kills * 14 : Math.round(stage.xpReward * 0.25);
      const res = this.gameState.awardBattleRewards(stage, goldEarned, xpEarned, 0, kills);
      this.lastRewardSummary.set({
        gold: goldEarned,
        xp: xpEarned,
        stars: 0,
        leveledUpHeroes: res.leveledUpHeroes,
        bonusLootName: stage.isArena ? 'Colosseum Valor Purse' : 'Retreat Salvage Pouch',
        droppedRelicName: res.droppedRelicName,
        unlockedHeroName: res.unlockedHeroName,
      });
      return;
    }

    if (livingEnemies.length === 0 && this.pendingSpawns.length === 0) {
      const nextWave = this.waveIndex() + 1;
      if (stage.isArena || nextWave < stage.waves.length) {
        this.queueWave(nextWave);
      } else {
        // Stage Victory!
        this.outcome.set('victory');
        this.stopLoop();
        this.audio.playVictory();

        const spoilsPool = [
          "King's Gilded War Chest",
          'Mithril-Bound Spoils Coffer',
          "Goblin Chieftain's Hoard",
          'Sunforged Relic Strongbox',
          'Dragonscale Treasury Chest',
        ];
        const partySize = this.gameState.partyHeroes().length;
        const casualties = partySize - livingHeroes.length;
        const stars = casualties === 0 ? 3 : casualties === 1 ? 2 : 1;
        const res = this.gameState.awardBattleRewards(
          stage,
          stage.goldReward,
          stage.xpReward,
          stars,
          this.arenaKills(),
        );
        this.lastRewardSummary.set({
          gold: stage.goldReward,
          xp: stage.xpReward,
          stars,
          leveledUpHeroes: res.leveledUpHeroes,
          bonusLootName: spoilsPool[(stage.index - 1) % spoilsPool.length] ?? spoilsPool[0],
          droppedRelicName: res.droppedRelicName,
          unlockedHeroName: res.unlockedHeroName,
        });
      }
    }
  }

  private addText(x: number, y: number, text: string, color: string, isCrit: boolean): void {
    const item: FloatingText = {
      id: `ft-${this.uidCounter++}`,
      x: x + (Math.random() * 4 - 2),
      y,
      text,
      color,
      isCrit,
      life: 1.15,
      maxLife: 1.15,
    };
    this.floatingTexts.set([...this.floatingTexts().slice(-24), item]);
  }

  private addRing(x: number, y: number, radius: number, color: string): void {
    const ring: ArenaRingEffect = {
      id: `ring-${this.uidCounter++}`,
      x,
      y,
      radius,
      color,
      life: 0.45,
      maxLife: 0.45,
    };
    this.ringEffects.set([...this.ringEffects().slice(-12), ring]);
  }

  private dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private clampX(x: number): number {
    return Math.max(7, Math.min(93, x));
  }

  private clampY(y: number): number {
    return Math.max(36, Math.min(88, y));
  }

  private readonly loop = (now: number): void => {
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    this.step(dt);
    if (this.isRunning() && this.outcome() === 'ongoing' && typeof window !== 'undefined') {
      this.rafId = window.requestAnimationFrame(this.loop);
    }
  };

  private stopLoop(): void {
    if (this.rafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
