/**
 * EnemyStructures.js — All orc enemy structures and atmospheric units
 *
 * Phase 4 + Sprite Integration — Contains classes for:
 *   - OrcSoldier: atmospheric foot soldier (non-combat, visual only)
 *   - PlasmaTurret: tower with rotating gun, fires red bolts
 *   - MissileSilo: underground silo with doors, launches tracking missiles
 *   - DoubleCannon: twin-barrel bunker, fires green lightning bolts
 *   - MiningPlatform: ore extraction site (mission objective)
 *   - Refinery: large ore processing facility (final mission objective)
 *
 * All structures now use PNG sprites instead of code-drawn graphics.
 * Smoke effects and muzzle flashes are code-drawn (Graphics objects).
 * Elite variants fire faster and use the elite turret sprite.
 */

// =================================================================
// ORC FOOT SOLDIER — Atmospheric, non-combat walking figures
// =================================================================

class OrcSoldier {
    /**
     * Creates an orc soldier walking on the terrain surface.
     * Uses PNG sprite instead of code-drawn graphics.
     * Randomly picks orc_soldier or orc_soldier_alt for variety.
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {number} x — World X position
     * @param {number} groundY — Terrain surface Y at this X
     */
    constructor(scene, x, groundY) {
        this.scene = scene;

        // Randomly pick one of the two orc soldier sprites
        const spriteKey = Math.random() < 0.5 ? 'orc_soldier' : 'orc_soldier_alt';

        // Create the sprite — origin at bottom-center so feet sit on ground
        // orc_soldier.png is 80x117, orc_soldier_alt is 78x120
        // Scale to ~22px tall to match the old code-drawn size
        this.graphic = scene.add.image(x, groundY, spriteKey);
        this.graphic.setOrigin(0.5, 1.0);
        this.graphic.setScale(0.22);
        this.graphic.setDepth(0);

        // Walking state
        this.x = x;
        this.groundY = groundY;
        this.speed = 10 + Math.random() * 15;  // Very slow walking speed
        this.direction = Math.random() < 0.5 ? -1 : 1;  // Left or right
        this.walkRange = 80 + Math.random() * 120;  // How far they wander
        this.startX = x;

        // Shooting state (visual only — red particles when player is near)
        this.isShooting = false;
        this.shootTimer = 0;
        this.shootParticles = [];

        // Pre-create a few particle graphics for the red spray
        for (let i = 0; i < 5; i++) {
            const p = scene.add.graphics();
            p.fillStyle(0xff2222, 0.7);
            p.fillCircle(0, 0, 1.5);
            p.setVisible(false);
            p.setDepth(1);
            this.shootParticles.push({
                graphic: p,
                active: false,
                vx: 0,
                vy: 0,
                life: 0
            });
        }

        // Flip the sprite if walking left
        if (this.direction === -1) {
            this.graphic.setFlipX(true);
        }
    }

    /**
     * Update the soldier each frame — walk and optionally shoot at player.
     */
    update(delta, playerX, playerY, heightMap, worldWidth) {
        const dt = delta / 1000;

        // Check distance to player
        const distToPlayer = Math.sqrt(
            (playerX - this.x) * (playerX - this.x) +
            (playerY - this.groundY) * (playerY - this.groundY)
        );

        // If player is nearby (within 400px), stop and shoot upward
        if (distToPlayer < 400) {
            this.isShooting = true;
            this.shootTimer += delta;

            // Spawn a red spray particle every 200ms
            if (this.shootTimer > 200) {
                this.shootTimer = 0;
                this._spawnRedSpray();
            }
        } else {
            this.isShooting = false;
            this.shootTimer = 0;

            // Walk back and forth
            this.x += this.direction * this.speed * dt;

            // Reverse direction if wandered too far
            if (Math.abs(this.x - this.startX) > this.walkRange) {
                this.direction *= -1;
                this.graphic.setFlipX(this.direction === -1);
            }

            // Keep on terrain surface
            const ix = Math.floor(Math.min(Math.max(this.x, 0), worldWidth - 1));
            this.groundY = heightMap[ix];
            this.graphic.setPosition(this.x, this.groundY);
        }

        // Update shoot particles
        this._updateParticles(dt);
    }

    /**
     * Spawn a small red particle shooting upward — visual only, no damage.
     */
    _spawnRedSpray() {
        const p = this.shootParticles.find(p => !p.active);
        if (!p) return;

        p.active = true;
        p.graphic.setPosition(this.x, this.groundY - 22);
        p.graphic.setVisible(true);
        p.graphic.setAlpha(0.8);
        p.vx = (Math.random() - 0.5) * 30;
        p.vy = -(80 + Math.random() * 60);  // Upward
        p.life = 0.5 + Math.random() * 0.3;
    }

