/**
 * main.js — Phaser Game Configuration and Boot
 *
 * This is the entry point for the game. It creates the Phaser game instance
 * with all the settings needed: screen size, physics, scaling, and which
 * scene to load first.
 *
 * To run the game: just open index.html in a browser. That's it.
 */

// Create the Phaser game with these settings
const game = new Phaser.Game({

    // --- Display Settings ---
    type: Phaser.AUTO,              // Let Phaser pick WebGL or Canvas (WebGL preferred)
    width: 1920,                    // Target resolution width
    height: 1080,                   // Target resolution height
    backgroundColor: '#000000',     // Black background while loading

    // --- Scaling ---
    // This makes the game resize to fit the browser window while keeping
    // the 16:9 aspect ratio. No stretching, no squishing.
    scale: {
        mode: Phaser.Scale.FIT,             // Scale to fit the window
        autoCenter: Phaser.Scale.CENTER_BOTH // Center horizontally and vertically
    },

    // --- Physics ---
    // Arcade Physics is Phaser's built-in, fast physics engine.
    // Perfect for a side-scrolling shooter.
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },   // No gravity — this is a flying game!
            debug: false                 // Set to true to see collision boxes (useful for testing)
        }
    },

    // --- Scenes ---
    // List of all scenes in the game. Phaser starts the first one automatically.
    scene: [BattleScene],

    // --- Input ---
    input: {
        activePointers: 3    // Support up to 3 simultaneous touch points
    },

    // --- Rendering ---
    // Disable anti-aliasing for crisp vector edges
    render: {
        pixelArt: false,         // We're using vector art, not pixel art
        antialias: true          // Smooth edges on our vector shapes
    }
});
