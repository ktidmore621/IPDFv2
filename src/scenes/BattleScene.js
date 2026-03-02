/**
 * BattleScene.js — Main Gameplay Scene
 *
 * This is where the game happens. It creates:
 *   - The game world (12,000 x 3,000 pixels)
 *   - A rich alien sky with nebula clouds and atmospheric haze
 *   - Multi-layer parallax mountains for depth
 *   - Procedurally generated terrain with geological layers
 *   - Voidheart Ore veins glowing inside the rock
 *   - Geological formations (spires, arches, mesas, crystals)
 *   - The player ship
 *   - The input manager
 *   - The weapon manager (PX-9 Plasma Array + CM-3 Cluster Missiles)
 *   - The camera that follows the player
 *
 * Think of a Scene like a "screen" or "level" in the game.
 * BattleScene is the main flight-and-combat screen.
 *
 * Layer order (back to front):
 *   sky/nebula → stars → distant mountains → mid mountains →
 *   near mountains → terrain + formations → player ship → UI overlay
 */

class BattleScene extends Phaser.Scene {

    constructor() {
        // The scene key — used to start/switch to this scene
        super({ key: 'BattleScene' });
    }

    /**
     * preload() is called before create(). This is where we load external
     * assets like images, audio, etc. All three ship sprites are loaded here
     * so they're ready when the scene starts. Strikewing is the default ship
     * until ship selection is added in Phase 5.
     */
    preload() {
        // Player ship sprites
        this.load.image('strikewing', 'assets/sprites/strikewing.png');
        this.load.image('tempest', 'assets/sprites/tempest.png');
        this.load.image('hammerfall', 'assets/sprites/hammerfall.png');

        // Enemy structure sprites (Phase 4 — replaces code-drawn visuals)
        this.load.image('turret', 'assets/sprites/turret.png');
        this.load.image('turret_elite', 'assets/sprites/turret_elite.png');
        this.load.image('double_cannon', 'assets/sprites/double_cannon.png');
        this.load.image('missile_silo', 'assets/sprites/missile_silo.png');
        this.load.image('mining_platform', 'assets/sprites/mining_platform.png');
        this.load.image('refinery', 'assets/sprites/refinery.png');

        // Orc soldier sprites (two variants for visual variety)
        this.load.image('orc_soldier', 'assets/sprites/orc_soldier.png');
        this.load.image('orc_soldier_alt', 'assets/sprites/orc_soldier_alt.png');
        this.load.image('orc_guard', 'assets/sprites/orc_guard.png');
    }

