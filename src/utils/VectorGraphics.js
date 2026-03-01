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
    }
};
