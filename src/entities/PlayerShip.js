/**
 * PlayerShip.js — The player's fighter ship entity
 *
 * This class manages the player's ship: its visual appearance (loaded
 * from a PNG sprite), its physics body, movement, and rotation.
 *
 * The ship is a Phaser Container that holds:
 *   - The ship sprite (loaded from assets/sprites/ — strikewing by default)
 *   - Two engine booster flames (drawn by VectorGraphics.drawEngineFlame)
 *     positioned at the upper and lower exhaust ports
 *
 * The ship faces its movement direction (keyboard) or the right-stick
 * aim direction (touch). Movement speed, drag, and acceleration are
 * all configured here.
 */

class PlayerShip {

    /**
     * Creates a new PlayerShip.
     *
     * @param {Phaser.Scene} scene — The scene this ship belongs to
     * @param {number} x — Starting X position in world coordinates
     * @param {number} y — Starting Y position in world coordinates
     * @param {string} [shipType='strikewing'] — Which ship sprite to use
     *                 ('strikewing', 'tempest', or 'hammerfall')
     */
    constructor(scene, x, y, shipType = 'strikewing') {
        this.scene = scene;
        this.shipType = shipType;

        // --- Ship stats ---
        // These control how the ship moves. Tweak these to change the "feel."
        this.maxSpeed = 400;          // Max pixels per second
        this.acceleration = 800;      // How quickly it gets up to speed
        this.drag = 1200;             // How quickly it slows down when not moving (high = snappy stop, low = floaty/icy)

        // --- Ship sprite scale ---
        // The raw PNGs are 576x434. We scale them down to fit the game world.
        // At 0.2 scale, the ship is roughly 115x87 pixels — detailed enough
        // to see the art, small enough to navigate the battlefield.
        this.spriteScale = 0.2;

        // --- Create the ship sprite from the loaded PNG ---
        // This replaces the old vector-drawn ship. The sprite is centered at
        // (0, 0) so it rotates around its center, just like the old graphics.
        this.shipGraphic = scene.add.image(0, 0, shipType);
        this.shipGraphic.setScale(this.spriteScale);

        // --- Draw the two engine booster flames ---
        // The ship sprite has two engine exhaust ports at the rear — one upper,
        // one lower. Each gets its own animated flame graphic so they can
        // flicker independently for a more organic, alive look.
        //
        // These are vector-drawn (not part of the PNG) because they need to
        // animate every frame (scale, alpha changes for flickering).
        //
        // Positioning notes (at 0.2 scale, the sprite is ~115x87px centered at 0,0):
        //   The rear of the ship is at roughly x = -57. The two engine nozzles
        //   on the strikewing sprite sit at approximately y = -12 (upper) and
        //   y = 12 (lower). We place the flames just behind the nozzle openings.

        // Upper engine flame
        this.upperFlame = VectorGraphics.drawEngineFlame(scene);
        this.upperFlame.setPosition(-48, -11);

        // Lower engine flame
        this.lowerFlame = VectorGraphics.drawEngineFlame(scene);
        this.lowerFlame.setPosition(-48, 11);

        // --- Create a container to hold the sprite and both flames ---
        // A container lets us move and rotate the ship + flames together as one unit.
        // Flames are added BEFORE the ship sprite so they render behind it.
        this.container = scene.add.container(x, y, [
            this.upperFlame,
            this.lowerFlame,
            this.shipGraphic
        ]);

        // --- Add physics to the container ---
        // This gives the ship a physics body so it can move, collide, etc.
        scene.physics.world.enable(this.container);

        // Set up the physics body
        // The body is the invisible collision box that the physics engine uses.
        // Sized to cover the core hull of the ship, not the full sprite
        // (wings and gun barrels extend beyond the hitbox — feels fairer).
        this.container.body.setSize(70, 50);        // Collision box size (core hull area)
        this.container.body.setOffset(-35, -25);     // Center the collision box on the container
        this.container.body.setMaxVelocity(this.maxSpeed, this.maxSpeed);
        this.container.body.setDrag(this.drag, this.drag);
        this.container.body.setCollideWorldBounds(true);  // Can't fly off the map edge

        // --- Engine flame animation state ---
        // Two independent timers so the upper and lower flames flicker
        // slightly out of sync (looks more organic than perfectly in-phase).
        this.flameTimerUpper = 0;
        this.flameTimerLower = Math.PI;  // Start half a cycle offset

        // "flamePower" smoothly transitions between 0 (idle) and 1 (full thrust).
        // This controls the flame size and brightness. We lerp it each frame
        // so the flames don't pop instantly — they ramp up and die down.
        this.flamePower = 0;

        // --- Track the angle the ship is facing ---
        // This is in radians. 0 = facing right, PI/2 = facing down, etc.
        this.facingAngle = 0;

        // --- Health system (Phase 4) ---
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.isDead = false;

        // Damage flash state — ship briefly turns white when hit
        this._damageFlashTimer = 0;
        this._isFlashing = false;
    }

