# Execution Plan: Original Battleheart Recreate (Angular PWA)

- **Date**: 2026-11-06
- **Status**: Completed
- **Owner**: Antigravity

## 1. Goal & Objectives

Recreate the original _Battleheart_ (2011 tactical real-time party RPG) inside the `battleheart` repository derived from `angular-pwa-starter`. Strip starter boilerplate and present an immediate, nostalgic, responsive tactical RPG featuring drag-and-drop line-drawing command paths, 8 iconic hero classes with level-up skill trees, Merchant/Armory gear tiers, Tavern hiring, World Map stages, Endless Arena mode, bespoke replaceable SVG assets, procedural Web Audio synthesis, local storage persistence, and full Gamepad/Keyboard/Touch/Mouse support.

## 2. Context & Background

- The user requested recreating the original _Battleheart_ (not _Battleheart Legacy_) using generated placeholder SVG assets (structured cleanly so the user can later swap in custom SVGs), local game saves, controller support, and stripped-down starter boilerplate.
- Following the Simplicity Ladder in `GEMINI.md`: the original _Battleheart_ is a 2D chibi side-perspective diorama battlefield. Native SVG + HTML5 rendering covers the entire visual and interactive experience cleanly without needing `three.js` or new npm dependencies.

## 3. Proposed Changes

- **Assets (`public/assets/svg/`)**:
  - Generated standalone, replaceable SVG files for 8 hero classes (`knight`, `cleric`, `rogue`, `wizard`, `paladin`, `bard`, `ranger`, `monk`), 10 enemy types (`goblin-scout`, `goblin-archer`, `goblin-shaman`, `orc-brute`, `skeleton-warrior`, `dark-necromancer`, `dire-wolf`, `cave-troll`, `gorgon-queen`, `dragon-whelp`), and 4 battlefield stage backdrops (`meadow`, `forest`, `crypt`, `throne`).
- **Core Models (`src/app/core/models/game.model.ts`)**:
  - Defined Hero Classes, Skills (Active + Tier 1/2/3 Passives), Equipment Tiers (Weapons, Armor, Trinkets), Enemies, Campaign Stages, Arena Waves, Combat Units, Projectiles, Visual Effects, and Save State schema.
- **Core Services (`src/app/core/services/`)**:
  - `storage.service.ts`: LocalStorage save/load, slot management, JSON import/export, schema validation.
  - `audio.service.ts`: Zero-dependency Web Audio API synthesizer for sword slashes, healing chimes, fireballs, arrows, level-up fanfares, boss roars, and UI feedback.
  - `gamepad.service.ts`: Standard Gamepad API polling (`requestAnimationFrame`), hero cycling (`LB`/`RB`), reticle movement (Left/Right Stick / D-Pad), command assignment (`A`), skill activation (`X`/`Y`), and pause (`Start`).
  - `game-state.service.ts`: Roster management, party selection (up to 4 active heroes), equipment upgrades, skill tree choices, campaign progression, and gold economy.
  - `combat.service.ts`: Real-time 60fps tactical simulation loop, drag-line vector movement, aggro/threat targeting, melee/ranged/healer AI, skill cooldowns, buffs/debuffs, wave spawning, and victory/defeat resolution.
- **UI & Views (`src/app/home/`)**:
  - Stripped starter marketing header/footer from `src/app/app.html` and `src/app/app.ts` so the game fills the viewport with a sleek top HUD bar.
  - Implemented World Map, Tavern, Armory, Academy (Skill Tree), and Real-Time SVG/DOM Battlefield Arena with drag-line SVG path rendering.

## 4. Implementation Steps

- [x] **Step 1: Repository Setup**: Create `cboler/battleheart` from `cboler/angular-pwa-starter` via `gh` and install dependencies.
- [x] **Step 2: Generate Modular SVG Assets**: Create replaceable SVG files under `public/assets/svg/` for heroes, enemies, and backdrops.
- [x] **Step 3: Implement Domain Models & Data Catalog**: Create `game.model.ts` and `game-catalog.ts` with 8 classes, skills, items, enemies, and stages.
- [x] **Step 4: Implement Core Services**: Create `AudioService`, `StorageService`, `GamepadService`, `GameStateService`, and `CombatService`.
- [x] **Step 5: Build Game UI & Battlefield Component**: Replace `HomeComponent` with the Battleheart game experience and strip starter boilerplate from `App`.
- [x] **Step 6: Unit & E2E Tests**: Write unit tests for game state, combat mechanics, and storage; update Playwright multi-viewport smoke tests.
- [x] **Step 7: Quality Gates & Real Browser Verification**: Run `npm run format`, `npm run lint`, `npm test`, `npm run build:pages`, `npm run e2e`, and inspect in browser.

## 5. Verification Plan

- [x] Unit tests pass: `npm test -- --watch=false`
- [x] Lint analysis passes: `npm run lint`
- [x] Formatting passes: `npm run format:check`
- [x] Multi-viewport E2E smoke tests pass: `npm run e2e`
- [x] Real browser verification across viewports

## 6. Risks, Ceilings & Rollback

- **Ceiling / Known Limitation**: Combat target scanning uses an $O(N \times M)$ loop over party heroes ($\le 4$) and active monsters ($\le 20$), which runs in microseconds per frame. If monster counts ever exceed 500+, upgrade to a spatial hash grid.
- **Rollback Strategy**: Revert commits or reset branch to template baseline if build or deployment scripts break.