    /**
     * create() is called once when the scene starts.
     * This is where we build everything: background, terrain, player, camera, etc.
     */
    create() {
        // =========================================================
        // WORLD SETUP
        // =========================================================

        // Define the world size — how big the playable area is.
        // The player can fly anywhere within these bounds.
        this.worldWidth = 12000;   // Wide — lots of horizontal space to fly
        this.worldHeight = 3000;   // Tall enough for vertical maneuvering

        // Tell the physics engine about the world boundaries
        this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

        // --- Debug: log the device's actual max texture size ---
        // This helps diagnose mobile black screen issues. Mobile GPUs
        // often cap at 4096px, so any Graphics or texture wider than that
        // will silently fail, causing a black screen.
        try {
            const gl = this.game.renderer.gl;
            if (gl) {
                console.log('Max texture size:', gl.getParameter(gl.MAX_TEXTURE_SIZE));
            }
        } catch (e) {
            console.log('Could not query max texture size');
        }

        // =========================================================
        // SKY — Rich alien atmosphere with nebula and haze
        // Wrapped in try/catch so if sky fails, game still loads.
        // =========================================================
        try {
            this._createSky();
        } catch (e) {
            console.error('Sky creation failed:', e);
        }

        // =========================================================
        // STARS — Scattered across the upper sky
        // =========================================================
        try {
            this._createStars();
        } catch (e) {
            console.error('Stars creation failed:', e);
        }

        // =========================================================
        // PARALLAX MOUNTAINS — Background depth layers
        // =========================================================
        try {
            this._createMountainLayers();
        } catch (e) {
            console.error('Mountain layers creation failed:', e);
        }

        // =========================================================
        // ATMOSPHERIC HAZE — Horizon line effect
        // =========================================================
        try {
            this._createAtmosphericHaze();
        } catch (e) {
            console.error('Atmospheric haze creation failed:', e);
        }

        // =========================================================
        // TERRAIN — Procedurally generated alien ground
        // =========================================================
        try {
            this._createTerrain();
        } catch (e) {
            console.error('Terrain creation failed:', e);
        }

        // =========================================================
        // GEOLOGICAL FORMATIONS — Spires, arches, mesas, crystals
        // =========================================================
        try {
            this._createFormations();
        } catch (e) {
            console.error('Formations creation failed:', e);
        }

        // =========================================================
        // PLAYER SHIP (Phase 1 — must work, no try/catch)
        // =========================================================

        // Create the player near the left side of the world, at low altitude
        // so the ground and nearest mountain layers are visible on screen.
        // 0.78 puts the ship low enough that the camera view (1080px tall)
        // shows the ground (~80px from the bottom of the screen) and the
        // near mountain formations above, making it feel like a low flyover.
        const startX = 400;
        const startY = this.worldHeight * 0.78;
        this.player = new PlayerShip(this, startX, startY);

        // =========================================================
        // INPUT MANAGER
        // =========================================================

        // Create the input system — it reads keyboard and touch every frame
        this.inputManager = new InputManager(this);

        // =========================================================
        // WEAPON MANAGER (Phase 3 — PX-9 Plasma + CM-3 Cluster Missiles)
        // =========================================================

        // Create the weapon system — it manages projectile pools, firing,
        // and cleanup. Needs references to the scene and player ship.
        this.weaponManager = new WeaponManager(this, this.player);

        // =========================================================
        // CAMERA SETUP
        // =========================================================

        // The camera is the "window" into the world. It follows the player.
        const cam = this.cameras.main;

        // Set the camera bounds to match the world — the camera can't
        // scroll past the edges of the world.
        cam.setBounds(0, 0, this.worldWidth, this.worldHeight);

        // Tell the camera to follow the player's container.
        // The lerp values (0.1) control how "smoothly" the camera catches up.
        // Lower = smoother/slower trailing, Higher = snappier. 1.0 = instant.
        // 0.1 gives a nice cinematic chase-camera feel — the ship leads slightly
        // and the camera gracefully catches up, creating a sense of speed.
        //
        // IMPORTANT: No dead zone is set. A dead zone (even a small one) creates
        // a "band" where the ship moves but the camera doesn't, which combined
        // with lerp causes micro-hesitations that feel like inconsistent speed.
        // With no dead zone, the camera is ALWAYS smoothly chasing the ship at
        // exactly the same rate, everywhere in the world.
        cam.startFollow(this.player.getGameObject(), false, 0.1, 0.1);

        // =========================================================
        // COMBAT MANAGER (Phase 4 — handles all collision/damage)
        // =========================================================
        this.combatManager = new CombatManager(this, this.player, this.weaponManager);

        // =========================================================
        // ENEMY STRUCTURES & ATMOSPHERIC ORCS (Phase 4)
        // =========================================================
        try {
            this._createEnemies();
        } catch (e) {
            console.error('Enemy creation failed:', e);
        }

        // =========================================================
        // ATMOSPHERIC ORC SOLDIERS (Phase 4 — visual only)
        // =========================================================
        try {
            this._createOrcSoldiers();
        } catch (e) {
            console.error('Orc soldier creation failed:', e);
        }

        // =========================================================
        // HUD — Health bar, objective counter (Phase 4)
        // =========================================================
        this._createHUD();

        // =========================================================
        // AMBIENT ATMOSPHERE — Slight vignette/tint
        // =========================================================
        // Add a very subtle dark overlay at the edges for atmosphere.
        // This is a cosmetic touch — makes it feel like deep space.
        this._createAtmosphereOverlay();

        // =========================================================
        // MISSION STATE (Phase 4)
        // =========================================================
        this.missionComplete = false;
    }

    // =====================================================================
    // SKY SYSTEM — Rich alien atmosphere
    // =====================================================================