    /**
     * Called every frame to update the ship's position and rotation.
     *
     * @param {number} delta — Time since last frame in milliseconds
     * @param {object} moveVector — { x, y } from -1 to 1, the movement direction
     * @param {object|null} aimVector — { x, y } from -1 to 1, the aim direction (touch right stick)
     *                                  null means "face the movement direction" (keyboard mode)
     */
    update(delta, moveVector, aimVector) {
        const body = this.container.body;

        // --- Apply movement ---
        // moveVector comes from InputManager. x and y are each between -1 and 1.
        // We multiply by acceleration to set the velocity change per frame.
        const isMoving = (moveVector.x !== 0 || moveVector.y !== 0);

        if (isMoving) {
            // Accelerate in the direction the player is pressing
            body.setAccelerationX(moveVector.x * this.acceleration);
            body.setAccelerationY(moveVector.y * this.acceleration);
        } else {
            // No input — let drag slow the ship down naturally
            body.setAcceleration(0, 0);
        }

        // --- Update ship rotation ---
        // If there's an aim vector (touch right stick), face that direction.
        // Otherwise, face the movement direction.
        if (aimVector && (aimVector.x !== 0 || aimVector.y !== 0)) {
            // Face the aim direction (right stick on touch)
            this.facingAngle = Math.atan2(aimVector.y, aimVector.x);
        } else if (isMoving) {
            // Face the movement direction (keyboard or left stick only)
            this.facingAngle = Math.atan2(moveVector.y, moveVector.x);
        }
        // If neither moving nor aiming, keep the last facing angle

        // Apply the rotation to the container (Phaser uses radians)
        this.container.setRotation(this.facingAngle);

        // --- Animate the engine booster flames ---
        // Both flames are always visible (they show a small idle glow even
        // when not moving). The "flamePower" value smoothly transitions
        // between idle (0) and full thrust (1) over a few frames.

        // Lerp flamePower toward 1 (moving) or 0 (stationary).
        // The lerp speed (0.08) means it takes roughly 12-15 frames to
        // fully transition — fast enough to feel responsive, slow enough
        // to look like real engines spooling up/down.
        const targetPower = isMoving ? 1 : 0;
        this.flamePower += (targetPower - this.flamePower) * 0.08;

        // Advance the flicker timers (independent speeds for each flame)
        this.flameTimerUpper += delta;
        this.flameTimerLower += delta;

        // --- Compute flicker values for each flame ---
        // We combine two sine waves at different frequencies to create an
        // irregular, organic-looking flicker rather than a smooth pulse.
        // "fast" = rapid flicker (simulates turbulence)
        // "slow" = gentle pulse (simulates thrust variation)
        const upperFastFlicker = Math.sin(this.flameTimerUpper * 0.025);
        const upperSlowPulse  = Math.sin(this.flameTimerUpper * 0.008);
        const lowerFastFlicker = Math.sin(this.flameTimerLower * 0.022);
        const lowerSlowPulse  = Math.sin(this.flameTimerLower * 0.009);

        // --- Scale ranges ---
        // Idle:  small glow  (scaleX 0.2–0.35, scaleY 0.3–0.45)
        // Thrust: large flame (scaleX 0.8–1.2,  scaleY 0.7–1.1)
        // We interpolate between idle and thrust based on flamePower.
        const idleScaleX  = 0.25 + 0.1 * upperFastFlicker;
        const idleScaleY  = 0.35 + 0.1 * upperSlowPulse;
        const thrustScaleX = 0.9  + 0.3 * upperFastFlicker;
        const thrustScaleY = 0.8  + 0.3 * upperSlowPulse;

        const upperSX = idleScaleX + (thrustScaleX - idleScaleX) * this.flamePower;
        const upperSY = idleScaleY + (thrustScaleY - idleScaleY) * this.flamePower;

        // Lower flame uses its own flicker values (slightly different rhythm)
        const idleScaleX2  = 0.25 + 0.1 * lowerFastFlicker;
        const idleScaleY2  = 0.35 + 0.1 * lowerSlowPulse;
        const thrustScaleX2 = 0.9  + 0.3 * lowerFastFlicker;
        const thrustScaleY2 = 0.8  + 0.3 * lowerSlowPulse;

        const lowerSX = idleScaleX2 + (thrustScaleX2 - idleScaleX2) * this.flamePower;
        const lowerSY = idleScaleY2 + (thrustScaleY2 - idleScaleY2) * this.flamePower;

        // --- Alpha ranges ---
        // Idle:  dim glow   (alpha 0.25–0.4)
        // Thrust: bright     (alpha 0.7–1.0)
        const idleAlpha  = 0.3 + 0.1 * upperSlowPulse;
        const thrustAlpha = 0.85 + 0.15 * upperFastFlicker;
        const upperAlpha = idleAlpha + (thrustAlpha - idleAlpha) * this.flamePower;

        const idleAlpha2  = 0.3 + 0.1 * lowerSlowPulse;
        const thrustAlpha2 = 0.85 + 0.15 * lowerFastFlicker;
        const lowerAlpha = idleAlpha2 + (thrustAlpha2 - idleAlpha2) * this.flamePower;

        // Apply the computed scale and alpha to each flame
        this.upperFlame.setScale(upperSX, upperSY);
        this.upperFlame.setAlpha(upperAlpha);
        this.lowerFlame.setScale(lowerSX, lowerSY);
        this.lowerFlame.setAlpha(lowerAlpha);
    }