    /**
     * Update active red spray particles.
     */
    _updateParticles(dt) {
        for (const p of this.shootParticles) {
            if (!p.active) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                p.graphic.setVisible(false);
                continue;
            }
            const px = p.graphic.x + p.vx * dt;
            const py = p.graphic.y + p.vy * dt;
            p.graphic.setPosition(px, py);
            p.graphic.setAlpha(Math.max(0, p.life * 1.5));
        }
    }
}


// =================================================================
// BASE ENEMY STRUCTURE — Shared logic for all destructible structures
// =================================================================

class EnemyStructure {
    /**
     * Base constructor for all enemy structures.
     *
     * @param {Phaser.Scene} scene
     * @param {number} x — World X position (center)
     * @param {number} groundY — Terrain surface Y
     * @param {object} config — Structure-specific settings
     */
    constructor(scene, x, groundY, config) {
        this.scene = scene;
        this.x = x;
        this.groundY = groundY;
        this.hp = config.hp;
        this.maxHp = config.hp;
        this.isObjective = config.isObjective || false;
        this.isDestroyed = false;
        this.explosionSize = config.explosionSize || 30;
        this.explosionDamageRadius = config.explosionDamageRadius || 0;
        this.explosionDamageToPlayer = config.explosionDamageToPlayer || 0;
        this.bodyWidth = config.width || 40;
        this.bodyHeight = config.height || 60;
        this.structureType = config.structureType || 'generic';
        this.isElite = config.isElite || false;

        // The container will hold the visual sprite/graphics and has a physics body
        this.container = scene.add.container(x, groundY);
        this.container.setDepth(0);

        // Enable physics on the container for collision detection
        scene.physics.world.enable(this.container);
        this.container.body.setSize(this.bodyWidth, this.bodyHeight);
        // Offset so bottom of body is at ground level, centered horizontally
        this.container.body.setOffset(-this.bodyWidth / 2, -this.bodyHeight);
        this.container.body.setImmovable(true);
        this.container.body.setAllowGravity(false);

        // Store a reference back to this class on the container
        this.container._structure = this;
    }

    /**
     * Called when this structure takes damage.
     * Returns true if the structure was destroyed by this hit.
     */
    takeDamage(damage) {
        if (this.isDestroyed) return false;

        this.hp -= damage;
        this._flashDamage();

        if (this.hp <= 0) {
            this.hp = 0;
            this.destroy();
            return true;
        }
        return false;
    }

    /**
     * Brief white flash to show the structure took a hit.
     */
    _flashDamage() {
        if (this.isDestroyed) return;
        this.container.setAlpha(2.0);
        this.scene.time.delayedCall(80, () => {
            if (!this.isDestroyed && this.container) {
                this.container.setAlpha(1.0);
            }
        });
    }

    /**
     * Destroy this structure — play explosion, remove from scene.
     */
    destroy() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        if (this.container.body) {
            this.container.body.enable = false;
        }

        this.container.setVisible(false);
        this._playExplosion();
    }

    /**
     * Play the destruction explosion effect.
     * Subclasses override this for bigger/custom explosions.
     */
    _playExplosion() {
        const explosion = VectorGraphics.drawExplosion(this.scene, this.explosionSize);
        explosion.setPosition(this.x, this.groundY - this.bodyHeight / 2);
        explosion.setDepth(10);

        this.scene.tweens.add({
            targets: explosion,
            alpha: 0,
            scaleX: 2.5,
            scaleY: 2.5,
            duration: 400,
            ease: 'Quad.easeOut',
            onComplete: () => { explosion.destroy(); }
        });
    }

    /**
     * Show a muzzle flash at the given position with the given color.
     * Creates a small bright circle that fades out quickly.
     *
     * @param {number} x — World X position for the flash
     * @param {number} y — World Y position for the flash
     * @param {number} color — The flash color (hex)
     * @param {number} size — Radius of the flash (default 8)
     */
    _showMuzzleFlash(x, y, color, size) {
        size = size || 8;
        const flash = this.scene.add.graphics();
        flash.setDepth(11);

        // Outer glow
        flash.fillStyle(color, 0.4);
        flash.fillCircle(0, 0, size * 1.8);

        // Bright core
        flash.fillStyle(color, 0.8);
        flash.fillCircle(0, 0, size);

        // White-hot center
        flash.fillStyle(0xffffff, 0.9);
        flash.fillCircle(0, 0, size * 0.4);

        flash.setPosition(x, y);

        // Fade out quickly (~3 frames)
        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 80,
            ease: 'Quad.easeOut',
            onComplete: () => { flash.destroy(); }
        });
    }

    /**
     * Base update — override in subclasses.
     */
    update(time, delta, playerX, playerY) {
        // Override in subclasses
    }
}


