import { computed, inject, Injectable, signal } from '@angular/core';
import {
  ARMOR_TIERS,
  HERO_CATALOG,
  STAGE_CATALOG,
  TRINKET_CATALOG,
  WEAPON_TIERS,
} from '../models/game-catalog';
import {
  HeroClassDefinition,
  HeroClassId,
  HeroSaveState,
  SaveProfile,
  SkillChoice,
  SkillDefinition,
  StageDefinition,
} from '../models/game.model';
import { AudioService } from './audio.service';
import { StorageService } from './storage.service';

export interface ComputedHeroStats {
  def: HeroClassDefinition;
  save: HeroSaveState;
  maxHp: number;
  attack: number;
  defense: number;
  attackIntervalSec: number;
  moveSpeed: number;
  critChance: number;
  lifesteal: number;
  cooldownMultiplier: number;
  regenPctPerSec: number;
  activeSkills: SkillDefinition[];
  weaponName: string;
  armorName: string;
  nextLevelXp: number;
}

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly storage = inject(StorageService);
  private readonly audio = inject(AudioService);

  public readonly activeSlot = signal<number>(this.storage.getActiveSlot());
  public readonly profile = signal<SaveProfile>(this.storage.loadSlot(this.activeSlot()));

  public readonly gold = computed(() => this.profile().gold);
  public readonly arenaBestKills = computed(() => this.profile().arenaBestKills);

  /**
   * Highest campaign stage index cleared (0 at game start, up to 9 after defeating Ignis).
   * Drives progressive disclosure of Blacksmith equipment tiers and Merchant relics!
   */
  public readonly highestClearedStageIndex = computed(() => {
    const completed = new Set(this.profile().completedStageIds);
    let maxIdx = 0;
    for (const st of STAGE_CATALOG) {
      if (!st.isArena && completed.has(st.id) && st.index > maxIdx) {
        maxIdx = st.index;
      }
    }
    return maxIdx;
  });

  public readonly unlockedGearTier = computed(() => {
    const cleared = this.highestClearedStageIndex();
    let maxTier = 2;
    for (const wt of WEAPON_TIERS) {
      if (cleared >= wt.unlockStageIndex && wt.tier > maxTier) {
        maxTier = wt.tier;
      }
    }
    return maxTier;
  });

  public readonly allHeroIds = Object.keys(HERO_CATALOG) as HeroClassId[];

  public readonly roster = computed<ComputedHeroStats[]>(() => {
    const p = this.profile();
    return this.allHeroIds.map((id) => this.computeHeroStats(id, p.heroes[id]));
  });

  public readonly partyHeroes = computed<ComputedHeroStats[]>(() =>
    this.roster().filter((h) => h.save.unlocked && h.save.inParty),
  );

  public readonly stages = computed(() => {
    const completed = new Set(this.profile().completedStageIds);
    const stars = this.profile().stageStars;

    return STAGE_CATALOG.map((stage, idx) => {
      const prevStage = idx > 0 ? STAGE_CATALOG[idx - 1] : null;
      const unlocked =
        idx === 0 ||
        stage.isArena ||
        completed.has(stage.id) ||
        (prevStage ? completed.has(prevStage.id) : true);
      return {
        stage,
        unlocked,
        completed: completed.has(stage.id),
        stars: stars[stage.id] ?? 0,
      };
    });
  });

  public switchSaveSlot(slot: 1 | 2 | 3): void {
    this.storage.setActiveSlot(slot);
    this.activeSlot.set(slot);
    this.profile.set(this.storage.loadSlot(slot));
    this.audio.playSelect();
  }

  public resetCurrentSlot(): void {
    const fresh = this.storage.resetSlot(this.activeSlot());
    this.profile.set(fresh);
    this.audio.playSelect();
  }

  public exportSave(): string {
    return this.storage.exportProfileJson(this.profile());
  }

  public importSave(json: string): boolean {
    const imported = this.storage.importProfileJson(json, this.activeSlot());
    if (!imported) return false;
    this.profile.set(imported);
    this.audio.playVictory();
    return true;
  }

  public xpForNextLevel(level: number): number {
    return Math.round(80 * Math.pow(level, 1.35));
  }

  public hireHero(classId: HeroClassId): boolean {
    const p = this.profile();
    const heroSave = p.heroes[classId];
    const def = HERO_CATALOG[classId];
    if (!heroSave || heroSave.unlocked || p.gold < def.hireCost) {
      return false;
    }

    const currentPartyCount = Object.values(p.heroes).filter((h) => h.unlocked && h.inParty).length;
    const nextInParty = currentPartyCount < 4;

    const updated: SaveProfile = {
      ...p,
      gold: p.gold - def.hireCost,
      heroes: {
        ...p.heroes,
        [classId]: {
          ...heroSave,
          unlocked: true,
          inParty: nextInParty,
        },
      },
    };
    this.commitProfile(updated);
    this.audio.playCoin();
    return true;
  }

  public toggleHeroInParty(classId: HeroClassId): boolean {
    const p = this.profile();
    const heroSave = p.heroes[classId];
    if (!heroSave || !heroSave.unlocked) return false;

    const currentParty = Object.values(p.heroes).filter((h) => h.unlocked && h.inParty);
    if (heroSave.inParty) {
      // Must keep at least 1 hero in party
      if (currentParty.length <= 1) return false;
      this.commitProfile({
        ...p,
        heroes: {
          ...p.heroes,
          [classId]: { ...heroSave, inParty: false },
        },
      });
      this.audio.playSelect();
      return true;
    } else {
      if (currentParty.length >= 4) return false;
      this.commitProfile({
        ...p,
        heroes: {
          ...p.heroes,
          [classId]: { ...heroSave, inParty: true },
        },
      });
      this.audio.playSelect();
      return true;
    }
  }

  public upgradeWeapon(classId: HeroClassId): boolean {
    const p = this.profile();
    const heroSave = p.heroes[classId];
    if (!heroSave || !heroSave.unlocked || heroSave.weaponTier >= 7) return false;

    const nextTier = WEAPON_TIERS[heroSave.weaponTier]; // 0-indexed array, tier 2 is index 1
    if (!nextTier || p.gold < nextTier.cost) return false;
    if (this.highestClearedStageIndex() < nextTier.unlockStageIndex) return false;

    this.commitProfile({
      ...p,
      gold: p.gold - nextTier.cost,
      heroes: {
        ...p.heroes,
        [classId]: {
          ...heroSave,
          weaponTier: heroSave.weaponTier + 1,
        },
      },
    });
    this.audio.playCoin();
    return true;
  }

  public upgradeArmor(classId: HeroClassId): boolean {
    const p = this.profile();
    const heroSave = p.heroes[classId];
    if (!heroSave || !heroSave.unlocked || heroSave.armorTier >= 7) return false;

    const nextTier = ARMOR_TIERS[heroSave.armorTier];
    if (!nextTier || p.gold < nextTier.cost) return false;
    if (this.highestClearedStageIndex() < nextTier.unlockStageIndex) return false;

    this.commitProfile({
      ...p,
      gold: p.gold - nextTier.cost,
      heroes: {
        ...p.heroes,
        [classId]: {
          ...heroSave,
          armorTier: heroSave.armorTier + 1,
        },
      },
    });
    this.audio.playCoin();
    return true;
  }

  public buyOrEquipTrinket(classId: HeroClassId, trinketId: string): boolean {
    const p = this.profile();
    const heroSave = p.heroes[classId];
    const trinket = TRINKET_CATALOG.find((t) => t.id === trinketId);
    if (!heroSave || !trinket) return false;

    const isOwned = p.ownedTrinkets.includes(trinketId);
    if (!isOwned) {
      if (p.gold < trinket.cost || this.highestClearedStageIndex() < trinket.unlockStageIndex) {
        return false;
      }
    }

    const nextGold = isOwned ? p.gold : p.gold - trinket.cost;
    const nextOwned = isOwned ? p.ownedTrinkets : [...p.ownedTrinkets, trinketId];

    // Unequip from any other hero if already equipped elsewhere
    const updatedHeroes = { ...p.heroes };
    for (const id of this.allHeroIds) {
      if (id === classId) continue;
      if (updatedHeroes[id].trinketId === trinketId) {
        updatedHeroes[id] = { ...updatedHeroes[id], trinketId: null };
      }
      if (updatedHeroes[id].secondTrinketId === trinketId) {
        updatedHeroes[id] = { ...updatedHeroes[id], secondTrinketId: null };
      }
    }

    const currentPrimary = heroSave.trinketId;
    const currentSecondary = heroSave.secondTrinketId ?? null;

    if (currentPrimary === trinketId) {
      updatedHeroes[classId] = { ...updatedHeroes[classId], trinketId: null };
    } else if (currentSecondary === trinketId) {
      updatedHeroes[classId] = { ...updatedHeroes[classId], secondTrinketId: null };
    } else if (!currentPrimary) {
      updatedHeroes[classId] = { ...updatedHeroes[classId], trinketId: trinketId };
    } else if (!currentSecondary) {
      updatedHeroes[classId] = { ...updatedHeroes[classId], secondTrinketId: trinketId };
    } else {
      // Shift primary to secondary and equip new relic in primary slot
      updatedHeroes[classId] = {
        ...updatedHeroes[classId],
        trinketId: trinketId,
        secondTrinketId: currentPrimary,
      };
    }

    this.commitProfile({
      ...p,
      gold: nextGold,
      ownedTrinkets: nextOwned,
      heroes: updatedHeroes,
    });
    this.audio.playCoin();
    return true;
  }

  public selectSkillChoice(classId: HeroClassId, tier: 1 | 2 | 3, choice: SkillChoice): void {
    const p = this.profile();
    const heroSave = p.heroes[classId];
    if (!heroSave) return;

    const key = tier === 1 ? 'tier1' : tier === 2 ? 'tier2' : 'tier3';
    this.commitProfile({
      ...p,
      heroes: {
        ...p.heroes,
        [classId]: {
          ...heroSave,
          skillChoices: {
            ...heroSave.skillChoices,
            [key]: choice,
          },
        },
      },
    });
    this.audio.playSelect();
  }

  public awardBattleRewards(
    stage: StageDefinition,
    goldEarned: number,
    xpEarned: number,
    stars: number,
    arenaKills = 0,
  ): { leveledUpHeroes: string[]; droppedRelicName: string | null } {
    const p = this.profile();
    const updatedHeroes = { ...p.heroes };
    const leveledUpHeroes: string[] = [];

    for (const id of this.allHeroIds) {
      const h = updatedHeroes[id];
      if (!h.unlocked || !h.inParty) continue;

      let level = h.level;
      let xp = h.xp + xpEarned;
      let leveled = false;

      while (level < 20 && xp >= this.xpForNextLevel(level)) {
        xp -= this.xpForNextLevel(level);
        level += 1;
        leveled = true;
      }

      if (leveled) {
        leveledUpHeroes.push(HERO_CATALOG[id].name);
      }

      updatedHeroes[id] = {
        ...h,
        level,
        xp,
      };
    }

    const completedSet = new Set(p.completedStageIds);
    if (!stage.isArena && stars > 0) {
      completedSet.add(stage.id);
    }

    const prevStars = p.stageStars[stage.id] ?? 0;

    // Check Boss / Arena Best-in-Slot Relic Drop!
    let droppedRelicName: string | null = null;
    const nextOwnedTrinkets = [...p.ownedTrinkets];
    if (stage.bossDropTrinketId) {
      const qualifies = stage.isArena ? arenaKills >= 15 : stars > 0;
      if (qualifies && !nextOwnedTrinkets.includes(stage.bossDropTrinketId)) {
        // 65% drop chance on 1-2 star clear, 100% guaranteed on 3-star clear or Arena 15+ kills!
        if (stars >= 3 || stage.isArena || Math.random() < 0.65) {
          nextOwnedTrinkets.push(stage.bossDropTrinketId);
          const relicDef = TRINKET_CATALOG.find((t) => t.id === stage.bossDropTrinketId);
          droppedRelicName = relicDef?.name ?? null;
        }
      }
    }

    this.commitProfile({
      ...p,
      gold: p.gold + goldEarned,
      completedStageIds: Array.from(completedSet),
      stageStars: {
        ...p.stageStars,
        [stage.id]: Math.max(prevStars, stars),
      },
      arenaBestKills: Math.max(p.arenaBestKills, arenaKills),
      ownedTrinkets: nextOwnedTrinkets,
      heroes: updatedHeroes,
    });

    return { leveledUpHeroes, droppedRelicName };
  }

  public computeHeroStats(classId: HeroClassId, save: HeroSaveState): ComputedHeroStats {
    const def = HERO_CATALOG[classId];
    const weaponBonus = WEAPON_TIERS[save.weaponTier - 1]?.bonusStat ?? 0;
    const armorBonus = ARMOR_TIERS[save.armorTier - 1]?.bonusStat ?? 0;
    const equippedTrinkets = [
      TRINKET_CATALOG.find((t) => t.id === save.trinketId),
      TRINKET_CATALOG.find((t) => t.id === save.secondTrinketId),
    ].filter((t): t is NonNullable<typeof t> => Boolean(t));

    let maxHp = def.baseHp + (save.level - 1) * def.hpPerLevel + armorBonus;
    let attack = def.baseAttack + (save.level - 1) * def.attackPerLevel + weaponBonus;
    let defense = def.baseDefense + (save.level - 1) * def.defensePerLevel;
    let attackIntervalSec = def.attackIntervalSec;
    let moveSpeed = def.moveSpeed;
    let critChance = 0.1;
    let lifesteal = 0;
    let cooldownMultiplier = 1.0;
    let regenPctPerSec = 0;

    // Apply unlocked skill tree passives & actives
    const activeSkills: SkillDefinition[] = [def.primaryActiveSkill];

    const chosenSkills: SkillDefinition[] = [];
    if (save.level >= 2) {
      chosenSkills.push(
        save.skillChoices.tier1 === 'A' ? def.skillTiers[0].optionA : def.skillTiers[0].optionB,
      );
    }
    if (save.level >= 4) {
      chosenSkills.push(
        save.skillChoices.tier2 === 'A' ? def.skillTiers[1].optionA : def.skillTiers[1].optionB,
      );
    }
    if (save.level >= 6) {
      chosenSkills.push(
        save.skillChoices.tier3 === 'A' ? def.skillTiers[2].optionA : def.skillTiers[2].optionB,
      );
    }

    for (const sk of chosenSkills) {
      if (sk.isActive) {
        activeSkills.push(sk);
      }
      // Passive stat modifiers
      switch (sk.id) {
        case 'fortified-plate':
        case 'crusader-aura':
        case 'iron-body':
          maxHp *= 1.25;
          defense += 5;
          break;
        case 'mana-barrier':
          maxHp *= 1.35;
          defense += 5;
          break;
        case 'spiked-shield':
          attack *= 1.3;
          critChance += 0.15;
          break;
        case 'unbreakable':
          regenPctPerSec += 0.03;
          break;
        case 'juggernaut':
        case 'leyline-focus':
          cooldownMultiplier *= 0.7;
          break;
        case 'blessed-touch':
        case 'arcane-mastery':
        case 'resonant-strings':
          attack *= 1.3;
          break;
        case 'swift-grace':
          attackIntervalSec *= 0.8;
          moveSpeed *= 1.15;
          break;
        case 'archangel':
          regenPctPerSec += 0.02;
          break;
        case 'lethal-precision':
          critChance += 0.25;
          break;
        case 'relentless-haste':
          attackIntervalSec *= 0.75;
          moveSpeed *= 1.2;
          break;
        case 'bloodthirst':
          lifesteal += 0.2;
          break;
        case 'archmage-fury':
          critChance += 0.25;
          attackIntervalSec *= 0.82;
          break;
        case 'zealotry':
        case 'tiger-fists':
          attack *= 1.26;
          attackIntervalSec *= 0.84;
          break;
        case 'avenging-wrath':
        case 'thousand-fists':
          cooldownMultiplier *= 0.75;
          critChance += 0.22;
          break;
        case 'allegro':
          attackIntervalSec *= 0.8;
          cooldownMultiplier *= 0.8;
          break;
        case 'virtuoso':
          critChance += 0.25;
          maxHp *= 1.25;
          break;
        case 'eagle-eye':
          attack *= 1.25;
          critChance += 0.2;
          break;
        case 'rapid-draw':
          attackIntervalSec *= 0.74;
          break;
        case 'windrunner':
          cooldownMultiplier *= 0.7;
          moveSpeed *= 1.2;
          break;
        case 'harmonic-flow':
          lifesteal += 0.18;
          regenPctPerSec += 0.02;
          break;
      }
    }

    for (const trinket of equippedTrinkets) {
      if (trinket.hpBonusPct) maxHp *= 1 + trinket.hpBonusPct;
      if (trinket.attackBonusPct) attack *= 1 + trinket.attackBonusPct;
      if (trinket.defenseBonus) defense += trinket.defenseBonus;
      if (trinket.critBonusPct) critChance += trinket.critBonusPct;
      if (trinket.cooldownReductionPct) cooldownMultiplier *= 1 - trinket.cooldownReductionPct;
      if (trinket.speedBonusPct) moveSpeed *= 1 + trinket.speedBonusPct;
      if (trinket.lifestealPct) lifesteal += trinket.lifestealPct;
      if (trinket.regenPct) regenPctPerSec += trinket.regenPct;
    }

    return {
      def,
      save,
      maxHp: Math.round(maxHp),
      attack: Math.round(attack),
      defense: Math.round(defense),
      attackIntervalSec: Number(attackIntervalSec.toFixed(2)),
      moveSpeed: Math.round(moveSpeed),
      critChance: Number(critChance.toFixed(2)),
      lifesteal: Number(lifesteal.toFixed(2)),
      cooldownMultiplier: Number(cooldownMultiplier.toFixed(2)),
      regenPctPerSec,
      activeSkills,
      weaponName: def.weaponNames[save.weaponTier - 1] ?? def.weaponNames[0],
      armorName: def.armorNames[save.armorTier - 1] ?? def.armorNames[0],
      nextLevelXp: this.xpForNextLevel(save.level),
    };
  }

  private commitProfile(updated: SaveProfile): void {
    this.profile.set(updated);
    this.storage.saveSlot(updated, this.activeSlot());
  }
}
