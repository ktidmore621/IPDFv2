/**
 * VectorGraphics.js — Helper functions for drawing vector art shapes
 *
 * All game art is drawn programmatically using Phaser Graphics objects.
 * This file contains reusable functions to draw ships, effects, and
 * environment pieces in a clean vector style (flat/gradient fills,
 * smooth lines, crisp edges — no pixel art).
 *
 * These functions draw onto a Phaser.GameObjects.Graphics object
 * and return it so you can chain or position it.
 */

const VectorGraphics = {

    /**
     * Draws the player's fighter ship (Strikewing-style by default).
     * A sleek, angular shape facing RIGHT (0 degrees).
     *
     * The ship is drawn centered at (0, 0) so it rotates around its center.
     * Total size is roughly 60px wide x 40px tall.
     *
     * @param {Phaser.Scene} scene — The scene to create the graphics object in
     * @returns {Phaser.GameObjects.Graphics} — The graphics object with the ship drawn on it
     */
    drawPlayerShip: function (scene) {
        const g = scene.add.graphics();

        // --- Main fuselage (dark grey-blue) ---
        // A pointed, angular shape like a fighter jet viewed from the side
        g.fillStyle(0x3a4a5c, 1);
        g.beginPath();
        g.moveTo(30, 0);       // Nose tip (right side, center)
        g.lineTo(10, -12);     // Upper forward edge
        g.lineTo(-20, -14);    // Upper rear wing root
        g.lineTo(-28, -8);     // Upper tail
        g.lineTo(-28, 8);      // Lower tail
        g.lineTo(-20, 14);     // Lower rear wing root
        g.lineTo(10, 12);      // Lower forward edge
        g.closePath();
        g.fillPath();

        // --- Cockpit canopy (bright cyan glow) ---
        // Small angular shape near the nose to show the pilot's window
        g.fillStyle(0x00e5ff, 0.9);
        g.beginPath();
        g.moveTo(22, 0);       // Canopy front
        g.lineTo(12, -6);      // Upper canopy
        g.lineTo(4, -5);       // Upper rear canopy
        g.lineTo(4, 5);        // Lower rear canopy
        g.lineTo(12, 6);       // Lower canopy
        g.closePath();
        g.fillPath();

        // --- Cockpit canopy highlight (lighter cyan line) ---
        g.lineStyle(1, 0x80f0ff, 0.6);
        g.beginPath();
        g.moveTo(22, 0);
        g.lineTo(12, -6);
        g.lineTo(4, -5);
        g.closePath();
        g.strokePath();

        // --- Upper wing fin ---
        g.fillStyle(0x2d3a4a, 1);
        g.beginPath();
        g.moveTo(-8, -12);
        g.lineTo(-18, -22);    // Wing tip
        g.lineTo(-26, -18);
        g.lineTo(-20, -14);
        g.closePath();
        g.fillPath();

        // --- Lower wing fin ---
        g.fillStyle(0x2d3a4a, 1);
        g.beginPath();
        g.moveTo(-8, 12);
        g.lineTo(-18, 22);     // Wing tip
        g.lineTo(-26, 18);
        g.lineTo(-20, 14);
        g.closePath();
        g.fillPath();

        // --- Engine glow (orange-yellow at the rear) ---
        // Two small engine exhaust ports
        g.fillStyle(0xff8800, 0.8);
        g.fillRect(-30, -6, 4, 4);   // Upper engine
        g.fillRect(-30, 2, 4, 4);    // Lower engine

        // Bright inner glow
        g.fillStyle(0xffdd44, 0.9);
        g.fillRect(-29, -5, 2, 2);   // Upper inner glow
        g.fillRect(-29, 3, 2, 2);    // Lower inner glow

        // --- Hull edge lines for definition ---
        g.lineStyle(1, 0x556677, 0.5);
        g.beginPath();
        g.moveTo(30, 0);
        g.lineTo(10, -12);
        g.lineTo(-20, -14);
        g.lineTo(-28, -8);
        g.lineTo(-28, 8);
        g.lineTo(-20, 14);
        g.lineTo(10, 12);
        g.closePath();
        g.strokePath();

        return g;
    },

    /**
     * Draws a simple engine thrust flame effect.
     * Called separately so it can be animated (flickered, scaled).
     *
     * Drawn at (0, 0) — position it behind the ship.
     *
     * @param {Phaser.Scene} scene — The scene to create the graphics in
     * @returns {Phaser.GameObjects.Graphics} — The thrust flame graphic
     */
    drawThrustFlame: function (scene) {
        const g = scene.add.graphics();

        // Outer flame (orange, semi-transparent)
        g.fillStyle(0xff6600, 0.6);
        g.beginPath();
        g.moveTo(0, -5);       // Top
        g.lineTo(-18, 0);      // Flame tip (extends left/behind ship)
        g.lineTo(0, 5);        // Bottom
        g.closePath();
        g.fillPath();

        // Inner flame (bright yellow core)
        g.fillStyle(0xffcc00, 0.8);
        g.beginPath();
        g.moveTo(0, -3);
        g.lineTo(-10, 0);
        g.lineTo(0, 3);
        g.closePath();
        g.fillPath();

        return g;
    },

    /**
     * Draws a single parallax mountain/rock formation silhouette.
     * Used for background layers to create depth.
     *
     * @param {Phaser.Scene} scene — The scene to create the graphics in
     * @param {number} width — Width of the formation
     * @param {number} height — Height of the formation
     * @param {number} color — Fill color (hex, e.g., 0x1a1a2e)
     * @param {number} alpha — Opacity (0 to 1)
     * @returns {Phaser.GameObjects.Graphics} — The mountain silhouette graphic
     */
    drawMountainSilhouette: function (scene, width, height, color, alpha) {
        const g = scene.add.graphics();

        g.fillStyle(color, alpha);
        g.beginPath();

        // Start at bottom-left
        g.moveTo(0, height);

        // Create a jagged mountain-like top edge using random-ish peaks
        // We use a deterministic pattern so it looks natural but consistent
        const peaks = 5 + Math.floor(width / 200);
        const segWidth = width / peaks;

        for (let i = 0; i <= peaks; i++) {
            const x = i * segWidth;
            // Alternate between high and low points for a mountain range feel
            // Use sin-based pattern for natural-looking peaks
            const peakHeight = height * (0.3 + 0.5 * Math.abs(Math.sin(i * 1.7 + 0.5)));
            g.lineTo(x, height - peakHeight);
        }

        // Close at bottom-right
        g.lineTo(width, height);
        g.closePath();
        g.fillPath();

        return g;
    },

    /**
     * Draws a simple star as a small glowing dot for the sky.
     *
     * @param {Phaser.GameObjects.Graphics} g — Graphics object to draw on
     * @param {number} x — X position
     * @param {number} y — Y position
     * @param {number} size — Radius of the star
     * @param {number} alpha — Brightness (0 to 1)
     */
    drawStar: function (g, x, y, size, alpha) {
        // Outer glow
        g.fillStyle(0xffffff, alpha * 0.3);
        g.fillCircle(x, y, size * 2);

        // Core
        g.fillStyle(0xffffff, alpha);
        g.fillCircle(x, y, size);
    },

    // =================================================================
    // PROJECTILE GRAPHICS (Phase 3 — Weapon Systems)
    // =================================================================

    /**
     * Draws a PX-9 Plasma Bolt — a small elongated energy bolt.
     * Bright cyan/electric blue with a white-hot center and subtle glow.
     * Roughly 14px long, 5px wide (plus glow extends to ~24x12).
     * Drawn centered at (0, 0) so it rotates around its center.
     *
     * @param {Phaser.Scene} scene — The scene to create the graphics in
     * @returns {Phaser.GameObjects.Graphics} — The plasma bolt graphic
     */
    drawPlasmaBolt: function (scene) {
        const g = scene.add.graphics();

        // Outer glow — slightly larger translucent shape behind the bolt.
        // This gives the bolt that "energy" look, like it's radiating light.
        g.fillStyle(0x00aaff, 0.2);
        g.fillEllipse(0, 0, 24, 12);

        // Main bolt body — bright cyan/electric blue
        g.fillStyle(0x00e5ff, 0.85);
        g.fillEllipse(0, 0, 14, 5);

        // White-hot center — the brightest part of the bolt
        g.fillStyle(0xffffff, 0.95);
        g.fillEllipse(0, 0, 8, 2.5);

        return g;
    },

    /**
     * Draws a CM-3 Cluster Missile — the initial missile before it splits.
     * Warm orange/amber with a bright yellow exhaust trail.
     * Roughly 18px long with pointed nose and small tail fins.
     * Drawn centered at (0, 0) facing right.
     *
     * @param {Phaser.Scene} scene — The scene to create the graphics in
     * @returns {Phaser.GameObjects.Graphics} — The cluster missile graphic
     */
    drawClusterMissile: function (scene) {
        const g = scene.add.graphics();

        // --- Exhaust trail (behind the missile body) ---
        // 3 fading circles that create the illusion of a trail.
        // They move with the missile since they're on the same Graphics object.
        g.fillStyle(0xffaa00, 0.35);
        g.fillCircle(-14, 0, 4);
        g.fillStyle(0xff8800, 0.2);
        g.fillCircle(-19, 0, 3);
        g.fillStyle(0xff6600, 0.1);
        g.fillCircle(-23, 0, 2);

        // --- Missile body (warm orange/amber) ---
        g.fillStyle(0xff8c00, 1);
        g.beginPath();
        g.moveTo(10, 0);         // Pointed nose tip
        g.lineTo(5, -3.5);       // Upper forward edge
        g.lineTo(-8, -3.5);      // Upper rear
        g.lineTo(-8, 3.5);       // Lower rear
        g.lineTo(5, 3.5);        // Lower forward edge
        g.closePath();
        g.fillPath();

        // --- Bright yellow center streak ---
        g.fillStyle(0xffcc00, 0.8);
        g.fillRect(-5, -1.5, 10, 3);

        // --- Upper tail fin ---
        g.fillStyle(0xcc6600, 1);
        g.beginPath();
        g.moveTo(-6, -3.5);
        g.lineTo(-10, -7);
        g.lineTo(-10, -3.5);
        g.closePath();
        g.fillPath();

        // --- Lower tail fin ---
        g.fillStyle(0xcc6600, 1);
        g.beginPath();
        g.moveTo(-6, 3.5);
        g.lineTo(-10, 7);
        g.lineTo(-10, 3.5);
        g.closePath();
        g.fillPath();

        // --- Engine glow at rear (bright yellow dot) ---
        g.fillStyle(0xffdd44, 0.9);
        g.fillCircle(-9, 0, 2.5);

        return g;
    },

    /**
     * Draws a CM-3 Submunition — the smaller missiles after a cluster split.
     * Same orange/amber color scheme but smaller (10-12px) and slightly dimmer.
     * Drawn centered at (0, 0) facing right.
     *
     * @param {Phaser.Scene} scene — The scene to create the graphics in
     * @returns {Phaser.GameObjects.Graphics} — The submunition graphic
     */
    drawSubmunition: function (scene) {
        const g = scene.add.graphics();

        // --- Smaller exhaust trail ---
        g.fillStyle(0xffaa00, 0.25);
        g.fillCircle(-9, 0, 2.5);
        g.fillStyle(0xff8800, 0.15);
        g.fillCircle(-12, 0, 2);

        // --- Smaller missile body (slightly dimmer orange) ---
        g.fillStyle(0xe07800, 0.9);
        g.beginPath();
        g.moveTo(6, 0);          // Pointed nose
        g.lineTo(3, -2.5);
        g.lineTo(-5, -2.5);
        g.lineTo(-5, 2.5);
        g.lineTo(3, 2.5);
        g.closePath();
        g.fillPath();

        // --- Center highlight ---
        g.fillStyle(0xffbb00, 0.7);
        g.fillRect(-3, -1, 6, 2);

        // --- Small upper fin ---
        g.fillStyle(0xaa5500, 0.9);
        g.beginPath();
        g.moveTo(-4, -2.5);
        g.lineTo(-6, -5);
        g.lineTo(-6, -2.5);
        g.closePath();
        g.fillPath();

        // --- Small lower fin ---
        g.beginPath();
        g.moveTo(-4, 2.5);
        g.lineTo(-6, 5);
        g.lineTo(-6, 2.5);
        g.closePath();
        g.fillPath();

        // --- Tiny engine glow ---
        g.fillStyle(0xffcc33, 0.8);
        g.fillCircle(-6, 0, 1.5);

        return g;
    },

    /**
     * Draws a muzzle flash — the bright flash at the ship's nose when firing plasma.
     * A small bright circle that appears for 1-2 frames then disappears.
     * Drawn centered at (0, 0) — positioned at ship's nose when shown.
     *
     * @param {Phaser.Scene} scene — The scene to create the graphics in
     * @returns {Phaser.GameObjects.Graphics} — The muzzle flash graphic
     */
    drawMuzzleFlash: function (scene) {
        const g = scene.add.graphics();

        // Outer glow (soft cyan halo)
        g.fillStyle(0x00ccff, 0.3);
        g.fillCircle(0, 0, 12);

        // Mid glow (brighter cyan)
        g.fillStyle(0x00e5ff, 0.5);
        g.fillCircle(0, 0, 7);

        // Bright white core
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(0, 0, 3);

        return g;
    },

    /**
     * Draws a split flash — the burst effect when a cluster missile divides
     * into 3 submunitions. White/yellow expanding circle that fades quickly.
     * Drawn centered at (0, 0) — positioned at the split point when shown.
     *
     * @param {Phaser.Scene} scene — The scene to create the graphics in
     * @returns {Phaser.GameObjects.Graphics} — The split flash graphic
     */
    drawSplitFlash: function (scene) {
        const g = scene.add.graphics();

        // Outer glow (warm yellow)
        g.fillStyle(0xffdd00, 0.4);
        g.fillCircle(0, 0, 20);

        // Mid ring (orange)
        g.fillStyle(0xffaa00, 0.6);
        g.fillCircle(0, 0, 12);

        // Bright white center
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(0, 0, 5);

        return g;
    },

    // =================================================================
    // PHASE 4 — ENEMY STRUCTURE GRAPHICS
    // =================================================================

    /**
     * Draws a Plasma Turret — a rusty tower with an orc gunner on top.
     * ~40px wide, ~65px tall. Drawn with base at (0, 0) extending upward.
     *
     * @param {Phaser.Scene} scene — The scene to create the graphics in
     * @returns {Phaser.GameObjects.Graphics} — The turret graphic
     */
    drawPlasmaTurret: function (scene) {
        const g = scene.add.graphics();

        // --- Tower body (rusty brown metal) ---
        g.fillStyle(0x5a3a1a, 1);
        g.fillRect(-18, -60, 36, 60);

        // Darker side panel for depth
        g.fillStyle(0x4a2a10, 1);
        g.fillRect(-18, -60, 10, 60);

        // Rivets/bolts (small dark circles along the tower)
        g.fillStyle(0x3a2a0a, 0.8);
        for (let by = -50; by < 0; by += 15) {
            g.fillCircle(-12, by, 2);
            g.fillCircle(12, by, 2);
        }

        // Horizontal rusty band across the middle
        g.fillStyle(0x6a4420, 0.7);
        g.fillRect(-20, -35, 40, 5);

        // --- Platform at top ---
        g.fillStyle(0x4a3218, 1);
        g.fillRect(-22, -65, 44, 6);

        // --- Orc gunner (small figure sitting at top) ---
        // Head (green skin)
        g.fillStyle(0x3a6a2a, 1);
        g.fillCircle(0, -74, 5);

        // Body (brass armor)
        g.fillStyle(0x8a7a3a, 1);
        g.fillRect(-5, -69, 10, 8);

        // Neon green helmet plume
        g.fillStyle(0x44ff44, 0.9);
        g.fillRect(-1, -81, 2, 6);

        // --- Gun barrel (extends right, rotates separately) ---
        // The barrel will be drawn separately for rotation

        // --- Base reinforcement ---
        g.fillStyle(0x3a2a0a, 1);
        g.fillRect(-22, -4, 44, 4);

        return g;
    },

    /**
     * Draws the rotating gun barrel for a plasma turret.
     * Drawn pointing right from (0, 0).
     *
     * @param {Phaser.Scene} scene
     * @returns {Phaser.GameObjects.Graphics}
     */
    drawTurretBarrel: function (scene) {
        const g = scene.add.graphics();

        // Main barrel tube
        g.fillStyle(0x5a4a2a, 1);
        g.fillRect(0, -3, 22, 6);

        // Barrel tip (darker)
        g.fillStyle(0x3a2a0a, 1);
        g.fillRect(18, -4, 6, 8);

        return g;
    },

    /**
     * Draws a Missile Silo — flush with terrain, two horizontal doors.
     * ~80px wide. Drawn with top at (0, 0).
     *
     * @param {Phaser.Scene} scene
     * @returns {Phaser.GameObjects.Graphics}
     */
    drawMissileSilo: function (scene) {
        const g = scene.add.graphics();

        // --- Silo pit (dark opening below doors) ---
        g.fillStyle(0x0a0a0a, 1);
        g.fillRect(-35, -3, 70, 20);

        // --- Left door (dark metal) ---
        g.fillStyle(0x3a3a3a, 1);
        g.fillRect(-35, -5, 34, 8);

        // --- Right door (dark metal) ---
        g.fillStyle(0x3a3a3a, 1);
        g.fillRect(1, -5, 34, 8);

        // Door seam line
        g.lineStyle(1, 0x1a1a1a, 1);
        g.beginPath();
        g.moveTo(0, -5);
        g.lineTo(0, 3);
        g.strokePath();

        // --- Barbed wire fence (angular thin lines around the silo) ---
        g.lineStyle(1, 0x6a6a5a, 0.7);
        // Left fence post
        g.beginPath();
        g.moveTo(-42, -8);
        g.lineTo(-42, -20);
        g.strokePath();
        // Right fence post
        g.beginPath();
        g.moveTo(42, -8);
        g.lineTo(42, -20);
        g.strokePath();
        // Wire between posts with barbs
        g.beginPath();
        g.moveTo(-42, -18);
        for (let wx = -38; wx <= 38; wx += 8) {
            g.lineTo(wx, -16 + ((wx % 16 === 0) ? -3 : 0));
        }
        g.lineTo(42, -18);
        g.strokePath();

        // --- Flashing gold lights (small circles on posts) ---
        // These will be animated in the enemy class
        g.fillStyle(0xffcc00, 0.9);
        g.fillCircle(-42, -20, 3);
        g.fillCircle(42, -20, 3);

        // --- Two stationary orc guards ---
        // Left guard
        g.fillStyle(0x3a6a2a, 1);
        g.fillCircle(-30, -14, 3);  // Head
        g.fillStyle(0x7a6a2a, 1);
        g.fillRect(-32, -11, 5, 6);  // Body

        // Right guard
        g.fillStyle(0x3a6a2a, 1);
        g.fillCircle(30, -14, 3);
        g.fillStyle(0x7a6a2a, 1);
        g.fillRect(28, -11, 5, 6);

        return g;
    },

    /**
     * Draws a Double Cannon — twin barrels on a reinforced bunker.
     * ~80px wide, ~50px tall. Drawn with base at (0, 0).
     *
     * @param {Phaser.Scene} scene
     * @returns {Phaser.GameObjects.Graphics}
     */
    drawDoubleCannon: function (scene) {
        const g = scene.add.graphics();

        // --- Heavy bunker body (dark green-brown metal) ---
        g.fillStyle(0x3a4a2a, 1);
        g.beginPath();
        g.moveTo(-40, 0);
        g.lineTo(-36, -42);
        g.lineTo(36, -42);
        g.lineTo(40, 0);
        g.closePath();
        g.fillPath();

        // Darker front face for 3D depth
        g.fillStyle(0x2a3a1a, 1);
        g.fillRect(-36, -42, 72, 10);

        // --- Exposed pipes along sides ---
        g.lineStyle(3, 0x5a4a2a, 0.8);
        g.beginPath();
        g.moveTo(-38, -5);
        g.lineTo(-38, -35);
        g.strokePath();
        g.beginPath();
        g.moveTo(38, -5);
        g.lineTo(38, -35);
        g.strokePath();

        // Smaller pipe detail
        g.lineStyle(2, 0x4a3a1a, 0.6);
        g.beginPath();
        g.moveTo(-34, -8);
        g.lineTo(-34, -30);
        g.strokePath();

        // --- Bolt details ---
        g.fillStyle(0x2a2a1a, 0.8);
        for (let bx = -28; bx <= 28; bx += 14) {
            g.fillCircle(bx, -38, 2);
        }

        // --- Reinforcement band ---
        g.fillStyle(0x4a5a3a, 0.6);
        g.fillRect(-36, -25, 72, 4);

        // --- Large neon plume (high rank indicator) ---
        g.fillStyle(0x44ff44, 0.9);
        g.beginPath();
        g.moveTo(0, -42);
        g.lineTo(-3, -56);
        g.lineTo(0, -54);
        g.lineTo(3, -56);
        g.closePath();
        g.fillPath();

        return g;
    },

    /**
     * Draws the twin barrel assembly for the double cannon.
     * Two parallel barrels pointing right from (0, 0).
     *
     * @param {Phaser.Scene} scene
     * @returns {Phaser.GameObjects.Graphics}
     */
    drawCannonBarrels: function (scene) {
        const g = scene.add.graphics();

        // Upper barrel
        g.fillStyle(0x4a5a3a, 1);
        g.fillRect(0, -8, 30, 5);
        g.fillStyle(0x3a4a2a, 1);
        g.fillRect(26, -9, 6, 7);

        // Lower barrel
        g.fillStyle(0x4a5a3a, 1);
        g.fillRect(0, 3, 30, 5);
        g.fillStyle(0x3a4a2a, 1);
        g.fillRect(26, 2, 6, 7);

        return g;
    },

    /**
     * Draws a Mining Platform — industrial machinery extracting ore.
     * ~140px wide, ~90px tall. Drawn with base at (0, 0).
     *
     * @param {Phaser.Scene} scene
     * @returns {Phaser.GameObjects.Graphics}
     */
    drawMiningPlatform: function (scene) {
        const g = scene.add.graphics();

        // --- Main platform deck ---
        g.fillStyle(0x4a3a1a, 1);
        g.fillRect(-65, -20, 130, 20);

        // --- Support struts going into ground ---
        g.fillStyle(0x3a2a0a, 1);
        g.fillRect(-55, -5, 8, 10);
        g.fillRect(47, -5, 8, 10);
        g.fillRect(-10, -5, 8, 10);

        // --- Drilling derrick (tall frame on left side) ---
        g.fillStyle(0x5a4a2a, 1);
        g.fillRect(-55, -80, 6, 62);
        g.fillRect(-35, -80, 6, 62);
        // Cross braces
        g.lineStyle(2, 0x5a4a2a, 0.8);
        g.beginPath();
        g.moveTo(-55, -70);
        g.lineTo(-35, -50);
        g.strokePath();
        g.beginPath();
        g.moveTo(-35, -70);
        g.lineTo(-55, -50);
        g.strokePath();

        // Drill head housing
        g.fillStyle(0x6a5a3a, 1);
        g.fillRect(-52, -88, 20, 10);

        // --- Transparent tube with ore glow (center) ---
        // Tube outline
        g.lineStyle(2, 0x6a6a6a, 0.5);
        g.beginPath();
        g.moveTo(-10, -18);
        g.lineTo(-10, -65);
        g.strokePath();
        g.beginPath();
        g.moveTo(-2, -18);
        g.lineTo(-2, -65);
        g.strokePath();

        // Ore glow inside tube (purplish-red)
        g.fillStyle(0x8b2252, 0.5);
        g.fillRect(-9, -60, 6, 42);
        g.fillStyle(0xcc3366, 0.3);
        g.fillRect(-8, -55, 4, 35);

        // --- Processing machinery (right side) ---
        g.fillStyle(0x4a3a1a, 1);
        g.fillRect(15, -55, 40, 35);

        // Pipes on machinery
        g.lineStyle(3, 0x5a4a2a, 0.7);
        g.beginPath();
        g.moveTo(15, -45);
        g.lineTo(-2, -45);
        g.strokePath();
        g.beginPath();
        g.moveTo(55, -40);
        g.lineTo(65, -40);
        g.lineTo(65, -10);
        g.strokePath();

        // Machinery detail — small vents
        g.fillStyle(0x2a1a0a, 0.8);
        g.fillRect(20, -50, 10, 5);
        g.fillRect(35, -50, 10, 5);

        // --- Exhaust vent (for animated toxic smoke) ---
        g.fillStyle(0x3a3a3a, 1);
        g.fillRect(25, -62, 12, 8);

        // --- Pipe into ground ---
        g.fillStyle(0x4a3a2a, 1);
        g.fillRect(-48, -20, 6, 25);
        g.fillRect(-30, -20, 6, 25);

        return g;
    },

    /**
     * Draws a Voidheart Ore Refinery — the largest structure, final objective.
     * ~220px wide, ~140px tall. Drawn with base at (0, 0).
     *
     * @param {Phaser.Scene} scene
     * @returns {Phaser.GameObjects.Graphics}
     */
    drawRefinery: function (scene) {
        const g = scene.add.graphics();

        // --- Main building body ---
        g.fillStyle(0x3a2a1a, 1);
        g.fillRect(-100, -80, 200, 80);

        // Darker lower section
        g.fillStyle(0x2a1a0a, 1);
        g.fillRect(-100, -30, 200, 30);

        // --- Left tank (large cylindrical, with ore glow) ---
        g.fillStyle(0x4a3a1a, 1);
        g.fillRect(-95, -110, 50, 70);
        // Ore glow inside tank
        g.fillStyle(0x8b2252, 0.4);
        g.fillRect(-90, -100, 40, 50);
        g.fillStyle(0xcc3366, 0.2);
        g.fillRect(-85, -95, 30, 40);

        // --- Right tank ---
        g.fillStyle(0x4a3a1a, 1);
        g.fillRect(45, -110, 50, 70);
        g.fillStyle(0x8b2252, 0.4);
        g.fillRect(50, -100, 40, 50);
        g.fillStyle(0xcc3366, 0.2);
        g.fillRect(55, -95, 30, 40);

        // --- Smokestacks (3 tall chimneys) ---
        g.fillStyle(0x5a4a2a, 1);
        g.fillRect(-30, -135, 12, 60);
        g.fillRect(-5, -145, 12, 70);
        g.fillRect(20, -130, 12, 55);

        // Smokestack caps
        g.fillStyle(0x6a5a3a, 1);
        g.fillRect(-32, -138, 16, 5);
        g.fillRect(-7, -148, 16, 5);
        g.fillRect(18, -133, 16, 5);

        // --- Connecting pipes between sections ---
        g.lineStyle(4, 0x5a4a2a, 0.8);
        g.beginPath();
        g.moveTo(-45, -85);
        g.lineTo(-30, -85);
        g.strokePath();
        g.beginPath();
        g.moveTo(32, -85);
        g.lineTo(45, -85);
        g.strokePath();

        // Horizontal pipe along front
        g.lineStyle(3, 0x4a3a1a, 0.7);
        g.beginPath();
        g.moveTo(-95, -35);
        g.lineTo(95, -35);
        g.strokePath();

        // --- Catwalks with orc guards ---
        // Left catwalk
        g.fillStyle(0x4a4a3a, 0.8);
        g.fillRect(-90, -82, 40, 3);
        // Guard on left catwalk
        g.fillStyle(0x3a6a2a, 1);
        g.fillCircle(-70, -87, 3);
        g.fillStyle(0x7a6a2a, 1);
        g.fillRect(-72, -84, 5, 5);

        // Right catwalk
        g.fillStyle(0x4a4a3a, 0.8);
        g.fillRect(50, -82, 40, 3);
        // Guard on right catwalk
        g.fillStyle(0x3a6a2a, 1);
        g.fillCircle(70, -87, 3);
        g.fillStyle(0x7a6a2a, 1);
        g.fillRect(68, -84, 5, 5);

        // --- Bolt details along building face ---
        g.fillStyle(0x2a1a0a, 0.7);
        for (let bx = -80; bx <= 80; bx += 20) {
            g.fillCircle(bx, -75, 2);
            g.fillCircle(bx, -15, 2);
        }

        // --- Base reinforcement ---
        g.fillStyle(0x2a2a1a, 1);
        g.fillRect(-105, -4, 210, 4);

        return g;
    },

    /**
     * Draws an orc foot soldier — small atmospheric figure (~22px tall).
     * Walking on terrain surface, just visual flavor.
     * Drawn at (0, 0) with feet at bottom.
     *
     * @param {Phaser.Scene} scene
     * @returns {Phaser.GameObjects.Graphics}
     */
    drawOrcSoldier: function (scene) {
        const g = scene.add.graphics();

        // --- Legs (dark brown) ---
        g.fillStyle(0x3a2a1a, 1);
        g.fillRect(-4, -8, 3, 8);
        g.fillRect(1, -8, 3, 8);

        // --- Body (brass armor) ---
        g.fillStyle(0x7a6a2a, 1);
        g.fillRect(-5, -16, 10, 9);

        // --- Head (green skin) ---
        g.fillStyle(0x3a6a2a, 1);
        g.fillCircle(0, -20, 4);

        // --- Small helmet plume ---
        g.fillStyle(0x44ff44, 0.8);
        g.fillRect(-1, -25, 2, 4);

        // --- Weapon (small stick pointing up) ---
        g.lineStyle(1, 0x5a5a5a, 0.8);
        g.beginPath();
        g.moveTo(6, -16);
        g.lineTo(6, -24);
        g.strokePath();

        return g;
    },

    /**
     * Draws an enemy red energy bolt (from plasma turrets).
     * Similar to plasma bolt but red-colored.
     *
     * @param {Phaser.Scene} scene
     * @returns {Phaser.GameObjects.Graphics}
     */
    drawEnemyPlasmaBolt: function (scene) {
        const g = scene.add.graphics();

        // Outer glow (red)
        g.fillStyle(0xff2200, 0.2);
        g.fillEllipse(0, 0, 20, 10);

        // Main bolt body (bright red)
        g.fillStyle(0xff4422, 0.85);
        g.fillEllipse(0, 0, 12, 4);

        // White-hot center
        g.fillStyle(0xffccaa, 0.9);
        g.fillEllipse(0, 0, 6, 2);

        return g;
    },

    /**
     * Draws a green lightning bolt for the double cannon.
     * Jagged/electrical look with small forks.
     *
     * @param {Phaser.Scene} scene
     * @returns {Phaser.GameObjects.Graphics}
     */
    drawGreenLightningBolt: function (scene) {
        const g = scene.add.graphics();

        // Outer glow
        g.fillStyle(0x22ff22, 0.15);
        g.fillEllipse(0, 0, 24, 12);

        // Main jagged bolt — a series of short angled segments
        g.lineStyle(3, 0x44ff44, 0.9);
        g.beginPath();
        g.moveTo(-10, 0);
        g.lineTo(-6, -3);
        g.lineTo(-2, 2);
        g.lineTo(2, -2);
        g.lineTo(6, 3);
        g.lineTo(10, 0);
        g.strokePath();

        // Branch fork (upper)
        g.lineStyle(1, 0x66ff66, 0.6);
        g.beginPath();
        g.moveTo(-2, 2);
        g.lineTo(-4, 5);
        g.strokePath();

        // Branch fork (lower)
        g.beginPath();
        g.moveTo(2, -2);
        g.lineTo(4, -5);
        g.strokePath();

        // Bright core line
        g.lineStyle(1, 0xccffcc, 0.8);
        g.beginPath();
        g.moveTo(-8, 0);
        g.lineTo(-4, -2);
        g.lineTo(0, 1);
        g.lineTo(4, -1);
        g.lineTo(8, 0);
        g.strokePath();

        return g;
    },

    /**
     * Draws a tracking missile for the missile silo.
     * Looks like an orc-made rocket — crude and menacing.
     *
     * @param {Phaser.Scene} scene
     * @returns {Phaser.GameObjects.Graphics}
     */
    drawTrackingMissile: function (scene) {
        const g = scene.add.graphics();

        // Exhaust trail
        g.fillStyle(0xff6600, 0.3);
        g.fillCircle(-12, 0, 4);
        g.fillStyle(0xff4400, 0.15);
        g.fillCircle(-17, 0, 3);

        // Missile body (dark rusty red)
        g.fillStyle(0x8a2a1a, 1);
        g.beginPath();
        g.moveTo(10, 0);        // Pointed nose
        g.lineTo(5, -4);
        g.lineTo(-8, -4);
        g.lineTo(-8, 4);
        g.lineTo(5, 4);
        g.closePath();
        g.fillPath();

        // Danger stripe
        g.fillStyle(0xffaa00, 0.7);
        g.fillRect(-2, -3, 4, 6);

        // Tail fins
        g.fillStyle(0x5a1a0a, 1);
        g.beginPath();
        g.moveTo(-6, -4);
        g.lineTo(-10, -8);
        g.lineTo(-10, -4);
        g.closePath();
        g.fillPath();
        g.beginPath();
        g.moveTo(-6, 4);
        g.lineTo(-10, 8);
        g.lineTo(-10, 4);
        g.closePath();
        g.fillPath();

        // Engine glow
        g.fillStyle(0xffcc00, 0.9);
        g.fillCircle(-9, 0, 2.5);

        return g;
    },

    /**
     * Draws a small hit spark effect — tiny bright flash when a projectile hits.
     *
     * @param {Phaser.Scene} scene
     * @returns {Phaser.GameObjects.Graphics}
     */
    drawHitSpark: function (scene) {
        const g = scene.add.graphics();

        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(0, 0, 8);
        g.fillStyle(0xffcc44, 0.5);
        g.fillCircle(0, 0, 14);

        return g;
    },

    /**
     * Draws an explosion effect — orange/red expanding fireball.
     *
     * @param {Phaser.Scene} scene
     * @param {number} size — Base radius of the explosion
     * @returns {Phaser.GameObjects.Graphics}
     */
    drawExplosion: function (scene, size) {
        const g = scene.add.graphics();

        // Outer fireball glow
        g.fillStyle(0xff4400, 0.4);
        g.fillCircle(0, 0, size * 1.5);

        // Main fireball
        g.fillStyle(0xff6600, 0.7);
        g.fillCircle(0, 0, size);

        // Bright orange center
        g.fillStyle(0xffaa00, 0.8);
        g.fillCircle(0, 0, size * 0.6);

        // White-hot core
        g.fillStyle(0xffffcc, 0.9);
        g.fillCircle(0, 0, size * 0.3);

        return g;
    }
};
