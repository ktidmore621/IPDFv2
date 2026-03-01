/**
 * InputManager.js — Keyboard + Touch Dual-Stick Controls
 *
 * This system handles ALL player input. It supports two control schemes
 * that work simultaneously:
 *
 * KEYBOARD:
 *   - WASD or Arrow Keys for 360-degree movement
 *   - Ship faces the movement direction
 *   - No separate aim (aim = movement direction)
 *
 * TOUCH (mobile/tablet):
 *   - Left side of screen: movement joystick (virtual stick appears at touch point)
 *   - Right side of screen: aim joystick (ship faces where right stick points)
 *   - Joysticks appear as translucent circles when touched, disappear on release
 *
 * The InputManager provides two vectors each frame:
 *   - moveVector: { x, y } — direction to move (-1 to 1 each axis, normalized)
 *   - aimVector: { x, y } — direction to aim (null if no aim input / keyboard only)
 */

class InputManager {

    /**
     * @param {Phaser.Scene} scene — The scene this input manager is attached to
     */
    constructor(scene) {
        this.scene = scene;

        // --- Output vectors (read these each frame) ---
        this.moveVector = { x: 0, y: 0 };   // Movement direction
        this.aimVector = null;               // Aim direction (null = use moveVector)

        // =========================================================
        // KEYBOARD SETUP
        // =========================================================

        // Create cursor keys (Arrow Keys)
        this.cursors = scene.input.keyboard.createCursorKeys();

        // Create WASD keys
        this.wasd = {
            up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };

        // =========================================================
        // TOUCH / VIRTUAL JOYSTICK SETUP
        // =========================================================

        // The joystick "dead zone" — how far you have to drag before it registers
        // as input (in pixels). Prevents tiny accidental touches from moving the ship.
        this.joystickDeadZone = 15;

        // Maximum drag distance (in pixels) for full-strength input.
        // Dragging further than this still counts as "full strength."
        this.joystickMaxDistance = 80;

        // --- Left stick state (movement) ---
        this.leftStick = {
            active: false,         // Is the left stick currently being touched?
            pointerId: null,       // Which finger/pointer is controlling it
            startX: 0,            // Where the touch started (center of joystick)
            startY: 0,
            currentX: 0,          // Where the finger is now
            currentY: 0,
            baseGraphic: null,    // The outer ring graphic (drawn below)
            knobGraphic: null     // The inner knob graphic (drawn below)
        };

        // --- Right stick state (aim) ---
        this.rightStick = {
            active: false,
            pointerId: null,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            baseGraphic: null,
            knobGraphic: null
        };

        // --- Create joystick visuals ---
        // These are drawn once and shown/hidden as needed.
        this._createJoystickGraphics();

        // --- Set up touch event listeners ---
        this._setupTouchListeners();
    }

    /**
     * Creates the visual graphics for both joysticks.
     * Each joystick has:
     *   - A "base" ring (large, translucent circle showing the joystick area)
     *   - A "knob" (smaller filled circle showing where the thumb is)
     *
     * Both are created invisible and positioned when a touch starts.
     */
    _createJoystickGraphics() {
        // --- Left joystick base (outer ring) ---
        this.leftStick.baseGraphic = this.scene.add.graphics();
        this.leftStick.baseGraphic.lineStyle(3, 0xffffff, 0.3);
        this.leftStick.baseGraphic.strokeCircle(0, 0, this.joystickMaxDistance);
        this.leftStick.baseGraphic.setVisible(false);
        this.leftStick.baseGraphic.setDepth(1000);  // Always on top of game objects
        this.leftStick.baseGraphic.setScrollFactor(0);  // Fixed to screen, not world

        // --- Left joystick knob (inner circle) ---
        this.leftStick.knobGraphic = this.scene.add.graphics();
        this.leftStick.knobGraphic.fillStyle(0xffffff, 0.4);
        this.leftStick.knobGraphic.fillCircle(0, 0, 20);
        this.leftStick.knobGraphic.setVisible(false);
        this.leftStick.knobGraphic.setDepth(1001);
        this.leftStick.knobGraphic.setScrollFactor(0);

        // --- Right joystick base (outer ring) ---
        this.rightStick.baseGraphic = this.scene.add.graphics();
        this.rightStick.baseGraphic.lineStyle(3, 0xff4444, 0.3);  // Red tint for aim
        this.rightStick.baseGraphic.strokeCircle(0, 0, this.joystickMaxDistance);
        this.rightStick.baseGraphic.setVisible(false);
        this.rightStick.baseGraphic.setDepth(1000);
        this.rightStick.baseGraphic.setScrollFactor(0);

        // --- Right joystick knob (inner circle) ---
        this.rightStick.knobGraphic = this.scene.add.graphics();
        this.rightStick.knobGraphic.fillStyle(0xff4444, 0.4);
        this.rightStick.knobGraphic.fillCircle(0, 0, 20);
        this.rightStick.knobGraphic.setVisible(false);
        this.rightStick.knobGraphic.setDepth(1001);
        this.rightStick.knobGraphic.setScrollFactor(0);
    }