// =================================================================
// PLASMA TURRET — Tower with rotating gun, fires red bolts
// =================================================================

class PlasmaTurret extends EnemyStructure {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x — World X
     * @param {number} groundY — Terrain surface Y
     * @param {object} [options] — Optional settings
     * @param {boolean} [options.isElite] — Use elite sprite and faster fire rate
     */
    constructor(scene, x, groundY, options) {
        const isElite = options && options.isElite;

        super(scene, x, groundY, {
            hp: 30,
            width: 50,           // Slightly wider hitbox for PNG sprite
            height: 75,          // Taller hitbox for PNG sprite
            explosionSize: 25,
            structureType: 'turret',
            isElite: isElite
        });

        // Use PNG sprite instead of code-drawn graphics
        // turret.png is 180x232, turret_elite.png is 180x267
        const spriteKey = isElite ? 'turret_elite' : 'turret';
        this.bodySprite = scene.add.image(0, 0, spriteKey);
        this.bodySprite.setOrigin(0.5, 1.0);  // Bottom-center anchor at ground
        this.bodySprite.setScale(0.4);         // Scale to ~72x93 (regular) or ~72x107 (elite)
        this.container.add(this.bodySprite);

        // Draw the rotating barrel (separate for aiming) — kept as Graphics
        this.barrel = VectorGraphics.drawTurretBarrel(scene);
        this.barrel.setPosition(0, -68);  // At the top of the tower
        this.container.add(this.barrel);

        // Firing settings — elite turrets fire faster
        this.range = 600;
        this.fireRate = isElite ? 1000 : 1500;  // Elite: 1.0s, Regular: 1.5s
        this.lastFired = 0;
        this.boltSpeed = 450;
        this.damage = 5;

        // --- Smoke system: toxic green wisps rising from the tower ---
        this.smokeParticles = [];
        this.smokeTimer = 0;
        for (let i = 0; i < 4; i++) {
            const smoke = scene.add.graphics();
            smoke.fillStyle(0x44ff44, 0.15);
            smoke.fillCircle(0, 0, 4 + Math.random() * 3);
            smoke.setVisible(false);
            smoke.setDepth(1);
            this.smokeParticles.push({
                graphic: smoke, active: false,
                vx: 0, vy: 0, life: 0
            });
        }
    }

    update(time, delta, playerX, playerY) {
        if (this.isDestroyed) return;

        // --- Smoke: emit green wisps every 500ms ---
        this.smokeTimer += delta;
        if (this.smokeTimer > 500) {
            this.smokeTimer = 0;
            this._emitSmoke();
        }
        this._updateSmoke(delta / 1000);

        // Calculate distance to player
        const dx = playerX - this.x;
        const dy = playerY - (this.groundY - 68);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.range) return;

        // Aim barrel toward player
        const angle = Math.atan2(dy, dx);
        this.barrel.setRotation(angle);

        // Fire if cooldown has passed
        if (time - this.lastFired >= this.fireRate) {
            this.lastFired = time;
            this._fire(angle);
        }
    }

    _fire(angle) {
        if (!this.scene.combatManager) return;

        const spawnX = this.x + Math.cos(angle) * 24;
        const spawnY = (this.groundY - 68) + Math.sin(angle) * 24;
        this.scene.combatManager.spawnEnemyBolt(
            spawnX, spawnY, angle, this.boltSpeed, this.damage, 'red'
        );

        // Muzzle flash — RED for regular, ORANGE-RED for elite
        const flashColor = this.isElite ? 0xff6600 : 0xff2200;
        const flashSize = this.isElite ? 10 : 8;
        this._showMuzzleFlash(spawnX, spawnY, flashColor, flashSize);
    }

    _emitSmoke() {
        const p = this.smokeParticles.find(p => !p.active);
        if (!p) return;

        p.active = true;
        // Emit from the tower body area
        p.graphic.setPosition(
            this.x + (Math.random() - 0.5) * 10,
            this.groundY - 40 - Math.random() * 20
        );
        p.graphic.setVisible(true);
        p.graphic.setAlpha(0.15);
        p.graphic.setScale(0.5);
        p.vx = (Math.random() - 0.5) * 8;
        p.vy = -(15 + Math.random() * 10);
        p.life = 1.5 + Math.random() * 0.5;
    }

    _updateSmoke(dt) {
        for (const p of this.smokeParticles) {
            if (!p.active) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                p.graphic.setVisible(false);
                continue;
            }
            p.graphic.x += p.vx * dt;
            p.graphic.y += p.vy * dt;
            const scale = 0.5 + (1.5 - p.life) * 0.4;
            p.graphic.setScale(scale);
            p.graphic.setAlpha(Math.max(0, p.life * 0.1));
        }
    }
}


