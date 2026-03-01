/**
 * EnemyStructures.js — All orc enemy structures and atmospheric units
 *
 * Phase 4 — Contains classes for:
 *   - OrcSoldier: atmospheric foot soldier (non-combat, visual only)
 *   - PlasmaTurret: tower with rotating gun, fires red bolts
 *   - MissileSilo: underground silo with doors, launches tracking missiles
 *   - DoubleCannon: twin-barrel bunker, fires green lightning bolts
 *   - MiningPlatform: ore extraction site (mission objective)
 *   - Refinery: large ore processing facility (final mission objective)
 *
 * All structures are placed ON the terrain using heightMap data.
 * Visual style: junk architecture — rusty, mismatched salvage, dirty greens
 * and rusty browns, asymmetric shapes, exposed pipes and bolts.
 */

// =================================================================
// ORC FOOT SOLDIER — Atmospheric, non-combat walking figures
// =================================================================

class OrcSoldier {
    /**
     * Creates an orc soldier walking on the terrain surface.
     * Purely visual — no damage, no collision, no health.
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {number} x — World X position
     * @param {number} groundY — Terrain surface Y at this X
     */
    constructor(scene, x, groundY) {
        this.scene = scene;

        // Draw the orc figure
        this.graphic = VectorGraphics.drawOrcSoldier(scene);
        this.graphic.setPosition(x, groundY);
        this.graphic.setDepth(0);  // On top of terrain, below player

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

        // Flip the graphic if walking left
        if (this.direction === -1) {
            this.graphic.setScale(-1, 1);
        }
    }

