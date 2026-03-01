/**
 * WeaponManager.js — Weapon Firing and Projectile Management System
 *
 * Handles all weapon systems for the player ship:
 *   - PX-9 Rapid Plasma Array (primary weapon — fast-firing energy bolts)
 *   - CM-3 Scatter Lance (secondary weapon — splitting cluster missiles)
 *
 * KEY DESIGN: Object Pooling
 *   Instead of creating and destroying projectiles every shot (which causes
 *   garbage collection stutter), we pre-create pools of projectile objects
 *   at startup. When we need to fire, we grab an inactive projectile from
 *   the pool, position it, and activate it. When it expires, we deactivate
 *   it and put it back in the pool. This keeps performance smooth even at
 *   8-10 plasma shots per second.
 *
 * Each projectile is a Phaser Graphics object with a physics body attached.
 * The physics body gives it velocity so it moves automatically each frame.
 * We just track distance/bounds and deactivate expired ones.
 *
 * This system is modular — Phase 6 will add the Nightfall Bomb as a third
 * weapon type using the same pool pattern.
 */

class WeaponManager {

    /**
     * Creates the weapon manager with all projectile pools.
     *
     * @param {Phaser.Scene} scene — The game scene (for creating objects and tweens)
     * @param {PlayerShip} player — The player ship (for position and facing angle)
     */
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;

        // =================================================================
        // PX-9 RAPID PLASMA ARRAY — Settings
        // =================================================================
        this.plasmaFireRate = 110;          // Milliseconds between shots (~9 shots/sec)
        this.plasmaSpeed = 1200;            // Pixels per second
        this.plasmaMaxDistance = 800;        // Max travel distance before despawn
        this.plasmaLastFired = 0;           // Timestamp of last plasma shot

        // =================================================================
        // CM-3 SCATTER LANCE — Settings
        // =================================================================
        this.missileFireRate = 1500;         // Milliseconds between shots (1 every 1.5s)
        this.missileSpeed = 600;             // Pixels per second
        this.missileSplitDistance = 350;      // Distance traveled before splitting
        this.missileLastFired = 0;           // Timestamp of last missile

        // --- Submunition settings (after the missile splits) ---
        this.subSpeed = 500;                 // Slightly slower than parent missile
        this.subMaxDistance = 250;            // How far subs travel after the split point
        // Angle between each submunition (17 degrees in radians)
        // The 3 subs spread at: -17°, 0°, +17° from the parent's direction
        this.subSpreadAngle = 17 * (Math.PI / 180);

        // =================================================================
        // CREATE PROJECTILE POOLS
        // =================================================================
        // Pool sizes are generous to handle worst-case scenarios:
        //   Plasma: ~7 on screen max (800px range / 1200px/s = 0.67s × 10/s)
        //   Missiles: at most 2 active (1.5s cooldown, 0.58s to split)
        //   Submunitions: at most 6 (2 missiles × 3 subs each)

        this.plasmaBolts = this._createPool('plasma', 20);
        this.missiles = this._createPool('missile', 5);
        this.submunitions = this._createPool('sub', 12);

        // =================================================================
        // MUZZLE FLASH — Appears at ship's nose when firing plasma
        // =================================================================
        this.muzzleFlash = VectorGraphics.drawMuzzleFlash(scene);
        this.muzzleFlash.setVisible(false);
        this.muzzleFlash.setDepth(10);     // Above projectiles, below UI
        this.muzzleFlashTimer = 0;          // Countdown timer in ms