// =================================================================
// MISSILE SILO — Underground silo with sliding doors, tracking missiles
// =================================================================

class MissileSilo extends EnemyStructure {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x — World X
     * @param {number} groundY — Terrain surface Y
     * @param {object} [options] — Optional settings
     * @param {boolean} [options.isElite] — Faster fire rate
     */
    constructor(scene, x, groundY, options) {
        const isElite = options && options.isElite;

        super(scene, x, groundY, {
            hp: 50,
            width: 80,
            height: 35,         // Slightly taller hitbox for sprite
            explosionSize: 40,
            structureType: 'silo',
            isElite: isElite
        });

        // Use PNG sprite — missile_silo.png is 160x123
        this.bodySprite = scene.add.image(0, 0, 'missile_silo');
        this.bodySprite.setOrigin(0.5, 1.0);
        this.bodySprite.setScale(0.55);   // Scale to ~88x68
        this.container.add(this.bodySprite);

        // Animated door graphics (slide open/closed on top of sprite)
        this.leftDoor = scene.add.graphics();
        this.leftDoor.fillStyle(0x3a3a3a, 1);
        this.leftDoor.fillRect(-35, -5, 34, 8);
        this.leftDoor.setPosition(0, 0);
        this.container.add(this.leftDoor);

        this.rightDoor = scene.add.graphics();
        this.rightDoor.fillStyle(0x3a3a3a, 1);
        this.rightDoor.fillRect(1, -5, 34, 8);
        this.rightDoor.setPosition(0, 0);
        this.container.add(this.rightDoor);

        // Silo state
        this.doorsOpen = false;
        this.doorsAnimating = false;
        this.range = 500;
        this.fireRate = isElite ? 2000 : 3000;  // Elite: 2.0s, Regular: 3.0s
        this.lastFired = 0;
        this.missileSpeed = 300;
        this.damage = 25;

        // Gold light flash animation
        this.lightTimer = 0;
        this.lightOn = true;
        this.lights = scene.add.graphics();
        this.lights.setDepth(1);
        this.container.add(this.lights);
        this._drawLights(true);

        // No smoke for missile silo — it's underground and sealed
    }

    _drawLights(on) {
        this.lights.clear();
        const alpha = on ? 0.9 : 0.2;
        this.lights.fillStyle(0xffcc00, alpha);
        this.lights.fillCircle(-42, -20, 3);
        this.lights.fillCircle(42, -20, 3);
    }

    _setDoors(open) {
        if (this.doorsAnimating) return;
        if (open === this.doorsOpen) return;

        this.doorsAnimating = true;
        this.doorsOpen = open;

        this.scene.tweens.add({
            targets: this.leftDoor,
            x: open ? -20 : 0,
            duration: 400,
            ease: 'Quad.easeInOut',
            onComplete: () => { this.doorsAnimating = false; }
        });

        this.scene.tweens.add({
            targets: this.rightDoor,
            x: open ? 20 : 0,
            duration: 400,
            ease: 'Quad.easeInOut'
        });
    }