    /**
     * Update the soldier each frame — walk and optionally shoot at player.
     *
     * @param {number} delta — Frame time in ms
     * @param {number} playerX — Player X position
     * @param {number} playerY — Player Y position
     * @param {number[]} heightMap — Terrain heightmap for surface tracking
     * @param {number} worldWidth — World width
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
                this.graphic.setScale(this.direction === -1 ? -1 : 1, 1);
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
     * @param {object} config — Structure-specific settings:
     *   - hp: max health points
     *   - width: collision body width
     *   - height: collision body height
     *   - isObjective: whether this counts as a mission objective
     *   - explosionSize: radius of destruction explosion
     *   - explosionDamageRadius: radius that damages nearby things
     *   - explosionDamageToPlayer: HP damage if player is caught in blast
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

        // The container will hold the visual graphics and have a physics body
        this.container = scene.add.container(x, groundY);
        this.container.setDepth(0);

        // Enable physics on the container for collision detection
        scene.physics.world.enable(this.container);
        this.container.body.setSize(this.bodyWidth, this.bodyHeight);
        // Offset so bottom of body is at ground level, centered horizontally
        this.container.body.setOffset(-this.bodyWidth / 2, -this.bodyHeight);
        this.container.body.setImmovable(true);  // Structures don't move
        this.container.body.setAllowGravity(false);

        // Store a reference back to this class on the container
        // so the CombatManager can find the structure from collision
        this.container._structure = this;
    }

    /**
     * Called when this structure takes damage.
     * Returns true if the structure was destroyed by this hit.
     *
     * @param {number} damage — Amount of damage
     * @returns {boolean} — True if destroyed
     */
    takeDamage(damage) {
        if (this.isDestroyed) return false;

        this.hp -= damage;

        // Flash the structure white briefly for damage feedback
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
        // Tint the container's children white briefly
        this.container.setAlpha(2.0);  // Bright flash
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

        // Disable physics body
        if (this.container.body) {
            this.container.body.enable = false;
        }

        // Hide the structure
        this.container.setVisible(false);

        // Play explosion effect at this position
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

        // Expand and fade out
        this.scene.tweens.add({
            targets: explosion,
            alpha: 0,
            scaleX: 2.5,
            scaleY: 2.5,
            duration: 400,
            ease: 'Quad.easeOut',
            onComplete: () => {
                explosion.destroy();
            }
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
     */
    constructor(scene, x, groundY) {
        super(scene, x, groundY, {
            hp: 30,              // 5-6 plasma hits (5 dmg each)
            width: 40,
            height: 65,
            explosionSize: 25,
            structureType: 'turret'
        });

        // Draw the tower body (stationary part)
        this.bodyGraphic = VectorGraphics.drawPlasmaTurret(scene);
        this.container.add(this.bodyGraphic);

        // Draw the rotating barrel (separate so it can aim)
        this.barrel = VectorGraphics.drawTurretBarrel(scene);
        this.barrel.setPosition(0, -68);  // At the top of the tower where the orc sits
        this.container.add(this.barrel);

        // Firing settings
        this.range = 600;              // Detection/firing range in pixels
        this.fireRate = 1500;          // 1.5 seconds between shots
        this.lastFired = 0;
        this.boltSpeed = 450;          // How fast the red bolts travel
        this.damage = 5;               // Damage per hit to player
    }

    /**
     * Aim the barrel at the player and fire when in range.
     */
    update(time, delta, playerX, playerY) {
        if (this.isDestroyed) return;

        // Calculate distance to player
        const dx = playerX - this.x;
        const dy = playerY - (this.groundY - 68);  // Barrel position
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.range) return;  // Player not in range

        // Aim barrel toward player
        const angle = Math.atan2(dy, dx);
        this.barrel.setRotation(angle);

        // Fire if cooldown has passed
        if (time - this.lastFired >= this.fireRate) {
            this.lastFired = time;
            this._fire(angle, playerX, playerY);
        }
    }

    /**
     * Fire a red energy bolt toward where the player currently is.
     * The bolt is non-tracking — travels in a straight line.
     */
    _fire(angle, playerX, playerY) {
        // Get the combat manager from the scene to spawn enemy projectile
        if (this.scene.combatManager) {
            const spawnX = this.x + Math.cos(angle) * 24;
            const spawnY = (this.groundY - 68) + Math.sin(angle) * 24;
            this.scene.combatManager.spawnEnemyBolt(
                spawnX, spawnY, angle, this.boltSpeed, this.damage, 'red'
            );
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
     */
    constructor(scene, x, groundY) {
        super(scene, x, groundY, {
            hp: 50,              // 8-10 plasma hits or 2 cluster missiles
            width: 80,
            height: 25,
            explosionSize: 40,
            structureType: 'silo'
        });

        // Draw the silo body (static visual with doors)
        this.bodyGraphic = VectorGraphics.drawMissileSilo(scene);
        this.container.add(this.bodyGraphic);

        // Create animated door graphics (separate so they can slide open)
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
        this.fireRate = 3000;          // 3 seconds between missiles
        this.lastFired = 0;
        this.missileSpeed = 300;       // Tracking missiles — moderate speed
        this.damage = 25;

        // Gold light flash animation (blinks)
        this.lightTimer = 0;
        this.lightOn = true;

        // Create light graphics for the flashing gold lights
        this.lights = scene.add.graphics();
        this.lights.setDepth(1);
        this.container.add(this.lights);
        this._drawLights(true);
    }

    /**
     * Redraw the gold lights (on or off state).
     */
    _drawLights(on) {
        this.lights.clear();
        const alpha = on ? 0.9 : 0.2;
        this.lights.fillStyle(0xffcc00, alpha);
        this.lights.fillCircle(-42, -20, 3);
        this.lights.fillCircle(42, -20, 3);
    }

    /**
     * Open or close the silo doors with animation.
     */
    _setDoors(open) {
        if (this.doorsAnimating) return;
        if (open === this.doorsOpen) return;

        this.doorsAnimating = true;
        this.doorsOpen = open;

        // Doors slide horizontally apart (open) or together (close)
        const targetX = open ? 20 : 0;

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
            // Player in range — open doors and fire
            this._setDoors(true);

            // Fire a tracking missile if cooldown passed and doors are open
            if (this.doorsOpen && !this.doorsAnimating && time - this.lastFired >= this.fireRate) {
                this.lastFired = time;
                this._fireMissile(playerX, playerY);
            }
        } else {
            // Player out of range — close doors
            this._setDoors(false);
        }
    }

    /**
     * Launch a tracking missile from the silo.
     */
    _fireMissile(playerX, playerY) {
        if (this.scene.combatManager) {
            // Launch upward from the silo
            this.scene.combatManager.spawnTrackingMissile(
                this.x, this.groundY - 15, this.missileSpeed, this.damage
            );
        }
    }

    /**
     * Override explosion for silo — larger with door debris.
     */
    _playExplosion() {
        // Main explosion
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
     */
    constructor(scene, x, groundY) {
        super(scene, x, groundY, {
            hp: 50,              // 8-10 plasma hits or 2 cluster missiles
            width: 80,
            height: 50,
            explosionSize: 35,
            structureType: 'cannon'
        });

        // Draw the bunker body
        this.bodyGraphic = VectorGraphics.drawDoubleCannon(scene);
        this.container.add(this.bodyGraphic);

        // Draw the twin barrels (separate for rotation)
        this.barrels = VectorGraphics.drawCannonBarrels(scene);
        this.barrels.setPosition(0, -30);  // Center of bunker face
        this.container.add(this.barrels);

        // Firing settings
        this.range = 700;
        this.fireRate = 2000;          // 2 seconds between bursts
        this.lastFired = 0;
        this.boltSpeed = 500;
        this.damage = 10;              // 10 per bolt, 20 if both hit
    }

    update(time, delta, playerX, playerY) {
        if (this.isDestroyed) return;

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

    /**
     * Fire two green lightning bolts simultaneously.
     */
    _fireTwinBolts(angle) {
        if (!this.scene.combatManager) return;

        // Calculate perpendicular offset for the two barrels
        const perpAngle = angle + Math.PI / 2;
        const offset = 5.5;  // Half the distance between barrel centers

        // Upper barrel bolt
        const x1 = this.x + Math.cos(angle) * 30 + Math.cos(perpAngle) * offset;
        const y1 = (this.groundY - 30) + Math.sin(angle) * 30 + Math.sin(perpAngle) * offset;

        // Lower barrel bolt
        const x2 = this.x + Math.cos(angle) * 30 - Math.cos(perpAngle) * offset;
        const y2 = (this.groundY - 30) + Math.sin(angle) * 30 - Math.sin(perpAngle) * offset;

        this.scene.combatManager.spawnEnemyBolt(x1, y1, angle, this.boltSpeed, this.damage, 'green');
        this.scene.combatManager.spawnEnemyBolt(x2, y2, angle, this.boltSpeed, this.damage, 'green');
    }

    /**
     * Override explosion — green sparks for the cannon.
     */
    _playExplosion() {
        // Main explosion
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
            hp: 60,              // 10-12 plasma hits or 3 cluster missiles
            width: 140,
            height: 90,
            isObjective: true,
            explosionSize: 50,
            explosionDamageRadius: 150,
            explosionDamageToPlayer: 15,
            structureType: 'mining'
        });

        // Draw the mining platform visual
        this.bodyGraphic = VectorGraphics.drawMiningPlatform(scene);
        this.container.add(this.bodyGraphic);

        // Toxic smoke system — particles drifting upward from exhaust
        this.smokeParticles = [];
        this.smokeTimer = 0;

        // Pre-create smoke particle graphics
        for (let i = 0; i < 8; i++) {
            const smoke = scene.add.graphics();
            smoke.fillStyle(0x8b2252, 0.2);
            smoke.fillCircle(0, 0, 6 + Math.random() * 4);
            smoke.fillStyle(0xcc3366, 0.1);
            smoke.fillCircle(0, 0, 3);
            smoke.setVisible(false);
            smoke.setDepth(1);
            this.smokeParticles.push({
                graphic: smoke,
                active: false,
                vx: 0, vy: 0, life: 0
            });
        }
    }

    update(time, delta, playerX, playerY) {
        if (this.isDestroyed) return;

        // Emit toxic smoke from the exhaust vent
        this.smokeTimer += delta;
        if (this.smokeTimer > 300) {  // New smoke puff every 300ms
            this.smokeTimer = 0;
            this._emitSmoke();
        }

        // Update smoke particles
        this._updateSmoke(delta / 1000);
    }

    /**
     * Emit a smoke puff from the exhaust.
     */
    _emitSmoke() {
        const p = this.smokeParticles.find(p => !p.active);
        if (!p) return;

        p.active = true;
        // Exhaust vent position (relative to platform center)
        p.graphic.setPosition(this.x + 31, this.groundY - 62);
        p.graphic.setVisible(true);
        p.graphic.setAlpha(0.3);
        p.graphic.setScale(0.5);
        p.vx = (Math.random() - 0.5) * 15;
        p.vy = -(30 + Math.random() * 20);  // Drift upward
        p.life = 1.5 + Math.random() * 1.0;
    }

    /**
     * Update smoke particles — drift up and fade out.
     */
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
            // Grow and fade as it rises
            const scale = 0.5 + (1.5 - p.life) * 0.5;
            p.graphic.setScale(scale);
            p.graphic.setAlpha(Math.max(0, p.life * 0.2));
        }
    }

    /**
     * Override explosion — LARGE explosion for mining platform.
     */
    _playExplosion() {
        const cx = this.x;
        const cy = this.groundY - 45;

        // Main large fireball
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

        // Debris particles flying outward
        for (let i = 0; i < 10; i++) {
            const debris = this.scene.add.graphics();
            // Mix of orange fire and dark debris
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
            hp: 120,             // 20+ plasma hits or 5+ cluster missiles
            width: 220,
            height: 150,
            isObjective: true,
            explosionSize: 80,
            explosionDamageRadius: 300,
            explosionDamageToPlayer: 30,
            structureType: 'refinery'
        });

        // Draw the refinery visual
        this.bodyGraphic = VectorGraphics.drawRefinery(scene);
        this.container.add(this.bodyGraphic);

        // Smoke system for the 3 smokestacks
        this.smokeParticles = [];
        this.smokeTimer = 0;

        // Smokestack positions (relative to refinery center)
        this.smokestacks = [
            { x: -24, y: -138 },
            { x: 1, y: -148 },
            { x: 26, y: -133 }
        ];

        // Pre-create smoke particles
        for (let i = 0; i < 12; i++) {
            const smoke = scene.add.graphics();
            smoke.fillStyle(0x2a1a1a, 0.3);
            smoke.fillCircle(0, 0, 8 + Math.random() * 5);
            // Faint glow in the smoke
            smoke.fillStyle(0x8b2252, 0.08);
            smoke.fillCircle(0, 0, 4);
            smoke.setVisible(false);
            smoke.setDepth(1);
            this.smokeParticles.push({
                graphic: smoke,
                active: false,
                vx: 0, vy: 0, life: 0
            });
        }
    }