    /**
     * Sets up the raw pointer (touch/mouse) event listeners.
     *
     * We use Phaser's input system which handles both mouse and touch.
     * The left half of the screen controls movement, the right half controls aim.
     */
    _setupTouchListeners() {
        // Allow multiple simultaneous touches
        this.scene.input.addPointer(1);  // Adds a second pointer (Phaser has 1 by default)

        // --- Pointer Down (finger touches screen) ---
        this.scene.input.on('pointerdown', (pointer) => {
            // Get the screen position (not world position — joysticks are screen-relative)
            const screenX = pointer.x;
            const screenY = pointer.y;
            const screenMiddle = this.scene.scale.width / 2;

            if (screenX < screenMiddle && !this.leftStick.active) {
                // Touch on the LEFT half — activate movement joystick
                this._activateStick(this.leftStick, pointer);
            } else if (screenX >= screenMiddle && !this.rightStick.active) {
                // Touch on the RIGHT half — activate aim joystick
                this._activateStick(this.rightStick, pointer);
            }
        });

        // --- Pointer Move (finger drags on screen) ---
        this.scene.input.on('pointermove', (pointer) => {
            if (this.leftStick.active && pointer.id === this.leftStick.pointerId) {
                this._updateStick(this.leftStick, pointer);
            }
            if (this.rightStick.active && pointer.id === this.rightStick.pointerId) {
                this._updateStick(this.rightStick, pointer);
            }
        });

        // --- Pointer Up (finger lifts off screen) ---
        this.scene.input.on('pointerup', (pointer) => {
            if (this.leftStick.active && pointer.id === this.leftStick.pointerId) {
                this._deactivateStick(this.leftStick);
            }
            if (this.rightStick.active && pointer.id === this.rightStick.pointerId) {
                this._deactivateStick(this.rightStick);
            }
        });
    }

    /**
     * Activates a virtual joystick at the pointer's current position.
     *
     * @param {object} stick — The stick state object (leftStick or rightStick)
     * @param {Phaser.Input.Pointer} pointer — The pointer that triggered activation
     */
    _activateStick(stick, pointer) {
        stick.active = true;
        stick.pointerId = pointer.id;
        stick.startX = pointer.x;
        stick.startY = pointer.y;
        stick.currentX = pointer.x;
        stick.currentY = pointer.y;

        // Show the joystick visuals at the touch position
        stick.baseGraphic.setPosition(pointer.x, pointer.y);
        stick.baseGraphic.setVisible(true);
        stick.knobGraphic.setPosition(pointer.x, pointer.y);
        stick.knobGraphic.setVisible(true);
    }

