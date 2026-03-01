/**
 * PlayerShip.js — The player's fighter ship entity
 *
 * This class manages the player's ship: its visual appearance (loaded
 * from a PNG sprite), its physics body, movement, and rotation.
 *
 * The ship is a Phaser Container that holds:
 *   - The ship sprite (loaded from assets/sprites/ — strikewing by default)
 *   - The engine thrust flame (drawn by VectorGraphics.drawThrustFlame)
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

        // --- Draw the engine thrust flame ---
        // Still vector-drawn since it animates (flickers/scales each frame).
        // Positioned behind the ship at the engine exhaust area.
        this.thrustFlame = VectorGraphics.drawThrustFlame(scene);
        this.thrustFlame.setPosition(-48, 0);  // Behind the ship's engines (adjusted for larger sprite)
        this.thrustFlame.setVisible(false);     // Hidden when not thrusting

        // --- Create a container to hold both the sprite and flame ---
        // A container lets us move and rotate the ship + flame together as one unit.
        this.container = scene.add.container(x, y, [this.thrustFlame, this.shipGraphic]);

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

        // --- Thrust flame animation timer ---
        // We'll flicker the flame to make it look alive
        this.thrustFlickerTimer = 0;

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

        // --- Animate the thrust flame ---
        if (isMoving) {
            this.thrustFlame.setVisible(true);

            // Flicker the flame by changing its scale slightly each frame
            this.thrustFlickerTimer += delta;
            const flicker = 0.8 + 0.4 * Math.sin(this.thrustFlickerTimer * 0.015);
            this.thrustFlame.setScale(flicker, 0.7 + 0.3 * Math.sin(this.thrustFlickerTimer * 0.02));
        } else {
            this.thrustFlame.setVisible(false);
        }
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
