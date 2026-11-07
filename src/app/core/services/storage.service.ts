import { Injectable } from '@angular/core';
import { HERO_CATALOG } from '../models/game-catalog';
import { HeroClassId, HeroSaveState, SaveProfile } from '../models/game.model';

const STORAGE_KEY_PREFIX = 'battleheart-save-slot-';
const ACTIVE_SLOT_KEY = 'battleheart-active-slot';

@Injectable({ providedIn: 'root' })
export class StorageService {
  public getActiveSlot(): number {
    if (typeof window === 'undefined') return 1;
    const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
    const num = Number(raw);
    return num === 1 || num === 2 || num === 3 ? num : 1;
  }

  public setActiveSlot(slot: number): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
  }

  public createDefaultProfile(): SaveProfile {
    const heroes = {} as Record<HeroClassId, HeroSaveState>;
    const starterUnlocked: HeroClassId[] = ['knight', 'cleric', 'rogue'];

    for (const classId of Object.keys(HERO_CATALOG) as HeroClassId[]) {
      const isStarter = starterUnlocked.includes(classId);
      heroes[classId] = {
        id: classId,
        unlocked: isStarter,
        inParty: isStarter,
        level: 1,
        xp: 0,
        weaponTier: 1,
        armorTier: 1,
        trinketId: null,
        skillChoices: {
          tier1: 'A',
          tier2: 'A',
          tier3: 'A',
        },
      };
    }

    return {
      version: 1,
      gold: 160, // Enough to hire Alden the Wizard right away or upgrade starter gear!
      completedStageIds: [],
      stageStars: {},
      arenaBestKills: 0,
      ownedTrinkets: [],
      heroes,
      updatedAt: Date.now(),
    };
  }

  public loadSlot(slot = this.getActiveSlot()): SaveProfile {
    if (typeof window === 'undefined') {
      return this.createDefaultProfile();
    }
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${slot}`);
      if (!raw) {
        return this.createDefaultProfile();
      }
      const parsed = JSON.parse(raw) as Partial<SaveProfile>;
      return this.sanitizeProfile(parsed);
    } catch {
      return this.createDefaultProfile();
    }
  }

  public saveSlot(profile: SaveProfile, slot = this.getActiveSlot()): void {
    if (typeof window === 'undefined') return;
    const updated: SaveProfile = {
      ...profile,
      updatedAt: Date.now(),
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${slot}`, JSON.stringify(updated));
  }

  public resetSlot(slot = this.getActiveSlot()): SaveProfile {
    const fresh = this.createDefaultProfile();
    this.saveSlot(fresh, slot);
    return fresh;
  }

  public exportProfileJson(profile: SaveProfile): string {
    return JSON.stringify(profile, null, 2);
  }

  public importProfileJson(jsonString: string, slot = this.getActiveSlot()): SaveProfile | null {
    try {
      const parsed = JSON.parse(jsonString) as Partial<SaveProfile>;
      if (!parsed || typeof parsed !== 'object' || !parsed.heroes) {
        return null;
      }
      const clean = this.sanitizeProfile(parsed);
      this.saveSlot(clean, slot);
      return clean;
    } catch {
      return null;
    }
  }

  private sanitizeProfile(raw: Partial<SaveProfile>): SaveProfile {
    const fallback = this.createDefaultProfile();
    const heroes = { ...fallback.heroes };

    if (raw.heroes && typeof raw.heroes === 'object') {
      for (const classId of Object.keys(HERO_CATALOG) as HeroClassId[]) {
        const savedHero = raw.heroes[classId];
        if (savedHero) {
          heroes[classId] = {
            id: classId,
            unlocked: Boolean(savedHero.unlocked),
            inParty: Boolean(savedHero.inParty),
            level: Math.max(1, Math.min(20, Number(savedHero.level) || 1)),
            xp: Math.max(0, Number(savedHero.xp) || 0),
            weaponTier: Math.max(1, Math.min(6, Number(savedHero.weaponTier) || 1)),
            armorTier: Math.max(1, Math.min(6, Number(savedHero.armorTier) || 1)),
            trinketId: savedHero.trinketId ?? null,
            skillChoices: {
              tier1: savedHero.skillChoices?.tier1 === 'B' ? 'B' : 'A',
              tier2: savedHero.skillChoices?.tier2 === 'B' ? 'B' : 'A',
              tier3: savedHero.skillChoices?.tier3 === 'B' ? 'B' : 'A',
            },
          };
        }
      }
    }

    // Guarantee at least 1 hero is unlocked and in party
    const partyCount = Object.values(heroes).filter((h) => h.unlocked && h.inParty).length;
    if (partyCount === 0) {
      heroes.knight.unlocked = true;
      heroes.knight.inParty = true;
    }

    return {
      version: 1,
      gold: Math.max(0, Number(raw.gold ?? fallback.gold)),
      completedStageIds: Array.isArray(raw.completedStageIds) ? raw.completedStageIds : [],
      stageStars: raw.stageStars && typeof raw.stageStars === 'object' ? { ...raw.stageStars } : {},
      arenaBestKills: Math.max(0, Number(raw.arenaBestKills) || 0),
      ownedTrinkets: Array.isArray(raw.ownedTrinkets) ? raw.ownedTrinkets : [],
      heroes,
      updatedAt: Number(raw.updatedAt) || Date.now(),
    };
  }
}