    update(time, delta, playerX, playerY) {
        if (this.isDestroyed) return;

        // Blink the gold lights every 500ms
        this.lightTimer += delta;
        if (this.lightTimer > 500) {
            this.lightTimer = 0;
            this.lightOn = !this.lightOn;
            this._drawLights(this.lightOn);
        }

        // Calculate distance to player
        const dx = playerX - this.x;
        const dy = playerY - this.groundY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.range) {
            this._setDoors(true);

            if (this.doorsOpen && !this.doorsAnimating && time - this.lastFired >= this.fireRate) {
                this.lastFired = time;
                this._fireMissile(playerX, playerY);
            }
        } else {
            this._setDoors(false);
        }
    }

    _fireMissile(playerX, playerY) {
        if (!this.scene.combatManager) return;

        this.scene.combatManager.spawnTrackingMissile(
            this.x, this.groundY - 15, this.missileSpeed, this.damage
        );

        // Muzzle flash — bright YELLOW-WHITE from inside the silo
        this._showMuzzleFlash(this.x, this.groundY - 15, 0xffffaa, 14);
    }

    _playExplosion() {
        const explosion = VectorGraphics.drawExplosion(this.scene, 40);
        explosion.setPosition(this.x, this.groundY - 10);
        explosion.setDepth(10);

        this.scene.tweens.add({
            targets: explosion,
            alpha: 0,
            scaleX: 3,
            scaleY: 3,
            duration: 500,
            ease: 'Quad.easeOut',
            onComplete: () => { explosion.destroy(); }
        });

        // Smoke puff that lingers
        const smoke = this.scene.add.graphics();
        smoke.fillStyle(0x444444, 0.5);
        smoke.fillCircle(0, 0, 20);
        smoke.setPosition(this.x, this.groundY - 15);
        smoke.setDepth(9);

        this.scene.tweens.add({
            targets: smoke,
            alpha: 0,
            y: this.groundY - 60,
            scaleX: 2,
            scaleY: 2,
            duration: 1200,
            ease: 'Quad.easeOut',
            onComplete: () => { smoke.destroy(); }
        });
    }
}


// =================================================================
// DOUBLE CANNON — Twin barrels on a reinforced bunker
// =================================================================

class DoubleCannon extends EnemyStructure {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x — World X
     * @param {number} groundY — Terrain surface Y
     * @param {object} [options] — Optional settings
     * @param {boolean} [options.isElite] — Faster fire rate
     */
    constructor(scene, x, groundY, options) {
        const isElite = options && options.isElite;

        super(scene, x, groundY, {
            hp: 50,
            width: 90,           // Wider hitbox for PNG sprite
            height: 60,          // Taller hitbox for PNG sprite
            explosionSize: 35,
            structureType: 'cannon',
            isElite: isElite
        });

        // Use PNG sprite — double_cannon.png is 236x210
        this.bodySprite = scene.add.image(0, 0, 'double_cannon');
        this.bodySprite.setOrigin(0.5, 1.0);
        this.bodySprite.setScale(0.42);   // Scale to ~99x88
        this.container.add(this.bodySprite);

        // Twin barrels (separate for rotation) — kept as Graphics
        this.barrels = VectorGraphics.drawCannonBarrels(scene);
        this.barrels.setPosition(0, -30);
        this.container.add(this.barrels);

        // Firing settings — elite cannons fire faster
        this.range = 700;
        this.fireRate = isElite ? 1500 : 2000;  // Elite: 1.5s, Regular: 2.0s
        this.lastFired = 0;
        this.boltSpeed = 500;
        this.damage = 10;

        // --- Smoke system: purple smoke from bunker pipes ---
        this.smokeParticles = [];
        this.smokeTimer = 0;
        for (let i = 0; i < 4; i++) {
            const smoke = scene.add.graphics();
            smoke.fillStyle(0x9944cc, 0.15);
            smoke.fillCircle(0, 0, 4 + Math.random() * 3);
            smoke.setVisible(false);
            smoke.setDepth(1);
            this.smokeParticles.push({
                graphic: smoke, active: false,
                vx: 0, vy: 0, life: 0
            });
        }
    }

    update(time, delta, playerX, playerY) {
        if (this.isDestroyed) return;

        // --- Smoke: emit purple wisps every 500ms ---
        this.smokeTimer += delta;
        if (this.smokeTimer > 500) {
            this.smokeTimer = 0;
            this._emitSmoke();
        }
        this._updateSmoke(delta / 1000);

        // Calculate distance to player
        const dx = playerX - this.x;
        const dy = playerY - (this.groundY - 30);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.range) return;

        // Aim barrels toward player
        const angle = Math.atan2(dy, dx);
        this.barrels.setRotation(angle);

