export type HeroClassId =
  'knight' | 'cleric' | 'rogue' | 'wizard' | 'paladin' | 'bard' | 'ranger' | 'monk';

export type HeroRole = 'tank' | 'healer' | 'melee-dps' | 'ranged-dps' | 'support';

export type EnemyId =
  | 'goblin-scout'
  | 'goblin-archer'
  | 'goblin-shaman'
  | 'orc-brute'
  | 'skeleton-warrior'
  | 'dark-necromancer'
  | 'dire-wolf'
  | 'cave-troll'
  | 'gorgon-queen'
  | 'dragon-whelp';

export type BackdropId = 'meadow' | 'forest' | 'crypt' | 'throne';

export type SkillChoice = 'A' | 'B';

export interface SkillPair {
  tier: 1 | 2 | 3; // Unlocked at Level 2, 4, 6
  unlockLevel: number;
  optionA: SkillDefinition;
  optionB: SkillDefinition;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
  cooldownSec?: number;
  effectType:
    | 'shield-wall'
    | 'war-cry'
    | 'cleave'
    | 'group-heal'
    | 'divine-shield'
    | 'holy-nova'
    | 'sneak-attack'
    | 'smoke-bomb'
    | 'blade-flurry'
    | 'fireball'
    | 'blizzard'
    | 'chain-lightning'
    | 'consecration'
    | 'lay-on-hands'
    | 'Smite'
    | 'song-of-vigor'
    | 'song-of-war'
    | 'lullaby'
    | 'multishot'
    | 'snipe'
    | 'frost-arrow'
    | 'flying-kick'
    | 'palm-strike'
    | 'chi-burst'
    | 'passive';
}

export interface EquipmentTier {
  tier: number;
  name: string;
  bonusStat: number;
  cost: number;
}

export interface HeroClassDefinition {
  id: HeroClassId;
  name: string;
  title: string;
  role: HeroRole;
  description: string;
  svgAsset: string;
  accentColor: string;
  hireCost: number;
  baseHp: number;
  hpPerLevel: number;
  baseAttack: number;
  attackPerLevel: number;
  baseDefense: number;
  defensePerLevel: number;
  attackRange: number; // in arena % (e.g., 10 = melee, 42 = ranged)
  attackIntervalSec: number;
  moveSpeed: number; // arena % per second
  threatMultiplier: number;
  primaryActiveSkill: SkillDefinition;
  skillTiers: [SkillPair, SkillPair, SkillPair];
  weaponNames: string[];
  armorNames: string[];
}

export interface HeroSaveState {
  id: HeroClassId;
  unlocked: boolean;
  inParty: boolean;
  level: number;
  xp: number;
  weaponTier: number; // 1 to 6
  armorTier: number; // 1 to 6
  trinketId: string | null;
  skillChoices: {
    tier1: SkillChoice;
    tier2: SkillChoice;
    tier3: SkillChoice;
  };
}

export interface TrinketDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  hpBonusPct?: number;
  attackBonusPct?: number;
  cooldownReductionPct?: number;
  speedBonusPct?: number;
  lifestealPct?: number;
}

export interface EnemyDefinition {
  id: EnemyId;
  name: string;
  svgAsset: string;
  isBoss: boolean;
  isHealer?: boolean;
  isRanged?: boolean;
  maxHp: number;
  attack: number;
  defense: number;
  attackRange: number;
  attackIntervalSec: number;
  moveSpeed: number;
  scale: number;
  specialAbility?: 'ground-slam' | 'petrify-gaze' | 'fire-breath' | 'dark-mend' | 'enrage';
  specialIntervalSec?: number;
}

export interface WaveSpawn {
  enemyId: EnemyId;
  count: number;
  delaySec: number;
}

export interface StageDefinition {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  backdrop: BackdropId;
  recommendedLevel: number;
  goldReward: number;
  xpReward: number;
  isArena?: boolean;
  waves: WaveSpawn[][];
  mapX: number; // percentage on world map
  mapY: number;
}

export interface SaveProfile {
  version: number;
  gold: number;
  completedStageIds: string[];
  stageStars: Record<string, number>;
  arenaBestKills: number;
  ownedTrinkets: string[];
  heroes: Record<HeroClassId, HeroSaveState>;
  updatedAt: number;
}

// --- Real-Time Battlefield Simulation Entities ---

export interface CombatUnit {
  uid: string;
  isHero: boolean;
  classId?: HeroClassId;
  enemyId?: EnemyId;
  name: string;
  svgAsset: string;
  accentColor: string;
  role: HeroRole | 'enemy';
  isBoss: boolean;
  scale: number;

  // Coordinates in arena space: x in [6, 94], y in [34, 88]
  x: number;
  y: number;
  facing: 'left' | 'right';

  // Command & AI State
  targetUnitUid: string | null;
  moveDestination: { x: number; y: number } | null;

  // Stats
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  attackRange: number;
  attackIntervalSec: number;
  attackTimer: number;
  moveSpeed: number;
  critChance: number;
  lifesteal: number;
  threat: number;
  threatMultiplier: number;

  // Active Skills (for Heroes)
  skills: {
    def: SkillDefinition;
    cooldownRemaining: number;
    maxCooldown: number;
  }[];

  // Boss/Special Timer (for Enemies)
  specialAbility?: EnemyDefinition['specialAbility'];
  specialTimer: number;
  specialIntervalSec: number;

  // Status Effects
  shieldTimer: number; // 65% damage reduction
  invulnerableTimer: number;
  stunTimer: number;
  slowTimer: number;
  hasteTimer: number;
  attackBuffTimer: number;
  poisonTimer: number;
  poisonDps: number;
  regenTimer: number;
  regenHps: number;

  // Animation feedback timers
  attackAnimTimer: number;
  hurtAnimTimer: number;
}

export interface Projectile {
  id: string;
  fromHero: boolean;
  x: number;
  y: number;
  targetUid: string;
  targetX: number;
  targetY: number;
  speed: number;
  color: string;
  size: number;
  isHeal: boolean;
  value: number;
  aoeRadius?: number;
  slowSec?: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  isCrit: boolean;
  life: number;
  maxLife: number;
}

export interface ArenaRingEffect {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}