    /**
     * Creates the sky gradient and nebula clouds.
     * The gradient goes from deep purple at the top to dark amber near
     * the bottom, with subtle color band shifts for richness.
     * Nebula clouds are large, soft, translucent shapes in the upper sky.
     */
    _createSky() {
        const gameHeight = this.scale.height;
        const gameWidth = this.scale.width;

        // The sky is one screen-sized Graphics object (1920x1080 — well within
        // mobile GPU limits). It's fixed to the camera via scrollFactor(0).
        //
        // NOTE: We previously tried baking this into a RenderTexture for
        // performance, but Phaser 4's Beam renderer can't capture unrendered
        // Graphics via RenderTexture.draw() during create(). The Graphics
        // commands are deferred, so the RT ends up empty (black). Keeping
        // the Graphics object directly works reliably.
        const skyG = this.add.graphics();
        skyG.setDepth(-100);
        skyG.setScrollFactor(0);  // Fixed to camera — always fills the screen

        // --- Sky gradient ---
        // A rich gradient from near-black purple at top to dark amber at bottom.
        for (let y = 0; y < gameHeight; y++) {
            const t = y / gameHeight;

            // Three-stage gradient for richer color:
            //   Top (t=0):    deep dark purple-black (0x08061a)
            //   Middle (t=0.5): dark blue-purple (0x140a20)
            //   Bottom (t=1):  dark amber-brown (0x1a1008)
            let r, g, b;

            if (t < 0.5) {
                // Top half: dark purple-black to blue-purple
                const s = t / 0.5;
                r = Math.floor(8 + s * 12);
                g = Math.floor(6 + s * 4);
                b = Math.floor(26 + s * 6);
            } else {
                // Bottom half: blue-purple to dark amber
                const s = (t - 0.5) / 0.5;
                r = Math.floor(20 + s * 6);
                g = Math.floor(10 - s * 2);
                b = Math.floor(32 - s * 24);
            }

            // Add subtle color band ripples — small sine wave shifts
            // that create barely-visible horizontal bands in the gradient
            const bandShift = Math.sin(t * 20) * 2 + Math.sin(t * 7) * 3;
            r = Math.max(0, Math.min(255, r + Math.floor(bandShift)));

            const color = (r << 16) | (Math.max(0, g) << 8) | Math.max(0, b);
            skyG.fillStyle(color, 1);
            skyG.fillRect(0, y, gameWidth, 1);
        }

        // --- Nebula clouds (drawn on the same sky Graphics) ---
        // 3-5 large, soft, translucent cloud shapes in the upper sky.
        const nebulaColors = [
            { color: 0x4a1a4a, alpha: 0.08 },  // Deep purple
            { color: 0x6b2a1a, alpha: 0.06 },  // Dark red-brown
            { color: 0x3a2a10, alpha: 0.07 },  // Toxic amber
            { color: 0x2a1a3a, alpha: 0.10 },  // Violet
            { color: 0x5a1a2a, alpha: 0.05 }   // Crimson
        ];

        const nebulaCount = 3 + Math.floor(Math.random() * 3);
        for (let n = 0; n < nebulaCount; n++) {
            const nColor = nebulaColors[n % nebulaColors.length];
            const centerX = gameWidth * 0.15 + Math.random() * gameWidth * 0.7;
            const centerY = gameHeight * 0.1 + Math.random() * gameHeight * 0.4;
            const blobCount = 4 + Math.floor(Math.random() * 4);
            for (let b = 0; b < blobCount; b++) {
                const bx = centerX + (Math.random() - 0.5) * 200;
                const by = centerY + (Math.random() - 0.5) * 100;
                const bw = 100 + Math.random() * 250;
                const bh = 60 + Math.random() * 120;
                skyG.fillStyle(nColor.color, nColor.alpha);
                skyG.fillEllipse(bx, by, bw, bh);
            }
        }
    }