        // Fire twin bolts if cooldown passed
        if (time - this.lastFired >= this.fireRate) {
            this.lastFired = time;
            this._fireTwinBolts(angle);
        }
    }

    _fireTwinBolts(angle) {
        if (!this.scene.combatManager) return;

        const perpAngle = angle + Math.PI / 2;
        const offset = 5.5;

        // Upper barrel bolt
        const x1 = this.x + Math.cos(angle) * 30 + Math.cos(perpAngle) * offset;
        const y1 = (this.groundY - 30) + Math.sin(angle) * 30 + Math.sin(perpAngle) * offset;

        // Lower barrel bolt
        const x2 = this.x + Math.cos(angle) * 30 - Math.cos(perpAngle) * offset;
        const y2 = (this.groundY - 30) + Math.sin(angle) * 30 - Math.sin(perpAngle) * offset;

        this.scene.combatManager.spawnEnemyBolt(x1, y1, angle, this.boltSpeed, this.damage, 'green');
        this.scene.combatManager.spawnEnemyBolt(x2, y2, angle, this.boltSpeed, this.damage, 'green');

        // Muzzle flash — bright GREEN at BOTH barrel tips
        this._showMuzzleFlash(x1, y1, 0x44ff44, 8);
        this._showMuzzleFlash(x2, y2, 0x44ff44, 8);
    }

    _emitSmoke() {
        const p = this.smokeParticles.find(p => !p.active);
        if (!p) return;

        p.active = true;
        // Emit from the pipe area on the side of the bunker
        p.graphic.setPosition(
            this.x + (Math.random() < 0.5 ? -35 : 35),
            this.groundY - 15 - Math.random() * 20
        );
        p.graphic.setVisible(true);
        p.graphic.setAlpha(0.15);
        p.graphic.setScale(0.5);
        p.vx = (Math.random() - 0.5) * 8;
        p.vy = -(12 + Math.random() * 10);
        p.life = 1.5 + Math.random() * 0.5;
    }

    _updateSmoke(dt) {
        for (const p of this.smokeParticles) {
            if (!p.active) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                p.graphic.setVisible(false);
                continue;
            }
            p.graphic.x += p.vx * dt;
            p.graphic.y += p.vy * dt;
            const scale = 0.5 + (1.5 - p.life) * 0.4;
            p.graphic.setScale(scale);
            p.graphic.setAlpha(Math.max(0, p.life * 0.1));
        }
    }

    _playExplosion() {
        const explosion = VectorGraphics.drawExplosion(this.scene, 35);
        explosion.setPosition(this.x, this.groundY - 25);
        explosion.setDepth(10);

        this.scene.tweens.add({
            targets: explosion,
            alpha: 0,
            scaleX: 2.5,
            scaleY: 2.5,
            duration: 400,
            ease: 'Quad.easeOut',
            onComplete: () => { explosion.destroy(); }
        });

        // Green spark particles
        for (let i = 0; i < 6; i++) {
            const spark = this.scene.add.graphics();
            spark.fillStyle(0x44ff44, 0.8);
            spark.fillCircle(0, 0, 3);
            spark.setPosition(this.x, this.groundY - 25);
            spark.setDepth(11);

            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 60;

            this.scene.tweens.add({
                targets: spark,
                x: this.x + Math.cos(angle) * dist,
                y: (this.groundY - 25) + Math.sin(angle) * dist,
                alpha: 0,
                duration: 300 + Math.random() * 200,
                ease: 'Quad.easeOut',
                onComplete: () => { spark.destroy(); }
            });
        }
    }
}


// =================================================================
// MINING PLATFORM — Ore extraction site (mission objective)
// =================================================================

class MiningPlatform extends EnemyStructure {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x — World X
     * @param {number} groundY — Terrain surface Y
     */
    constructor(scene, x, groundY) {
        super(scene, x, groundY, {
            hp: 60,
            width: 100,          // Hitbox sized for sprite
            height: 140,         // Taller for the tall sprite
            isObjective: true,
            explosionSize: 50,
            explosionDamageRadius: 150,
            explosionDamageToPlayer: 15,
            structureType: 'mining'
        });

        // Use PNG sprite — mining_platform.png is 237x400
        this.bodySprite = scene.add.image(0, 0, 'mining_platform');
        this.bodySprite.setOrigin(0.5, 1.0);
        this.bodySprite.setScale(0.4);   // Scale to ~95x160
        this.container.add(this.bodySprite);

        // --- Heavy toxic smoke system — 4-6 puffs at a time ---
        // Mix of green and yellowish-green, thicker and more opaque
        this.smokeParticles = [];
        this.smokeTimer = 0;

        for (let i = 0; i < 12; i++) {
            const smoke = scene.add.graphics();
            // Alternate between green and yellowish-green
            if (i % 2 === 0) {
                smoke.fillStyle(0x44aa22, 0.25);
            } else {
                smoke.fillStyle(0x88aa22, 0.2);
            }
            smoke.fillCircle(0, 0, 6 + Math.random() * 5);
            smoke.setVisible(false);
            smoke.setDepth(1);
            this.smokeParticles.push({
                graphic: smoke, active: false,
                vx: 0, vy: 0, life: 0
            });
        }
    }