    /**
     * Updates a joystick's current position based on pointer movement.
     *
     * @param {object} stick — The stick state object
     * @param {Phaser.Input.Pointer} pointer — The pointer that moved
     */
    _updateStick(stick, pointer) {
        stick.currentX = pointer.x;
        stick.currentY = pointer.y;

        // Move the knob graphic to follow the finger, but clamp it
        // to the maximum joystick distance from the center
        const dx = pointer.x - stick.startX;
        const dy = pointer.y - stick.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.joystickMaxDistance) {
            // Clamp the knob to the edge of the joystick area
            const angle = Math.atan2(dy, dx);
            stick.knobGraphic.setPosition(
                stick.startX + Math.cos(angle) * this.joystickMaxDistance,
                stick.startY + Math.sin(angle) * this.joystickMaxDistance
            );
        } else {
            stick.knobGraphic.setPosition(pointer.x, pointer.y);
        }
    }

    /**
     * Deactivates a virtual joystick (finger lifted).
     *
     * @param {object} stick — The stick state object
     */
    _deactivateStick(stick) {
        stick.active = false;
        stick.pointerId = null;

        // Hide the joystick visuals
        stick.baseGraphic.setVisible(false);
        stick.knobGraphic.setVisible(false);
    }

    /**
     * Converts a stick's raw position into a normalized direction vector.
     * Returns { x, y } where each component is -1 to 1.
     * Returns { x: 0, y: 0 } if inside the dead zone.
     *
     * @param {object} stick — The stick state object
     * @returns {{ x: number, y: number }}
     */
    _getStickVector(stick) {
        if (!stick.active) {
            return { x: 0, y: 0 };
        }

        const dx = stick.currentX - stick.startX;
        const dy = stick.currentY - stick.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Inside dead zone? Return zero.
        if (dist < this.joystickDeadZone) {
            return { x: 0, y: 0 };
        }

        // Normalize to -1..1 range, where joystickMaxDistance = 1.0
        const strength = Math.min(dist / this.joystickMaxDistance, 1);
        const angle = Math.atan2(dy, dx);

        return {
            x: Math.cos(angle) * strength,
            y: Math.sin(angle) * strength
        };
    }

    /**
     * Called every frame to read all inputs and update moveVector / aimVector.
     * The PlayerShip reads these vectors to know where to go.
     */
    update() {
        // =========================================================
        // KEYBOARD INPUT
        // =========================================================
        let kbX = 0;
        let kbY = 0;

        // Check arrow keys and WASD (both work simultaneously)
        if (this.cursors.left.isDown || this.wasd.left.isDown) kbX -= 1;
        if (this.cursors.right.isDown || this.wasd.right.isDown) kbX += 1;
        if (this.cursors.up.isDown || this.wasd.up.isDown) kbY -= 1;
        if (this.cursors.down.isDown || this.wasd.down.isDown) kbY += 1;

        // Normalize diagonal keyboard input so diagonal isn't faster than cardinal
        // (Without this, pressing W+D would move at ~141% speed)
        if (kbX !== 0 && kbY !== 0) {
            const normalizer = 1 / Math.sqrt(2);  // ≈ 0.707
            kbX *= normalizer;
            kbY *= normalizer;
        }

        // =========================================================
        // TOUCH INPUT
        // =========================================================
        const touchMove = this._getStickVector(this.leftStick);
        const touchAim = this._getStickVector(this.rightStick);

        // =========================================================
        // COMBINE INPUTS
        // =========================================================
        // Keyboard and touch movement add together. If both are used at once,
        // the combined vector is clamped so you can't go faster than max speed.

        let finalX = kbX + touchMove.x;
        let finalY = kbY + touchMove.y;

        // Clamp combined magnitude to 1.0
        const magnitude = Math.sqrt(finalX * finalX + finalY * finalY);
        if (magnitude > 1) {
            finalX /= magnitude;
            finalY /= magnitude;
        }

        this.moveVector.x = finalX;
        this.moveVector.y = finalY;

        // Aim vector: only set if the right stick is active (touch aim)
        if (this.rightStick.active && (touchAim.x !== 0 || touchAim.y !== 0)) {
            this.aimVector = { x: touchAim.x, y: touchAim.y };
        } else {
            this.aimVector = null;  // No aim override — ship faces movement direction
        }
    }
}
