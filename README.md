# Battleheart

A tactical real-time line-drawing party RPG inspired by the original 2011 _Battleheart_, built as an offline-capable Angular Progressive Web Application (PWA) with replaceable SVG artwork, multi-slot LocalStorage saves, procedural Web Audio synthesis, and Gamepad/Controller support.

## Core Features

- **Real-Time Line-Drawing Tactical Combat**: Drag a path from any party Hero to an Enemy to focus attacks, drag from your Cleric to an Ally to lock healing beams, or drag to open ground to kite and dodge boss abilities.
- **8 Iconic Hero Classes**:
  - **Sir Brom (Stalwart Knight)** — Frontline plate tank with _Shield Wall_, _War Cry_, and _Whirlwind Cleave_.
  - **Sister Wynne (Devout Cleric)** — Dedicated healer with _Prayer of Mending_, _Barrier of Light_, and _Holy Nova_.
  - **Garrik (Shadow Rogue)** — High-crit assassin with _Assassinate_, _Blade Flurry_, and _Smoke Bomb_.
  - **Alden (Arcane Pyromancer)** — Elemental wizard with _Meteor Fireball_, _Frost Nova_, and _Chain Lightning_.
  - **Lady Valeria (Sunblood Paladin)** — Hybrid holy warrior with _Holy Radiance_, _Lay on Hands_, and _Hammer of Justice_.
  - **Milo (Wandering Bard)** — Melodic buffer with _Anthem of Valor_, _Ballad of Blades_, and _Siren Slumber_.
  - **Lyra (Wildwood Ranger)** — Long-range sharpshooter with _Piercing Snipe_, _Arrow Volley_, and _Pinning Frost Shot_.
  - **Kenji (Tempest Monk)** — Martial artist with _Dragon Kick_, _Quivering Palm_, and _Chi Cyclone_.
- **Armory, Trinkets & Academy Skill Trees**: Upgrade each hero's weapon and armor across 6 tiers, equip shared relic trinkets, and customize Tier 1 / 2 / 3 A/B specialization choices at Levels 2, 4, and 6.
- **7 Campaign Stages + Endless Arena**: Battle through goblin ambushes, shadowfang wolf packs, Grommok the Cave Troll, Empress Ssylthra the Gorgon Queen, and Ignis the Dread Wyrm, or test your endurance in the Doomvale Endless Arena.
- **Swappable SVG Art Pipeline**: All character and stage sprites live in `public/assets/svg/` (`heroes/*.svg`, `enemies/*.svg`, `backdrops/*.svg`) with a clean `0 0 120 120` viewBox so you can replace any placeholder SVG with your own custom artwork at any time.
- **Local Saves & Controller Support**: 3 local save slots with JSON import/export backup, keyboard hotkeys (`1`–`4`, `Q`/`W`, `Space`), and full standard Gamepad support (`LB`/`RB` to cycle heroes, stick + `A` to issue commands, `X`/`Y` for skills).

## Credits, Preservation & Disclaimer

This repository is an **unofficial, non-commercial fan recreation** of the original _Battleheart_ (2011), created by **Mika Mobile** (Noah Bordner & Kelly Reagan). All credit for the original game concept, class design, and line-drawing RPG mechanics belongs to **Mika Mobile**. Please support their work directly by purchasing [**Battleheart Legacy on Steam**](https://store.steampowered.com/app/666640/Battleheart_Legacy/).

- **Why this exists**: The original 2011 _Battleheart_ is no longer maintained or available on Google Play, and searching for it today mostly turns up untrustworthy, malware-ridden third-party APK sites. This clean-room web version (written from scratch in TypeScript with synthesized Web Audio and placeholder SVG graphics) was built for family nostalgia and game preservation so it can be played safely in a browser.
- **Non-Commercial & Takedown Policy**: No money is made from this project (zero ads, zero monetization, zero tracking), and no original code or binary assets from Mika Mobile are included. We are happy to modify, rename, or take this repository down immediately upon request by Mika Mobile or the rights holders.

## Development & Verification

```bash
npm ci
npm start                  # Dev server at http://localhost:4200/
npm test -- --watch=false  # Vitest unit tests
npm run lint               # Angular ESLint
npm run format:check       # Prettier check
npm run build:pages        # Production build + 404.html SPA fallback
npm run e2e                # Playwright multi-viewport smoke tests
```