    update(time, delta, playerX, playerY) {
        if (this.isDestroyed) return;

        // Emit heavy toxic smoke frequently — 4-6 puffs per emission
        this.smokeTimer += delta;
        if (this.smokeTimer > 200) {
            this.smokeTimer = 0;
            // Emit 2 puffs per cycle for thick cloud
            this._emitSmoke();
            this._emitSmoke();
        }

        this._updateSmoke(delta / 1000);
    }

    _emitSmoke() {
        const p = this.smokeParticles.find(p => !p.active);
        if (!p) return;

        p.active = true;
        // Exhaust vent area — near top of the platform
        p.graphic.setPosition(
            this.x + 15 + (Math.random() - 0.5) * 20,
            this.groundY - 100 - Math.random() * 20
        );
        p.graphic.setVisible(true);
        p.graphic.setAlpha(0.35);
        p.graphic.setScale(0.6);
        p.vx = (Math.random() - 0.5) * 15;
        p.vy = -(25 + Math.random() * 20);
        p.life = 2.0 + Math.random() * 1.0;
    }

    _updateSmoke(dt) {
        for (const p of this.smokeParticles) {
            if (!p.active) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                p.graphic.setVisible(false);
                continue;
            }
            p.graphic.x += p.vx * dt;
            p.graphic.y += p.vy * dt;
            const scale = 0.6 + (2.0 - p.life) * 0.5;
            p.graphic.setScale(scale);
            p.graphic.setAlpha(Math.max(0, p.life * 0.18));
        }
    }

    _playExplosion() {
        const cx = this.x;
        const cy = this.groundY - 45;

        const explosion = VectorGraphics.drawExplosion(this.scene, 50);
        explosion.setPosition(cx, cy);
        explosion.setDepth(10);

        this.scene.tweens.add({
            targets: explosion,
            alpha: 0,
            scaleX: 3.5,
            scaleY: 3.5,
            duration: 600,
            ease: 'Quad.easeOut',
            onComplete: () => { explosion.destroy(); }
        });

        // Debris particles
        for (let i = 0; i < 10; i++) {
            const debris = this.scene.add.graphics();
            if (i < 5) {
                debris.fillStyle(0xff6600, 0.8);
                debris.fillRect(-3, -3, 6, 4);
            } else {
                debris.fillStyle(0x4a3a1a, 0.9);
                debris.fillRect(-4, -2, 8, 4);
            }
            debris.setPosition(cx, cy);
            debris.setDepth(11);

            const angle = Math.random() * Math.PI * 2;
            const dist = 80 + Math.random() * 100;

            this.scene.tweens.add({
                targets: debris,
                x: cx + Math.cos(angle) * dist,
                y: cy + Math.sin(angle) * dist,
                alpha: 0,
                rotation: Math.random() * 4,
                duration: 400 + Math.random() * 300,
                ease: 'Quad.easeOut',
                onComplete: () => { debris.destroy(); }
            });
        }

        // Hide smoke particles
        for (const p of this.smokeParticles) {
            p.active = false;
            p.graphic.setVisible(false);
        }
    }
}


// =================================================================
// REFINERY — Large ore processing facility (final mission objective)
// =================================================================

class Refinery extends EnemyStructure {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x — World X
     * @param {number} groundY — Terrain surface Y
     */
    constructor(scene, x, groundY) {
        super(scene, x, groundY, {
            hp: 120,
            width: 200,          // Wide hitbox for the large sprite
            height: 160,         // Tall hitbox for the large sprite
            isObjective: true,
            explosionSize: 80,
            explosionDamageRadius: 300,
            explosionDamageToPlayer: 30,
            structureType: 'refinery'
        });

        // Use PNG sprite — refinery.png is 463x400
        this.bodySprite = scene.add.image(0, 0, 'refinery');
        this.bodySprite.setOrigin(0.5, 1.0);
        this.bodySprite.setScale(0.45);   // Scale to ~208x180
        this.container.add(this.bodySprite);

        // --- Heavy dark smoke system — 6-8 puffs continuously ---
        // Dark purple-black smoke with purplish-red glow from Voidheart Ore
        this.smokeParticles = [];
        this.smokeTimer = 0;

        // Smokestack positions relative to refinery center (approximate)
        this.smokestacks = [
            { x: -24, y: -138 },
            { x: 1, y: -148 },
            { x: 26, y: -133 }
        ];

        // Create more particles for heavy smoke
        for (let i = 0; i < 20; i++) {
            const smoke = scene.add.graphics();
            // Mix of dark purple-black and purplish-red glow
            if (i % 3 === 0) {
                // Purplish-red glow from Voidheart Ore processing
                smoke.fillStyle(0x8b2252, 0.15);
                smoke.fillCircle(0, 0, 8 + Math.random() * 5);
            } else {
                // Dark purple-black
                smoke.fillStyle(0x1a0a1a, 0.3);
                smoke.fillCircle(0, 0, 10 + Math.random() * 6);
            }
            smoke.setVisible(false);
            smoke.setDepth(1);
            this.smokeParticles.push({
                graphic: smoke, active: false,
                vx: 0, vy: 0, life: 0
            });
        }
    }