        // =================================================================
        // SPLIT FLASH POOL — Burst effect when cluster missiles divide
        // =================================================================
        // We need a few of these since multiple missiles could split close
        // together (unlikely but possible).
        this.splitFlashes = [];
        for (let i = 0; i < 4; i++) {
            const flash = VectorGraphics.drawSplitFlash(scene);
            flash.setVisible(false);
            flash.setDepth(10);
            this.splitFlashes.push({ graphic: flash, active: false });
        }
    }

    // =====================================================================
    // POOL CREATION — Pre-creates all projectile objects
    // =====================================================================

    /**
     * Creates a pool of projectile objects of the given type.
     * Each projectile is a Graphics object with a physics body.
     * All start inactive and invisible — ready to be "fired."
     *
     * @param {string} type — 'plasma', 'missile', or 'sub'
     * @param {number} size — How many objects in this pool
     * @returns {Array} — Array of pooled projectile Graphics objects
     */
    _createPool(type, size) {
        const pool = [];

        for (let i = 0; i < size; i++) {
            // Draw the projectile visual based on type
            let g;
            if (type === 'plasma') {
                g = VectorGraphics.drawPlasmaBolt(this.scene);
            } else if (type === 'missile') {
                g = VectorGraphics.drawClusterMissile(this.scene);
            } else {
                g = VectorGraphics.drawSubmunition(this.scene);
            }

            // Enable Arcade Physics on this graphics object.
            // This gives it a .body property for velocity, collision, etc.
            this.scene.physics.world.enable(g);

            // Set the physics body size and offset based on projectile type.
            // The offset centers the body on the Graphics' (0,0) origin.
            if (type === 'plasma') {
                g.body.setSize(16, 8);
                g.body.setOffset(-8, -4);
            } else if (type === 'missile') {
                g.body.setSize(20, 12);
                g.body.setOffset(-10, -6);
            } else {
                g.body.setSize(14, 8);
                g.body.setOffset(-7, -4);
            }

            // Projectiles fly in space — no gravity pulling them down
            g.body.setAllowGravity(false);

            // Start inactive (hidden, physics disabled, not rendered)
            g.setActive(false);
            g.setVisible(false);
            g.body.enable = false;

            // Render above terrain but below UI overlay
            g.setDepth(5);

            // Custom data we attach to track each projectile's state.
            // This is our own object — not a Phaser thing.
            g._proj = {
                active: false,       // Is this projectile currently in flight?
                startX: 0,           // Where it was fired from (for distance tracking)
                startY: 0,
                angle: 0,            // Direction it's traveling (radians)
                hasSplit: false,      // (missiles only) Has this missile already split?
                type: type           // What kind of projectile this is
            };

            pool.push(g);
        }

        return pool;
    }

    // =====================================================================
    // POOL HELPERS — Activate / deactivate projectiles
    // =====================================================================

    /**
     * Finds the first inactive projectile in a pool.
     * Returns null if all projectiles are currently in use.
     *
     * @param {Array} pool — The pool to search
     * @returns {Phaser.GameObjects.Graphics|null} — An available projectile, or null
     */
    _getFromPool(pool) {
        for (let i = 0; i < pool.length; i++) {
            if (!pool[i]._proj.active) {
                return pool[i];
            }
        }
        return null;
    }

    /**
     * Activates a projectile — positions it, sets its velocity, makes it visible.
     * This is the "fire" action for a single projectile object.
     *
     * @param {Phaser.GameObjects.Graphics} obj — The projectile to activate
     * @param {number} x — World X position to spawn at
     * @param {number} y — World Y position to spawn at
     * @param {number} angle — Direction of travel in radians
     * @param {number} speed — Velocity in pixels per second
     */
    _activateProjectile(obj, x, y, angle, speed) {
        obj.setPosition(x, y);
        obj.setRotation(angle);
        obj.setActive(true);
        obj.setVisible(true);
        obj.body.enable = true;
        obj.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );

        obj._proj.active = true;
        obj._proj.startX = x;
        obj._proj.startY = y;
        obj._proj.angle = angle;
        obj._proj.hasSplit = false;
    }

    /**
     * Deactivates a projectile — hides it and stops its physics.
     * The object goes back to the pool, ready to be reused.
     *
     * @param {Phaser.GameObjects.Graphics} obj — The projectile to deactivate
     */
    _deactivateProjectile(obj) {
        obj.setActive(false);
        obj.setVisible(false);
        obj.body.enable = false;
        obj.body.setVelocity(0, 0);
        obj._proj.active = false;
    }

    // =====================================================================
    // FIRING METHODS — Called by BattleScene when player presses fire
    // =====================================================================

    /**
     * Fires a PX-9 Plasma Bolt from the ship's nose.
     * Respects the fire rate cooldown — won't fire if it's too soon.
     *
     * @param {number} time — Current game time in milliseconds (from scene.update)
     */
    firePlasma(time) {
        // Check cooldown — don't fire faster than the fire rate allows
        if (time - this.plasmaLastFired < this.plasmaFireRate) return;

        // Grab an inactive bolt from the pool
        const bolt = this._getFromPool(this.plasmaBolts);
        if (!bolt) return;  // Pool exhausted (all bolts in flight — rare)

        this.plasmaLastFired = time;

        // Calculate spawn position at the ship's nose.
        // The ship graphic's nose is at local (30, 0). We rotate that point
        // by the ship's facing angle to get the world-space nose position.
        const angle = this.player.facingAngle;
        const noseX = this.player.container.x + Math.cos(angle) * 30;
        const noseY = this.player.container.y + Math.sin(angle) * 30;

        // Fire the bolt
        this._activateProjectile(bolt, noseX, noseY, angle, this.plasmaSpeed);

        // Show muzzle flash at the nose
        this._showMuzzleFlash(noseX, noseY);

        // Subtle visual recoil on the ship (tiny scale pulse)
        this._shipRecoil();
    }

    /**
     * Fires a CM-3 Cluster Missile from the ship's nose.
     * Respects the fire rate cooldown (1.5s between missiles).
     * The missile will automatically split into 3 submunitions after
     * traveling ~350 pixels (handled in the update method).
     *
     * @param {number} time — Current game time in milliseconds
     */
    fireClusterMissile(time) {
        // Check cooldown
        if (time - this.missileLastFired < this.missileFireRate) return;

        // Grab an inactive missile from the pool
        const missile = this._getFromPool(this.missiles);
        if (!missile) return;

        this.missileLastFired = time;

        // Spawn at the ship's nose, same as plasma
        const angle = this.player.facingAngle;
        const noseX = this.player.container.x + Math.cos(angle) * 30;
        const noseY = this.player.container.y + Math.sin(angle) * 30;

        // Fire the missile
        this._activateProjectile(missile, noseX, noseY, angle, this.missileSpeed);
    }

    // =====================================================================
    // VISUAL EFFECTS — Muzzle flash, recoil, split flash
    // =====================================================================

    /**
     * Shows the muzzle flash at the given position for a brief moment.
     * The flash is a single shared Graphics object — repositioned each shot.
     *
     * @param {number} x — World X position (ship's nose)
     * @param {number} y — World Y position (ship's nose)
     */
    _showMuzzleFlash(x, y) {
        this.muzzleFlash.setPosition(x, y);
        this.muzzleFlash.setVisible(true);
        // Show for ~50ms (about 3 frames at 60fps). The update method
        // counts this down and hides the flash when it reaches 0.
        this.muzzleFlashTimer = 50;
    }

    /**
     * Applies a very subtle visual "recoil" to the ship when firing.
     * This is NOT actual movement — just a tiny scale pulse that makes
     * firing feel punchier. The ship contracts 3% for 30ms then returns.
     */
    _shipRecoil() {
        const container = this.player.container;

        // Only start a recoil if there isn't one already in progress.
        // This prevents stacking tweens from rapid fire.
        if (this._recoilActive) return;
        this._recoilActive = true;

        this.scene.tweens.add({
            targets: container,
            scaleX: 0.97,
            scaleY: 0.97,
            duration: 30,
            yoyo: true,                // Bounce back to normal scale
            ease: 'Quad.easeOut',
            onComplete: () => {
                // Make sure scale is fully restored (floating point safety)
                container.setScale(1);
                this._recoilActive = false;
            }
        });
    }

    /**
     * Shows a flash/burst effect at the point where a missile splits.
     * Uses an expanding, fading circle — grabs one from the flash pool.
     *
     * @param {number} x — World X position of the split
     * @param {number} y — World Y position of the split
     */
    _showSplitFlash(x, y) {
        // Find an available flash in the pool
        const flashData = this.splitFlashes.find(f => !f.active);
        if (!flashData) return;

        // Position and show the flash
        flashData.graphic.setPosition(x, y);
        flashData.graphic.setVisible(true);
        flashData.graphic.setAlpha(1);
        flashData.graphic.setScale(1);
        flashData.active = true;

        // Animate: expand outward while fading to transparent.
        // This creates a quick "pop" effect at the split point.
        this.scene.tweens.add({
            targets: flashData.graphic,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            duration: 180,
            ease: 'Quad.easeOut',
            onComplete: () => {
                flashData.graphic.setVisible(false);
                flashData.graphic.setScale(1);
                flashData.graphic.setAlpha(1);
                flashData.active = false;
            }
        });
    }

    // =====================================================================
    // MISSILE SPLITTING — Converts one missile into 3 submunitions
    // =====================================================================

    /**
     * Splits a cluster missile into 3 submunitions.
     * Called automatically when a missile has traveled far enough.
     *
     * The 3 subs spread out at angles: -17°, 0°, +17° from the
     * original missile's direction. This creates a fan pattern.
     *
     * @param {Phaser.GameObjects.Graphics} missile — The missile to split
     */
    _splitMissile(missile) {
        const data = missile._proj;
        const x = missile.x;
        const y = missile.y;
        const baseAngle = data.angle;

        // Three spread angles: left, center, right
        const offsets = [-this.subSpreadAngle, 0, this.subSpreadAngle];

        for (const offset of offsets) {
            const sub = this._getFromPool(this.submunitions);
            if (!sub) continue;  // Pool exhausted (very unlikely)

            this._activateProjectile(sub, x, y, baseAngle + offset, this.subSpeed);
        }

        // Show the split flash effect
        this._showSplitFlash(x, y);

        // Deactivate the parent missile (it's been replaced by the 3 subs)
        data.hasSplit = true;
        this._deactivateProjectile(missile);
    }

    // =====================================================================
    // UPDATE — Called every frame to manage all active projectiles
    // =====================================================================

    /**
     * Updates all active projectiles. Called once per frame from BattleScene.
     *
     * This method:
     *   1. Counts down and hides the muzzle flash
     *   2. Checks each plasma bolt's distance and deactivates expired ones
     *   3. Checks each missile's distance and triggers split when ready
     *   4. Checks each submunition's distance and deactivates expired ones
     *
     * @param {number} time — Current game time in milliseconds
     * @param {number} delta — Time since last frame in milliseconds
     */
    update(time, delta) {
        const cam = this.scene.cameras.main;
        // Buffer zone beyond the visible screen before we despawn projectiles.
        // This prevents bolts from visibly popping out of existence at screen edges.
        const buffer = 100;

        // --- Muzzle flash countdown ---
        if (this.muzzleFlash.visible) {
            this.muzzleFlashTimer -= delta;
            if (this.muzzleFlashTimer <= 0) {
                this.muzzleFlash.setVisible(false);
            }
        }

        // --- Update plasma bolts ---
        for (let i = 0; i < this.plasmaBolts.length; i++) {
            const bolt = this.plasmaBolts[i];
            if (!bolt._proj.active) continue;

            // Calculate how far this bolt has traveled from its origin
            const dx = bolt.x - bolt._proj.startX;
            const dy = bolt.y - bolt._proj.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Deactivate if it's gone too far or left the screen
            if (dist > this.plasmaMaxDistance || this._isOffScreen(bolt, cam, buffer)) {
                this._deactivateProjectile(bolt);
            }
        }

        // --- Update missiles ---
        for (let i = 0; i < this.missiles.length; i++) {
            const missile = this.missiles[i];
            if (!missile._proj.active) continue;

            // Calculate distance traveled
            const dx = missile.x - missile._proj.startX;
            const dy = missile.y - missile._proj.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Check if it's time to split
            if (dist >= this.missileSplitDistance && !missile._proj.hasSplit) {
                this._splitMissile(missile);
                continue;  // Missile is now deactivated, skip further checks
            }

            // Safety cleanup — deactivate if off screen before split
            // (shouldn't happen normally, but prevents orphaned missiles)
            if (this._isOffScreen(missile, cam, buffer)) {
                this._deactivateProjectile(missile);
            }
        }

        // --- Update submunitions ---
        for (let i = 0; i < this.submunitions.length; i++) {
            const sub = this.submunitions[i];
            if (!sub._proj.active) continue;

            // Calculate distance traveled from spawn (split point)
            const dx = sub.x - sub._proj.startX;
            const dy = sub.y - sub._proj.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Deactivate if past max distance or off screen
            if (dist > this.subMaxDistance || this._isOffScreen(sub, cam, buffer)) {
                this._deactivateProjectile(sub);
            }
        }
    }

    /**
     * Checks if a projectile is beyond the visible screen (plus buffer).
     * Used to clean up projectiles that have left the player's view.
     *
     * @param {Phaser.GameObjects.Graphics} obj — The projectile to check
     * @param {Phaser.Cameras.Scene2D.Camera} cam — The main camera
     * @param {number} buffer — Extra pixels beyond screen edge before despawn
     * @returns {boolean} — True if the object is off screen
     */
    _isOffScreen(obj, cam, buffer) {
        return (
            obj.x < cam.scrollX - buffer ||
            obj.x > cam.scrollX + cam.width + buffer ||
            obj.y < cam.scrollY - buffer ||
            obj.y > cam.scrollY + cam.height + buffer
        );
    }
}
