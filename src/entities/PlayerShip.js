/**
 * PlayerShip.js — The player's fighter ship entity
 *
 * This class manages the player's ship: its visual appearance (drawn with
 * vector graphics), its physics body, movement, and rotation.
 *
 * The ship is a Phaser Container that holds:
 *   - The ship graphic (drawn by VectorGraphics.drawPlayerShip)
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
     */
    constructor(scene, x, y) {
        this.scene = scene;

        // --- Ship stats ---
        // These control how the ship moves. Tweak these to change the "feel."
        this.maxSpeed = 400;          // Max pixels per second
        this.acceleration = 800;      // How quickly it gets up to speed
        this.drag = 1200;             // How quickly it slows down when not moving (high = snappy stop, low = floaty/icy)

        // --- Draw the ship graphic ---
        this.shipGraphic = VectorGraphics.drawPlayerShip(scene);

        // --- Draw the engine thrust flame ---
        // Positioned behind the ship (at the engine exhaust)
        this.thrustFlame = VectorGraphics.drawThrustFlame(scene);
        this.thrustFlame.setPosition(-28, 0);  // Behind the ship's engines
        this.thrustFlame.setVisible(false);     // Hidden when not thrusting

        // --- Create a container to hold both graphics ---
        // A container lets us move and rotate the ship + flame together as one unit.
        // We use a container (not a sprite) because our art is drawn with Graphics objects.
        this.container = scene.add.container(x, y, [this.thrustFlame, this.shipGraphic]);

        // --- Add physics to the container ---
        // This gives the ship a physics body so it can move, collide, etc.
        scene.physics.world.enable(this.container);

        // Set up the physics body
        // The body is the invisible collision box that the physics engine uses
        this.container.body.setSize(56, 40);        // Collision box size (slightly smaller than visual)
        this.container.body.setOffset(-28, -20);     // Center the collision box on the container
        this.container.body.setMaxVelocity(this.maxSpeed, this.maxSpeed);
        this.container.body.setDrag(this.drag, this.drag);
        this.container.body.setCollideWorldBounds(true);  // Can't fly off the map edge

        // --- Thrust flame animation timer ---
        // We'll flicker the flame to make it look alive
        this.thrustFlickerTimer = 0;

        // --- Track the angle the ship is facing ---
        // This is in radians. 0 = facing right, PI/2 = facing down, etc.
        this.facingAngle = 0;
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
}