    update(time, delta, playerX, playerY) {
        if (this.isDestroyed) return;

        // Emit heavy dark smoke continuously — multiple puffs per cycle
        this.smokeTimer += delta;
        if (this.smokeTimer > 150) {
            this.smokeTimer = 0;
            // Emit 2-3 puffs per cycle for very thick cloud
            const stack1 = this.smokestacks[Math.floor(Math.random() * 3)];
            const stack2 = this.smokestacks[Math.floor(Math.random() * 3)];
            this._emitSmoke(stack1);
            this._emitSmoke(stack2);
        }

        this._updateSmoke(delta / 1000);
    }

    _emitSmoke(stack) {
        const p = this.smokeParticles.find(p => !p.active);
        if (!p) return;

        p.active = true;
        p.graphic.setPosition(this.x + stack.x, this.groundY + stack.y);
        p.graphic.setVisible(true);
        p.graphic.setAlpha(0.45);
        p.graphic.setScale(0.7);
        p.vx = (Math.random() - 0.5) * 18;
        p.vy = -(20 + Math.random() * 20);
        p.life = 2.5 + Math.random() * 1.5;
    }

    _updateSmoke(dt) {
        for (const p of this.smokeParticles) {
            if (!p.active) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                p.graphic.setVisible(false);
                continue;
            }
            p.graphic.x += p.vx * dt;
            p.graphic.y += p.vy * dt;
            // Grow and spread as it rises
            const scale = 0.7 + (2.5 - p.life) * 0.5;
            p.graphic.setScale(scale);
            p.graphic.setAlpha(Math.max(0, p.life * 0.15));
        }
    }

    _playExplosion() {
        const cx = this.x;
        const cy = this.groundY - 75;

        // Massive fireball
        const explosion = VectorGraphics.drawExplosion(this.scene, 80);
        explosion.setPosition(cx, cy);
        explosion.setDepth(10);

        this.scene.tweens.add({
            targets: explosion,
            alpha: 0,
            scaleX: 4,
            scaleY: 4,
            duration: 800,
            ease: 'Quad.easeOut',
            onComplete: () => { explosion.destroy(); }
        });

        // Secondary smaller explosions
        for (let i = 0; i < 3; i++) {
            this.scene.time.delayedCall(100 + i * 150, () => {
                const subExp = VectorGraphics.drawExplosion(this.scene, 30);
                const sx = cx + (Math.random() - 0.5) * 100;
                const sy = cy + (Math.random() - 0.5) * 60;
                subExp.setPosition(sx, sy);
                subExp.setDepth(10);

                this.scene.tweens.add({
                    targets: subExp,
                    alpha: 0,
                    scaleX: 2.5,
                    scaleY: 2.5,
                    duration: 500,
                    ease: 'Quad.easeOut',
                    onComplete: () => { subExp.destroy(); }
                });
            });
        }

        // Shrapnel debris
        for (let i = 0; i < 16; i++) {
            const shrapnel = this.scene.add.graphics();
            shrapnel.fillStyle(0x6a5a3a, 0.9);
            const sw = 4 + Math.random() * 6;
            const sh = 2 + Math.random() * 4;
            shrapnel.fillRect(-sw / 2, -sh / 2, sw, sh);
            shrapnel.setPosition(cx, cy);
            shrapnel.setDepth(12);

            const angle = Math.random() * Math.PI * 2;
            const dist = 150 + Math.random() * 200;

            this.scene.tweens.add({
                targets: shrapnel,
                x: cx + Math.cos(angle) * dist,
                y: cy + Math.sin(angle) * dist,
                alpha: 0,
                rotation: Math.random() * 8 - 4,
                duration: 500 + Math.random() * 400,
                ease: 'Quad.easeOut',
                onComplete: () => { shrapnel.destroy(); }
            });
        }

        // Hide smoke particles
        for (const p of this.smokeParticles) {
            p.active = false;
            p.graphic.setVisible(false);
        }
    }
}