    /**
     * Creates stars scattered across the upper sky.
     * Includes the original stars plus a few brighter ones with
     * a subtle twinkle effect (slow alpha oscillation).
     */
    _createStars() {
        // --- Regular stars ---
        // Scattered across the sky. Small dots at varying brightness.
        // Very slow scroll factor (0.05) — they barely move.
        const starsGraphic = this.add.graphics();
        starsGraphic.setDepth(-90);
        starsGraphic.setScrollFactor(0.05);

        // Seed a bunch of stars across the world width
        for (let i = 0; i < 300; i++) {
            const sx = Math.random() * this.worldWidth;
            const sy = Math.random() * this.worldHeight * 0.6;  // Stars only in upper 60%
            const size = 0.5 + Math.random() * 1.5;
            const alpha = 0.3 + Math.random() * 0.7;
            VectorGraphics.drawStar(starsGraphic, sx, sy, size, alpha);
        }

        // --- Bright twinkling stars ---
        // A few larger, brighter stars that slowly pulse in brightness.
        // Each is its own Graphics object so it can be individually tweened.
        // Reduced count for mobile performance (was 8-12, now 3-4).
        const twinkleCount = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < twinkleCount; i++) {
            const star = this.add.graphics();
            star.setDepth(-89);
            star.setScrollFactor(0.05);

            const sx = Math.random() * this.worldWidth;
            const sy = Math.random() * this.worldHeight * 0.5;
            const size = 1.5 + Math.random() * 2;

            // Draw a brighter star with more glow
            star.fillStyle(0xffffff, 0.2);
            star.fillCircle(sx, sy, size * 3);
            star.fillStyle(0xeeeeff, 0.5);
            star.fillCircle(sx, sy, size * 1.5);
            star.fillStyle(0xffffff, 0.9);
            star.fillCircle(sx, sy, size);

            // Twinkle animation — slow alpha pulse
            this.tweens.add({
                targets: star,
                alpha: { from: 0.5, to: 1.0 },
                duration: 1000 + Math.random() * 3000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: Math.random() * 2000
            });
        }
    }

    // =====================================================================
    // PARALLAX MOUNTAINS — Background depth layers
    // =====================================================================

    /**
     * Creates the three parallax mountain layers.
     * These sit between the sky and the terrain, at different scroll speeds.
     * They should visually be on TOP of the terrain (in the mid-ground).
     */
    _createMountainLayers() {
        // --- Layer 1: Distant mountains (far background) ---
        // Very dark, barely visible silhouettes. Slow scroll.
        this._createMountainLayer({
            depth: -80,
            scrollFactor: 0.1,
            color: 0x0d0d1a,
            alpha: 0.8,
            yOffset: 0.55,         // Start 55% down the world
            heightScale: 0.35,     // Take up to 35% of world height
            count: 4,
            minWidth: 1500,
            maxWidth: 3000
        });

        // --- Layer 2: Mid mountains ---
        // Slightly brighter, medium scroll speed
        this._createMountainLayer({
            depth: -70,
            scrollFactor: 0.25,
            color: 0x141428,
            alpha: 0.9,
            yOffset: 0.6,
            heightScale: 0.3,
            count: 5,
            minWidth: 1500,
            maxWidth: 3000
        });

        // --- Layer 3: Near formations ---
        // Most visible silhouettes, faster scroll
        this._createMountainLayer({
            depth: -60,
            scrollFactor: 0.4,
            color: 0x1a1a32,
            alpha: 1.0,
            yOffset: 0.65,
            heightScale: 0.25,
            count: 6,
            minWidth: 1000,
            maxWidth: 2500
        });
    }

    /**
     * Creates a single layer of mountain/formation silhouettes.
     *
     * @param {object} config — Settings for this mountain layer:
     *   - depth: z-order (lower = further back)
     *   - scrollFactor: parallax speed (0 = fixed, 1 = normal)
     *   - color: fill color (hex)
     *   - alpha: opacity
     *   - yOffset: vertical position as fraction of world height (0 = top, 1 = bottom)
     *   - heightScale: max mountain height as fraction of world height
     *   - count: how many mountain formations to place
     *   - minWidth / maxWidth: size range for each formation
     */
    _createMountainLayer(config) {
        const totalWidth = this.worldWidth * 1.2;  // Slightly wider than world for coverage
        const spacing = totalWidth / config.count;

        for (let i = 0; i < config.count; i++) {
            // Randomize width within the configured range
            const mWidth = config.minWidth + Math.random() * (config.maxWidth - config.minWidth);
            const mHeight = this.worldHeight * config.heightScale * (0.5 + Math.random() * 0.5);

            // Position along the world width with some randomness
            const mX = i * spacing + (Math.random() - 0.5) * spacing * 0.3;
            const mY = this.worldHeight * config.yOffset;

            const mountain = VectorGraphics.drawMountainSilhouette(
                this, mWidth, mHeight, config.color, config.alpha
            );
            mountain.setPosition(mX, mY);
            mountain.setDepth(config.depth);
            mountain.setScrollFactor(config.scrollFactor);
        }
    }

    // =====================================================================
    // ATMOSPHERIC HAZE — Horizon effect
    // =====================================================================

    /**
     * Creates a thin atmospheric haze band near the horizon line
     * where sky meets ground. Suggests the planet has an atmosphere.
     * This is a translucent horizontal band that scrolls with the
     * near-mountains parallax layer so it feels like it's at the
     * right depth.
     */
    _createAtmosphericHaze() {
        // The haze is capped at 4096px wide to stay within mobile GPU texture
        // limits (the old 18,000px width caused silent GPU failure on mobile).
        // With scrollFactor 0.5, 4096px provides enough coverage.
        const hazeWidth = 4096;
        const hazeHeight = 140;
        const hazeY = this.worldHeight * 0.68;

        // Draw the haze directly on a Graphics object (no RT baking —
        // see _createSky comment for why RT baking fails in Phaser 4).
        // Position it at (0, hazeY) so the bands appear at the right
        // world height. Uses 4px-tall bands for efficiency.
        const hazeG = this.add.graphics();
        hazeG.setDepth(-55);               // Between near mountains and terrain
        hazeG.setScrollFactor(0.5, 1);     // Slow horizontal scroll, normal vertical
        hazeG.setPosition(0, hazeY);       // Place at the horizon line

        for (let i = 0; i < hazeHeight; i += 4) {
            const t = i / hazeHeight;
            // Bell curve opacity: peaks in the middle, fades at edges
            const alpha = 0.08 * Math.sin(t * Math.PI);
            hazeG.fillStyle(0x2a1a20, alpha);
            hazeG.fillRect(0, i, hazeWidth, 4);  // 4px tall bands
        }
    }

    // =====================================================================
    // TERRAIN — Procedurally generated alien ground
    // =====================================================================

    /**
     * Generates and draws the procedural terrain using TerrainGenerator.
     * This replaces the old flat ground from Phase 1 with a rich,
     * uneven landscape with geological layers and glowing ore veins.
     */
    _createTerrain() {
        // The "base" Y position for the ground — where it averages out to.
        // This is roughly where the old flat ground was.
        const groundBaseY = this.worldHeight * 0.82;

        // Step 1: Generate the height map (array of Y values across world width)
        this.heightMap = TerrainGenerator.generateHeightMap(
            this.worldWidth, this.worldHeight, groundBaseY
        );

        // Step 2: Draw the rock body (main terrain mass with geological striations)
        this.rockBody = TerrainGenerator.createRockBody(
            this, this.heightMap, this.worldWidth, this.worldHeight
        );

        // Step 3: Draw the Voidheart Ore veins (before surface crust so some
        // veins peek through the crust edge)
        this.oreVeins = TerrainGenerator.createVoidheartOreVeins(
            this, this.heightMap, this.worldWidth, this.worldHeight
        );

        // Step 4: Draw the surface crust (thin top layer with rough edge)
        this.surfaceCrust = TerrainGenerator.createSurfaceCrust(
            this, this.heightMap, this.worldWidth
        );
    }

    // =====================================================================
    // GEOLOGICAL FORMATIONS — Natural rock features
    // =====================================================================

    /**
     * Generates geological formations (spires, arches, mesas, crystals)
     * scattered across the terrain surface using FormationGenerator.
     */
    _createFormations() {
        // Guard: formations need the height map from terrain generation.
        // If terrain creation failed, skip formations too.
        if (!this.heightMap) {
            console.warn('Skipping formations — no heightMap available (terrain may have failed)');
            return;
        }

        // Generate all formations. They'll be placed at the correct
        // terrain surface height automatically.
        this.formations = FormationGenerator.generateFormations(
            this, this.heightMap, this.worldWidth
        );
    }

    // =====================================================================
    // ENEMY STRUCTURES (Phase 4) — Placed on terrain in clusters
    // =====================================================================

    /**
     * Creates all enemy structures for Level 1.
     * Layout: quiet zone on left, clusters of enemies in middle/right,
     * refinery at far right as final objective.
     *
     * Level 1 limits: max 6 weapon emplacements, 1-3 mining platforms, 1 refinery.
     */
    _createEnemies() {
        if (!this.heightMap) {
            console.warn('Skipping enemies — no heightMap available');
            return;
        }

        this.enemyStructures = [];

        // Helper to get terrain Y at a given X position
        const getGroundY = (x) => {
            const ix = Math.floor(Math.min(Math.max(x, 0), this.worldWidth - 1));
            return this.heightMap[ix];
        };

        // --- OUTPOST 1 (around x = 2500): regular turret + cannon ---
        this._spawnStructure(PlasmaTurret, 2400, getGroundY(2400));
        this._spawnStructure(DoubleCannon, 2700, getGroundY(2700));

        // --- MINING PLATFORM 1 (around x = 3500) ---
        // Objective with 2-3 elite defenders clustered around it
        this._spawnStructure(MiningPlatform, 3500, getGroundY(3500));
        this._spawnStructure(PlasmaTurret, 3300, getGroundY(3300), { isElite: true });
        this._spawnStructure(DoubleCannon, 3700, getGroundY(3700), { isElite: true });

        // --- OUTPOST 2 (around x = 5000): regular silo + turret ---
        this._spawnStructure(MissileSilo, 4800, getGroundY(4800));
        this._spawnStructure(PlasmaTurret, 5200, getGroundY(5200));

        // --- MINING PLATFORM 2 (around x = 6500) ---
        // Objective with 2-3 elite defenders clustered around it
        this._spawnStructure(MiningPlatform, 6500, getGroundY(6500));
        this._spawnStructure(PlasmaTurret, 6300, getGroundY(6300), { isElite: true });
        this._spawnStructure(MissileSilo, 6700, getGroundY(6700), { isElite: true });
        this._spawnStructure(DoubleCannon, 6550, getGroundY(6550), { isElite: true });

        // --- OUTPOST 3 (around x = 8000): regular silo + cannon ---
        this._spawnStructure(MissileSilo, 7800, getGroundY(7800));
        this._spawnStructure(DoubleCannon, 8200, getGroundY(8200));

        // --- REFINERY (around x = 10500 — final objective) ---
        // 3-4 elite defenders creating crossfire around the refinery
        this._spawnStructure(Refinery, 10500, getGroundY(10500));
        this._spawnStructure(PlasmaTurret, 10200, getGroundY(10200), { isElite: true });
        this._spawnStructure(DoubleCannon, 10350, getGroundY(10350), { isElite: true });
        this._spawnStructure(MissileSilo, 10650, getGroundY(10650), { isElite: true });
        this._spawnStructure(PlasmaTurret, 10800, getGroundY(10800), { isElite: true });

        // Count mission objectives
        this.totalObjectives = 0;
        this.destroyedObjectives = 0;
        for (const s of this.enemyStructures) {
            if (s.isObjective) this.totalObjectives++;
        }
    }

    /**
     * Spawn a single enemy structure at the given position.
     * Registers it with the combat manager for collision tracking.
     *
     * Includes spacing logic: if the requested position would place this
     * structure too close to an existing one (less than 150px edge-to-edge),
     * the structure is shifted along the terrain until there's enough space.
     * Orc foot soldiers can overlap structures, but structures must not
     * overlap other structures.
     *
     * @param {Function} StructureClass — The class to instantiate
     * @param {number} x — World X position
     * @param {number} groundY — Terrain Y at this X
     * @param {object} [options] — Optional settings (e.g., { isElite: true })
     */
    _spawnStructure(StructureClass, x, groundY, options) {
        // Estimate the width of the new structure for spacing calculations.
        // These match the bodyWidth values set in each class constructor.
        let newWidth = 150;  // default fallback
        if (StructureClass === PlasmaTurret) newWidth = 150;
        else if (StructureClass === DoubleCannon) newWidth = 270;
        else if (StructureClass === MissileSilo) newWidth = 240;
        else if (StructureClass === MiningPlatform) newWidth = 300;
        else if (StructureClass === Refinery) newWidth = 600;

        // Minimum edge-to-edge gap between any two structures
        const minGap = 150;

        // Try the requested position first, then shift right if too close
        let adjustedX = x;
        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
            let tooClose = false;
            for (const existing of this.enemyStructures) {
                // Calculate minimum center-to-center distance needed
                const existingHalfWidth = existing.bodyWidth / 2;
                const newHalfWidth = newWidth / 2;
                const minCenterDist = existingHalfWidth + newHalfWidth + minGap;
                const actualDist = Math.abs(adjustedX - existing.x);

                if (actualDist < minCenterDist) {
                    // Too close — shift past this structure
                    tooClose = true;
                    adjustedX = existing.x + minCenterDist + 10;
                    break;
                }
            }
            if (!tooClose) break;
            attempts++;
        }

        // If we shifted position, update groundY to match new terrain height
        if (adjustedX !== x && this.heightMap) {
            const ix = Math.floor(Math.min(Math.max(adjustedX, 0), this.worldWidth - 1));
            groundY = this.heightMap[ix];
        }

        const structure = new StructureClass(this, adjustedX, groundY, options);
        this.enemyStructures.push(structure);
        this.combatManager.addStructure(structure);
    }

    // =====================================================================
    // ATMOSPHERIC ORC SOLDIERS (Phase 4) — Non-combat walking figures
    // =====================================================================

    /**
     * Scatter 8-12 orc foot soldiers across the terrain.
     * They walk slowly, shoot harmless red spray when player is near.
     */
    _createOrcSoldiers() {
        if (!this.heightMap) return;

        this.orcSoldiers = [];
        const count = 8 + Math.floor(Math.random() * 5);

        for (let i = 0; i < count; i++) {
            // Spread across the map, avoiding the very edges
            const x = 500 + Math.random() * (this.worldWidth - 1000);
            const ix = Math.floor(Math.min(Math.max(x, 0), this.worldWidth - 1));
            const groundY = this.heightMap[ix];

            const soldier = new OrcSoldier(this, x, groundY);
            this.orcSoldiers.push(soldier);
        }
    }

    // =====================================================================
    // HUD — Health bar and objective counter (Phase 4)
    // =====================================================================

    /**
     * Creates the heads-up display elements:
     *   - Health bar in the top-left (fixed to camera)
     *   - Objective counter in the top-right (fixed to camera)
     */
    _createHUD() {
        // --- Health bar background (dark frame) ---
        this.healthBarBg = this.add.graphics();
        this.healthBarBg.setScrollFactor(0);
        this.healthBarBg.setDepth(600);

        // Dark background/frame
        this.healthBarBg.fillStyle(0x000000, 0.6);
        this.healthBarBg.fillRect(18, 18, 204, 24);
        this.healthBarBg.lineStyle(2, 0x444444, 0.8);
        this.healthBarBg.strokeRect(18, 18, 204, 24);

        // --- Health bar fill (green → yellow → red) ---
        this.healthBarFill = this.add.graphics();
        this.healthBarFill.setScrollFactor(0);
        this.healthBarFill.setDepth(601);

        // "HP" label
        this.healthLabel = this.add.text(22, 20, 'HP', {
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#aaaaaa'
        });
        this.healthLabel.setScrollFactor(0);
        this.healthLabel.setDepth(602);

        // --- Objective counter text (top-right) ---
        this.objectiveText = this.add.text(this.scale.width - 20, 22, '', {
            fontSize: '16px',
            fontFamily: 'monospace',
            color: '#ffcc00',
            align: 'right'
        });
        this.objectiveText.setOrigin(1, 0);  // Right-aligned
        this.objectiveText.setScrollFactor(0);
        this.objectiveText.setDepth(602);

        // --- Mission complete text (hidden until objectives done) ---
        this.missionCompleteText = this.add.text(
            this.scale.width / 2,
            this.scale.height / 2,
            'MISSION COMPLETE',
            {
                fontSize: '64px',
                fontFamily: 'monospace',
                fontStyle: 'bold',
                color: '#ffcc00',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            }
        );
        this.missionCompleteText.setOrigin(0.5, 0.5);
        this.missionCompleteText.setScrollFactor(0);
        this.missionCompleteText.setDepth(700);
        this.missionCompleteText.setVisible(false);

        // Initial HUD update
        this._updateHUD();
    }

    /**
     * Redraws the health bar and objective counter.
     * Called every frame from update().
     */
    _updateHUD() {
        // --- Health bar ---
        const hpRatio = this.player.hp / this.player.maxHp;
        const barWidth = Math.max(0, 196 * hpRatio);

        // Color shifts: green (>60%), yellow (30-60%), red (<30%)
        let barColor;
        if (hpRatio > 0.6) {
            barColor = 0x44cc44;
        } else if (hpRatio > 0.3) {
            barColor = 0xcccc44;
        } else {
            barColor = 0xcc4444;
        }

        this.healthBarFill.clear();
        this.healthBarFill.fillStyle(barColor, 0.9);
        this.healthBarFill.fillRect(22, 22, barWidth, 16);

        // --- Objective counter ---
        if (this.enemyStructures) {
            // Count remaining objectives
            let remaining = 0;
            for (const s of this.enemyStructures) {
                if (s.isObjective && !s.isDestroyed) remaining++;
            }
            this.objectiveText.setText('Targets: ' + remaining + ' / ' + this.totalObjectives + ' remaining');
        }
    }

    /**
     * Check if all mission objectives are destroyed.
     * If so, show "MISSION COMPLETE" and freeze the game.
     */
    _checkMissionComplete() {
        if (this.missionComplete) return;

        for (const s of this.enemyStructures) {
            if (s.isObjective && !s.isDestroyed) return;  // Still have targets
        }

        // All objectives destroyed!
        this.missionComplete = true;
        this.missionCompleteText.setVisible(true);

        // Freeze the game — pause physics and input after a brief moment
        this.time.delayedCall(500, () => {
            this.physics.pause();
        });
    }

    // =====================================================================
    // ATMOSPHERE OVERLAY — Vignette effect
    // =====================================================================

    /**
     * Creates a subtle atmosphere overlay — a vignette effect around the
     * screen edges that gives the scene a moody, enclosed feel.
     * This is fixed to the camera (scrollFactor 0) so it always covers the edges.
     */
    _createAtmosphereOverlay() {
        const overlay = this.add.graphics();
        overlay.setDepth(500);             // On top of everything except UI
        overlay.setScrollFactor(0);        // Fixed to screen

        const w = this.scale.width;
        const h = this.scale.height;

        // Draw semi-transparent dark rectangles around the edges
        // Top edge
        overlay.fillStyle(0x000000, 0.3);
        overlay.fillRect(0, 0, w, 40);

        // Bottom edge
        overlay.fillStyle(0x000000, 0.4);
        overlay.fillRect(0, h - 50, w, 50);

        // Left edge — semi-transparent black strip
        overlay.fillStyle(0x000000, 0.2);
        overlay.fillRect(0, 0, 60, h);

        // Right edge — semi-transparent black strip
        overlay.fillStyle(0x000000, 0.2);
        overlay.fillRect(w - 60, 0, 60, h);
    }

    // =====================================================================
    // GAME LOOP
    // =====================================================================

    /**
     * update() is called every frame (typically 60 times per second).
     * This is the game loop — where movement, physics, and logic happen.
     *
     * @param {number} time — Total elapsed time in milliseconds
     * @param {number} delta — Time since last frame in milliseconds
     */
    update(time, delta) {
        // If mission complete or player dead, skip updates
        if (this.missionComplete || this.player.isDead) return;

        // Step 1: Read all player inputs (keyboard + touch + weapon buttons)
        this.inputManager.update();

        // Step 2: Update the player ship with the input vectors
        this.player.update(
            delta,
            this.inputManager.moveVector,
            this.inputManager.aimVector
        );

        // Step 3: Handle weapon firing based on input states
        // Primary fire (PX-9 Plasma Array) — hold spacebar or right stick
        if (this.inputManager.firePressed) {
            this.weaponManager.firePlasma(time);
        }

        // Secondary fire (CM-3 Cluster Missile) — press E or double-tap right
        // On mobile: aim toward right stick direction if active
        if (this.inputManager.altFireJustPressed) {
            this.weaponManager.fireClusterMissile(time, this.inputManager.aimVector);
        }

        // Step 4: Update all active projectiles (movement, distance checks, splits)
        this.weaponManager.update(time, delta);

        // Step 5 (Phase 4): Update enemy structures (aim, fire, animate)
        const playerPos = this.player.getPosition();
        if (this.enemyStructures) {
            for (const structure of this.enemyStructures) {
                structure.update(time, delta, playerPos.x, playerPos.y);
            }
        }

        // Step 6 (Phase 4): Update atmospheric orc soldiers
        if (this.orcSoldiers) {
            for (const soldier of this.orcSoldiers) {
                soldier.update(delta, playerPos.x, playerPos.y, this.heightMap, this.worldWidth);
            }
        }

        // Step 7 (Phase 4): Update combat manager (collision detection + damage)
        if (this.combatManager) {
            this.combatManager.update(time, delta);
        }

        // Step 8 (Phase 4): Update HUD and check mission objectives
        this._updateHUD();
        this._checkMissionComplete();
    }
}
