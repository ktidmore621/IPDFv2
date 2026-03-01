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
        // AMBIENT ATMOSPHERE — Slight vignette/tint
        // =========================================================
        // Add a very subtle dark overlay at the edges for atmosphere.
        // This is a cosmetic touch — makes it feel like deep space.
        this._createAtmosphereOverlay();
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
        // Step 1: Read all player inputs (keyboard + touch)
        this.inputManager.update();

        // Step 2: Update the player ship with the input vectors
        this.player.update(
            delta,
            this.inputManager.moveVector,
            this.inputManager.aimVector
        );
    }
}
