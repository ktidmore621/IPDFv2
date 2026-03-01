/**
 * BattleScene.js — Main Gameplay Scene
 *
 * This is where the game happens. It creates:
 *   - The game world (10,000 x 3,000 pixels)
 *   - A multi-layer parallax sky/background with stars and mountains
 *   - The player ship
 *   - The input manager
 *   - The camera that follows the player
 *
 * Think of a Scene like a "screen" or "level" in the game.
 * BattleScene is the main flight-and-combat screen.
 */

class BattleScene extends Phaser.Scene {

    constructor() {
        // The scene key — used to start/switch to this scene
        super({ key: 'BattleScene' });
    }

    /**
     * create() is called once when the scene starts.
     * This is where we build everything: background, player, camera, etc.
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

        // =========================================================
        // BACKGROUND — Parallax Sky Layers
        // =========================================================
        // We create multiple background layers that scroll at different speeds.
        // Layers farther "away" scroll slower, creating a sense of depth.
        // This is called "parallax scrolling."

        this._createBackground();

        // =========================================================
        // GROUND — Simple ground line at the bottom of the world
        // =========================================================
        this._createGround();

        // =========================================================
        // PLAYER SHIP
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

    /**
     * Creates the multi-layer parallax background.
     *
     * Layers (from back to front):
     *   1. Deep sky gradient (dark blue/purple — farthest away, no scroll)
     *   2. Stars (tiny dots, very slow scroll)
     *   3. Distant mountains (dark silhouettes, slow scroll)
     *   4. Mid mountains (slightly brighter silhouettes, medium scroll)
     *   5. Near formations (closest silhouettes, faster scroll)
     */
    _createBackground() {
        // --- Layer 1: Sky gradient ---
        // A tall rectangle that covers the entire world, filled with a
        // dark gradient from deep blue (top) to dark purple (bottom).
        // setScrollFactor(0) means it doesn't move with the camera at all.
        const skyGraphic = this.add.graphics();
        skyGraphic.setDepth(-100);
        skyGraphic.setScrollFactor(0);

        // Draw the gradient by layering thin horizontal bars
        // from dark blue at the top to dark purple-brown at the bottom
        const gameHeight = this.scale.height;
        const gameWidth = this.scale.width;
        for (let y = 0; y < gameHeight; y++) {
            // Interpolate between top color and bottom color
            const t = y / gameHeight;
            // Top: deep dark blue (0x0a0a1a) → Bottom: dark maroon-purple (0x1a0a0a)
            const r = Math.floor(10 + t * 16);
            const g = Math.floor(10 - t * 4);
            const b = Math.floor(26 - t * 16);
            const color = (r << 16) | (g << 8) | b;
            skyGraphic.fillStyle(color, 1);
            skyGraphic.fillRect(0, y, gameWidth, 1);
        }

        // --- Layer 2: Stars ---
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

        // --- Layer 3: Distant mountains (far background) ---
        // Very dark, barely visible silhouettes. Slow scroll.
        this._createMountainLayer({
            depth: -80,
            scrollFactor: 0.1,
            color: 0x0d0d1a,
            alpha: 0.8,
            yOffset: 0.55,         // Start 55% down the world
            heightScale: 0.35,     // Take up to 35% of world height
            count: 4,
            minWidth: 2000,
            maxWidth: 4000
        });

        // --- Layer 4: Mid mountains ---
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

        // --- Layer 5: Near formations ---
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

    /**
     * Creates a simple ground area at the bottom of the world.
     * This is a dark, rocky surface with subtle detail.
     */
    _createGround() {
        const groundHeight = 200;
        const groundY = this.worldHeight - groundHeight;

        const ground = this.add.graphics();
        ground.setDepth(-10);

        // Main ground fill — dark rocky color
        ground.fillStyle(0x1a1410, 1);
        ground.fillRect(0, groundY, this.worldWidth, groundHeight);

        // Slightly lighter top edge to suggest a ridge line
        ground.fillStyle(0x2a2420, 1);
        ground.fillRect(0, groundY, this.worldWidth, 4);

        // Scattered rocks / texture dots across the ground
        for (let i = 0; i < 200; i++) {
            const rx = Math.random() * this.worldWidth;
            const ry = groundY + 10 + Math.random() * (groundHeight - 20);
            const size = 2 + Math.random() * 6;
            const shade = 0x100c08 + Math.floor(Math.random() * 0x0a0a0a);
            ground.fillStyle(shade, 0.5);
            ground.fillRect(rx, ry, size, size * 0.6);
        }

        // A few glowing Voidheart Ore veins in the ground (purple-red with gold)
        // These are just visual hints — not interactive yet
        for (let i = 0; i < 15; i++) {
            const vx = 500 + Math.random() * (this.worldWidth - 1000);
            const vy = groundY + 20 + Math.random() * (groundHeight - 40);
            const vLen = 30 + Math.random() * 80;

            // Purple-red ore vein
            ground.lineStyle(2, 0x8b2252, 0.7);
            ground.beginPath();
            ground.moveTo(vx, vy);
            ground.lineTo(vx + vLen, vy + (Math.random() - 0.5) * 20);
            ground.strokePath();

            // Gold accent
            ground.lineStyle(1, 0xdaa520, 0.5);
            ground.beginPath();
            ground.moveTo(vx + 5, vy + 2);
            ground.lineTo(vx + vLen * 0.6, vy + 2 + (Math.random() - 0.5) * 10);
            ground.strokePath();
        }
    }

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