    /**
     * Returns the ship's current world position.
     * Useful for the camera to know where to follow.
     *
     * @returns {{ x: number, y: number }}
     */
    getPosition() {
        return { x: this.container.x, y: this.container.y };
    }

    /**
     * Returns the underlying Phaser container (for camera follow, etc.)
     * @returns {Phaser.GameObjects.Container}
     */
    getGameObject() {
        return this.container;
    }

    // =================================================================
    // HEALTH SYSTEM (Phase 4)
    // =================================================================

    /**
     * Apply damage to the player ship.
     * Flashes the ship white as feedback. At 0 HP, triggers death.
     *
     * @param {number} amount — Damage to deal
     */
    takeDamage(amount) {
        if (this.isDead) return;

        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;

        // Visual feedback: flash white for a brief moment
        this._triggerDamageFlash();

        if (this.hp <= 0) {
            this.die();
        }
    }

    /**
     * Flash the ship white for 100ms as hit feedback.
     * Uses setTintFill to turn the entire sprite solid white,
     * which is a clear "I got hit" signal. clearTint restores
     * the original sprite colors.
     */
    _triggerDamageFlash() {
        if (this._isFlashing) return;
        this._isFlashing = true;

        // Turn the whole sprite solid white (tint fill covers all pixels)
        this.shipGraphic.setTintFill(0xffffff);

        this.scene.time.delayedCall(100, () => {
            if (!this.isDead) {
                // Remove the tint to restore normal ship colors
                this.shipGraphic.clearTint();
            }
            this._isFlashing = false;
        });
    }

    /**
     * Handle player death — explosion effect and scene restart.
     */
    die() {
        if (this.isDead) return;
        this.isDead = true;

        // Hide the ship
        this.container.setVisible(false);
        this.container.body.enable = false;

        // Play a brief explosion at ship's position
        const explosion = VectorGraphics.drawExplosion(this.scene, 30);
        explosion.setPosition(this.container.x, this.container.y);
        explosion.setDepth(10);

        this.scene.tweens.add({
            targets: explosion,
            alpha: 0,
            scaleX: 3,
            scaleY: 3,
            duration: 500,
            ease: 'Quad.easeOut',
            onComplete: () => {
                explosion.destroy();
                // Restart the scene after explosion finishes
                this.scene.scene.restart();
            }
        });
    }
}