    update(time, delta, playerX, playerY) {
        if (this.isDestroyed) return;

        // Emit dark glowing smoke from all smokestacks
        this.smokeTimer += delta;
        if (this.smokeTimer > 250) {
            this.smokeTimer = 0;
            // Pick a random smokestack
            const stack = this.smokestacks[Math.floor(Math.random() * this.smokestacks.length)];
            this._emitSmoke(stack);
        }

        this._updateSmoke(delta / 1000);
    }

    _emitSmoke(stack) {
        const p = this.smokeParticles.find(p => !p.active);
        if (!p) return;

        p.active = true;
        p.graphic.setPosition(this.x + stack.x, this.groundY + stack.y);
        p.graphic.setVisible(true);
        p.graphic.setAlpha(0.4);
        p.graphic.setScale(0.6);
        p.vx = (Math.random() - 0.5) * 12;
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
            const scale = 0.6 + (2.0 - p.life) * 0.4;
            p.graphic.setScale(scale);
            p.graphic.setAlpha(Math.max(0, p.life * 0.15));
        }
    }

    /**
     * Override explosion — EXTREME explosion with shrapnel.
     */
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

        // Shrapnel — small angular metal pieces flying outward
        for (let i = 0; i < 16; i++) {
            const shrapnel = this.scene.add.graphics();
            // Angular metal debris
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
