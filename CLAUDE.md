# CLAUDE.md — IPDF Combat Chronicle

## WHAT THIS PROJECT IS

A side-scrolling survival flight combat game built in Phaser 4. The player is an IPDF fighter pilot flying across a wide alien battlefield, destroying orc weapon emplacements and mining platforms. The game has grimdark arcade tone — Warhammer 40K meets classic arcade cabinet.

This project is being built by someone who is not a professional coder. All code must be clearly commented in plain language. When something could break or needs explanation, explain it. Do not assume technical knowledge.

## TECH STACK — DO NOT CHANGE THESE

- **Framework:** Phaser 4 (v4.0.0-rc.6, loaded from CDN — no npm, no bundler, no webpack)
- **CDN Script Tag:** `<script src="https://cdn.jsdelivr.net/npm/phaser@4.0.0-rc.6/dist/phaser.min.js"></script>`
- **Language:** Vanilla JavaScript (no TypeScript)
- **Art Style:** Vector art — clean shapes, smooth lines, flat or gradient fills, crisp edges. All art is drawn programmatically using Phaser Graphics objects or RenderTextures. No pixel art. No photorealistic textures.
- **Physics:** Phaser Arcade Physics
- **How to run:** Open index.html in a browser. That's it. No build step required.
- **Target resolution:** 1920x1080, responsive scaling to fit browser window, 16:9 aspect ratio

## PHASER 4 NOTES

Phaser 4 is an evolution of Phaser 3 — the core API is largely the same. Key differences to be aware of:
- Phaser 4 uses a brand-new WebGL renderer (called "Beam") with major performance improvements, especially on mobile (up to 16x gains)
- The internal API for scenes, game objects, physics, input, and cameras is the same as Phaser 3
- If you find Phaser 4-specific documentation is sparse, Phaser 3 documentation and examples are still applicable in most cases
- The camera system has been rewritten internally (matrix handling changed) but the public API (follow, lerp, bounds, deadzone) works the same way
- Some legacy features were removed from Phaser 3 (like Mesh game object) — avoid these

## PROJECT STRUCTURE

```
ipdf-combat-chronicle/
├── index.html
├── CLAUDE.md (this file)
├── src/
│   ├── main.js              (Phaser game config and boot)
│   ├── scenes/
│   │   └── BattleScene.js   (main gameplay scene)
│   ├── entities/
│   │   └── PlayerShip.js    (player ship class)
│   ├── systems/
│   │   └── InputManager.js  (keyboard + touch dual-stick controls)
│   └── utils/
│       └── VectorGraphics.js (helper functions for drawing vector shapes)
└── assets/                   (empty for now — all art is code-drawn)
```

## CRITICAL RULES — FOLLOW THESE EVERY TIME

1. **Never introduce a build system.** No npm, no webpack, no vite, no parcel. The game runs by opening index.html. Period.
2. **Never switch away from Phaser 4.** Do not suggest or migrate to any other framework. Do not downgrade to Phaser 3.
3. **Never use external image files unless specifically asked.** All visuals are drawn with Phaser Graphics in vector style.
4. **Keep code modular.** Each system (input, entities, scenes) stays in its own file. Do not dump everything into one giant file.
5. **Comment everything in plain language.** Every function, every significant block of code gets a comment explaining what it does and why.
6. **When fixing bugs, explain what went wrong and why the fix works.** Do not silently change things.
7. **Do not build features that haven't been requested yet.** Stay within the current phase. Do not add weapons, enemies, UI, or menus unless specifically asked.
8. **Test-friendly changes.** When making changes, explain how to verify they work (what to look for in the browser).
9. **Preserve what already works.** When adding new features or fixing bugs, do not break existing working functionality. If a change risks breaking something, flag it before making the change.

## CONTROLS

- **Keyboard:** WASD or Arrow Keys for 360-degree movement. Ship faces movement direction.
- **Touch (mobile/tablet):** Dual virtual joysticks. Left side = movement. Right side = aim direction (ship faces where right stick points). Joysticks appear at touch point as translucent circles and disappear on release.
- Both control schemes work simultaneously.

## CAMERA & WORLD

- Camera follows the player with smooth lerp (gradual catch-up, not instant snapping)
- The world is wide (10,000+ pixels) and tall (~3000 pixels)
- Player starts on the left side of the world
- World bounds prevent the player from flying off edges
- Parallax background layers (mountains/formations) at different scroll speeds for depth

## GAME LORE CONTEXT (for naming, flavor text, and UI later)

- **Setting:** An alien planet under siege by the Orc Collective
- **Player:** An IPDF fighter pilot searching for their captured sibling
- **Commander:** General Carl "Bad Brad" Bradley gives mission briefings
- **Resource:** Voidheart Ore — glowing purplish-red with gold veins, the strategic objective
- **Enemy:** The Orc Collective — biomechanical warriors, green skin with brass/steel augmentations, neon fur plume rank indicators
- **Ship classes:** Strikewing (assault/fast), Tempest (cruiser/balanced), Hammerfall (hulk/heavy)
- **Fleet registry format:** IPDF-[Class][Gen]-[Hull] "Call Sign" (e.g., IPDF-A7-042 "Dawn Breaker")

## SHIP CLASSES — STATS FOR LATER IMPLEMENTATION

### Strikewing (Assault Class A)
- Fastest, lightest armor, most maneuverable
- Weapons: PX-9 Plasma Array, CM-3 Cluster Missiles
- Defensive: FLR-2 Flair (breaks tracking locks) + OD-1 Overdrive (evasive dash, 60s cooldown)

### Tempest (Cruiser Class C)
- Balanced speed/armor/firepower
- Weapons: PX-9 Plasma Array, CM-3 Cluster Missiles, NF-1 Nightfall Bombs (carries 3)
- Defensive: FLR-2 Flair + PS-5 Pulse Shield (5-second barrier, 60s cooldown)

### Hammerfall (Hulk Class H)
- Slowest, heaviest armor, most destructive
- Weapons: PX-9 Plasma Array, CM-3 Cluster Missiles, NF-1 Nightfall Bombs (carries 6-12)
- Defensive: FLR-2 Flair + PF-1 PlanetFall (one-use full ordinance dump, devastating but leaves ship crippled)

## BUILD PHASES (for reference — only build what is currently requested)

- Phase 1: Project setup, player ship, flight controls, camera, atmosphere ✅
- Phase 2: Procedural terrain, Voidheart Ore veins, geological formations, full sky system
- Phase 3: PX-9 Plasma Array and CM-3 Cluster Missiles (weapons)
- Phase 4: Enemy ground structures (cannons, turrets, mining platforms, collision, damage)
- Phase 5: Ship class selection and defensive ability systems
- Phase 6: Nightfall Bomb gravity-arc mechanic
- Phase 7: Mission structure, briefings, objectives, UI, player/sibling name entry
- Phase 8: Mobile polish, screen scaling, visual effects, performance tuning
