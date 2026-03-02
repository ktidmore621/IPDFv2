/**
 * CombatManager.js — Collision Detection and Damage System
 *
 * Phase 4 — Handles all combat interactions:
 *   - Player projectiles hitting enemy structures
 *   - Enemy projectiles hitting the player ship
 *   - Tracking missile homing behavior
 *   - Explosion radius damage
 *   - Hit spark visual effects
 *
 * Uses Phaser Arcade Physics overlap checks each frame.
 * Enemy projectiles use object pooling just like player projectiles.
 */

class CombatManager {

    /**
     * Creates the combat manager.
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {PlayerShip} player — The player ship (for collision + damage)
     * @param {WeaponManager} weaponManager — Player's weapon system (for projectile pools)
     */
    constructor(scene, player, weaponManager) {
        this.scene = scene;
        this.player = player;
        this.weaponManager = weaponManager;

        // All enemy structures tracked for collision
        this.structures = [];

        // =================================================================
        // ENEMY PROJECTILE POOLS
        // =================================================================

        // Red energy bolts (from plasma turrets) — pool of 15
        this.enemyRedBolts = this._createEnemyPool('red', 15);

        // Green lightning bolts (from double cannons) — pool of 10
        this.enemyGreenBolts = this._createEnemyPool('green', 10);

        // Tracking missiles (from silos) — pool of 6
        this.trackingMissiles = this._createTrackingMissilePool(6);

        // =================================================================
        // HIT SPARK POOL — Small bright flash on hit
        // =================================================================
        this.hitSparks = [];
        for (let i = 0; i < 10; i++) {
            const spark = VectorGraphics.drawHitSpark(scene);
            spark.setVisible(false);
            spark.setDepth(10);
            this.hitSparks.push({ graphic: spark, active: false });
        }

        // Damage numbers for enemy bolts — keyed by type for different damage
        this.boltDamage = {};

        // =================================================================
        // MISSILE SMOKE TRAIL POOL
        // =================================================================
        // Smoke puffs that spawn behind tracking missiles as they fly.
        // 8-10 puffs per missile, 6 missiles max = 60 puffs in pool.
        // Each puff is a gray-white circle that drifts and fades over ~1 second.
        this.missileSmokePuffs = [];
        for (let i = 0; i < 60; i++) {
            const puff = this.scene.add.graphics();
            const puffSize = 5 + Math.random() * 5;
            puff.fillStyle(0xbbbbbb, 0.5);
            puff.fillCircle(0, 0, puffSize);
            puff.fillStyle(0xdddddd, 0.3);
            puff.fillCircle(0, 0, puffSize * 0.6);
            puff.setVisible(false);
            puff.setDepth(4);
            this.missileSmokePuffs.push({
                graphic: puff,
                active: false,
                vx: 0, vy: 0, life: 0
            });
        }
        // Timer to control how often smoke puffs spawn (every ~60ms)
        this._missileSmokeTimer = 0;
    }

    // =====================================================================
    // ENEMY PROJECTILE POOL CREATION
    // =====================================================================

    /**
     * Creates a pool of enemy energy bolt projectiles.
     *
     * @param {string} type — 'red' or 'green'
     * @param {number} size — Pool size
     * @returns {Array} — Pool of projectile graphics
     */
    _createEnemyPool(type, size) {
        const pool = [];

        for (let i = 0; i < size; i++) {
            let g;
            if (type === 'red') {
                g = VectorGraphics.drawEnemyPlasmaBolt(this.scene);
            } else {
                g = VectorGraphics.drawGreenLightningBolt(this.scene);
            }

            this.scene.physics.world.enable(g);
            g.body.setSize(14, 8);
            g.body.setOffset(-7, -4);
            g.body.setAllowGravity(false);

            g.setActive(false);
            g.setVisible(false);
            g.body.enable = false;
            g.setDepth(5);

            g._proj = {
                active: false,
                startX: 0,
                startY: 0,
                angle: 0,
                damage: 0,
                type: type,
                maxDist: 900  // How far enemy bolts travel before despawn
            };

            pool.push(g);
        }

        return pool;
    }

    /**
     * Creates a pool of tracking missiles.
     * Missiles are now larger (~45px long) with bigger hitboxes.
     *
     * @param {number} size — Pool size
     * @returns {Array} — Pool of missile graphics
     */
    _createTrackingMissilePool(size) {
        const pool = [];

        for (let i = 0; i < size; i++) {
            const g = VectorGraphics.drawTrackingMissile(this.scene);

            this.scene.physics.world.enable(g);
            // Larger hitbox to match the bigger 45px missile sprite
            g.body.setSize(45, 14);
            g.body.setOffset(-22, -7);
            g.body.setAllowGravity(false);

            g.setActive(false);
            g.setVisible(false);
            g.body.enable = false;
            g.setDepth(5);

            g._proj = {
                active: false,
                spawnTime: 0,
                speed: 300,
                damage: 25,
                lifetime: 4000,  // 4 seconds then self-destruct
                type: 'tracking'
            };

            pool.push(g);
        }

        return pool;
    }

    // =====================================================================
    // ENEMY PROJECTILE SPAWNING — Called by enemy structures
    // =====================================================================

    /**
     * Spawns an enemy energy bolt (red or green) from a structure.
     * Bolts travel in a straight line — non-tracking.
     *
     * @param {number} x — Spawn X
     * @param {number} y — Spawn Y
     * @param {number} angle — Direction in radians
     * @param {number} speed — Pixels per second
     * @param {number} damage — Damage on hit
     * @param {string} type — 'red' or 'green'
     */
    spawnEnemyBolt(x, y, angle, speed, damage, type) {
        const pool = type === 'red' ? this.enemyRedBolts : this.enemyGreenBolts;
        const bolt = pool.find(b => !b._proj.active);
        if (!bolt) return;

        bolt.setPosition(x, y);
        bolt.setRotation(angle);
        bolt.setActive(true);
        bolt.setVisible(true);
        bolt.body.enable = true;
        bolt.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );

        bolt._proj.active = true;
        bolt._proj.startX = x;
        bolt._proj.startY = y;
        bolt._proj.angle = angle;
        bolt._proj.damage = damage;
    }

    /**
     * Spawns a tracking missile from a silo.
     * The missile homes in on the player each frame.
     *
     * @param {number} x — Spawn X
     * @param {number} y — Spawn Y
     * @param {number} speed — Pixels per second
     * @param {number} damage — Damage on hit
     */
    spawnTrackingMissile(x, y, speed, damage) {
        const missile = this.trackingMissiles.find(m => !m._proj.active);
        if (!missile) return;

        missile.setPosition(x, y);
        missile.setActive(true);
        missile.setVisible(true);
        missile.body.enable = true;

        // Start moving upward, then will home in during update
        missile.body.setVelocity(0, -speed);
        missile.setRotation(-Math.PI / 2);  // Pointing up

        missile._proj.active = true;
        missile._proj.spawnTime = this.scene.time.now;
        missile._proj.speed = speed;
        missile._proj.damage = damage;
    }

    // =====================================================================
    // DEACTIVATE HELPERS
    // =====================================================================

    /**
     * Deactivate an enemy projectile and return it to pool.
     */
    _deactivateProjectile(proj) {
        proj.setActive(false);
        proj.setVisible(false);
        proj.body.enable = false;
        proj.body.setVelocity(0, 0);
        proj._proj.active = false;
    }

    // =====================================================================
    // HIT SPARK EFFECT
    // =====================================================================

    /**
     * Show a brief spark at a hit location.
     */
    showHitSpark(x, y) {
        const spark = this.hitSparks.find(s => !s.active);
        if (!spark) return;

        spark.graphic.setPosition(x, y);
        spark.graphic.setVisible(true);
        spark.graphic.setAlpha(1);
        spark.graphic.setScale(0.5);
        spark.active = true;

        this.scene.tweens.add({
            targets: spark.graphic,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 150,
            ease: 'Quad.easeOut',
            onComplete: () => {
                spark.graphic.setVisible(false);
                spark.graphic.setScale(1);
                spark.active = false;
            }
        });
    }

    // =====================================================================
    // REGISTER STRUCTURES — Called by BattleScene during setup
    // =====================================================================

    /**
     * Register an enemy structure for collision checking.
     *
     * @param {EnemyStructure} structure — The structure to track
     */
    addStructure(structure) {
        this.structures.push(structure);
    }

    // =====================================================================
    // UPDATE — Main combat loop, called every frame
    // =====================================================================

    /**
     * Updates all combat systems each frame.
     *
     * @param {number} time — Current game time
     * @param {number} delta — Frame time in ms
     */
    update(time, delta) {
        const playerPos = this.player.getPosition();
        const playerObj = this.player.getGameObject();

        // --- Check player projectiles vs enemy structures ---
        this._checkPlayerProjectilesVsStructures();

        // --- Update and check enemy bolts vs player ---
        this._updateEnemyBolts(time, delta, playerObj);

        // --- Update tracking missiles (homing + lifetime) ---
        this._updateTrackingMissiles(time, delta, playerObj, playerPos);

        // --- Update missile smoke trail puffs (drift + fade) ---
        this._updateMissileSmoke(delta);

        // --- Spawn smoke puffs behind active tracking missiles ---
        // Every ~60ms, each active missile emits a smoke puff at its rear
        this._missileSmokeTimer += delta;
        if (this._missileSmokeTimer > 60) {
            this._missileSmokeTimer = 0;
            for (const missile of this.trackingMissiles) {
                if (!missile._proj.active) continue;
                // Spawn puff at the rear of the missile (behind the exhaust nozzle)
                const rearX = missile.x - Math.cos(missile.rotation) * 22;
                const rearY = missile.y - Math.sin(missile.rotation) * 22;
                this._spawnMissileSmoke(rearX, rearY);
            }
        }
    }

    /**
     * Check all active player projectiles against all enemy structures.
     * Uses Phaser overlap to detect collision.
     */
    _checkPlayerProjectilesVsStructures() {
        // Plasma bolts vs structures
        for (const bolt of this.weaponManager.plasmaBolts) {
            if (!bolt._proj.active) continue;

            for (const structure of this.structures) {
                if (structure.isDestroyed) continue;
                if (!structure.container.body || !structure.container.body.enable) continue;

                // Manual overlap check using Arcade body bounds
                if (this._bodiesOverlap(bolt, structure.container)) {
                    // Plasma bolt does ~5-6 damage per hit
                    const destroyed = structure.takeDamage(6);
                    this.showHitSpark(bolt.x, bolt.y);
                    this.weaponManager._deactivateProjectile(bolt);

                    // If the structure was destroyed and it has explosion radius damage
                    if (destroyed && structure.explosionDamageRadius > 0) {
                        this._checkExplosionDamage(structure);
                    }
                    break;  // Bolt is consumed, stop checking structures
                }
            }
        }

        // Cluster missiles vs structures
        for (const missile of this.weaponManager.missiles) {
            if (!missile._proj.active) continue;

            for (const structure of this.structures) {
                if (structure.isDestroyed) continue;
                if (!structure.container.body || !structure.container.body.enable) continue;

                if (this._bodiesOverlap(missile, structure.container)) {
                    // Full cluster missile hit = big damage
                    const destroyed = structure.takeDamage(25);
                    this.showHitSpark(missile.x, missile.y);
                    this.weaponManager._deactivateProjectile(missile);

                    if (destroyed && structure.explosionDamageRadius > 0) {
                        this._checkExplosionDamage(structure);
                    }
                    break;
                }
            }
        }

        // Submunitions vs structures
        for (const sub of this.weaponManager.submunitions) {
            if (!sub._proj.active) continue;

            for (const structure of this.structures) {
                if (structure.isDestroyed) continue;
                if (!structure.container.body || !structure.container.body.enable) continue;

                if (this._bodiesOverlap(sub, structure.container)) {
                    // Each sub does less damage than a full missile
                    const destroyed = structure.takeDamage(10);
                    this.showHitSpark(sub.x, sub.y);
                    this.weaponManager._deactivateProjectile(sub);

                    if (destroyed && structure.explosionDamageRadius > 0) {
                        this._checkExplosionDamage(structure);
                    }
                    break;
                }
            }
        }
    }

    /**
     * Simple AABB overlap check between two physics-enabled game objects.
     * Used instead of Phaser's built-in overlap to avoid group setup complexity.
     *
     * @param {Phaser.GameObjects.Graphics} a — First object (must have body)
     * @param {Phaser.GameObjects.Container} b — Second object (must have body)
     * @returns {boolean} — True if their physics bodies overlap
     */
    _bodiesOverlap(a, b) {
        if (!a.body || !a.body.enable) return false;
        if (!b.body || !b.body.enable) return false;

        const ab = a.body;
        const bb = b.body;

        // AABB overlap check
        return (
            ab.x < bb.x + bb.width &&
            ab.x + ab.width > bb.x &&
            ab.y < bb.y + bb.height &&
            ab.y + ab.height > bb.y
        );
    }

    /**
     * Check if the player is within a structure's explosion damage radius.
     * If so, apply damage to the player.
     *
     * @param {EnemyStructure} structure — The destroyed structure
     */
    _checkExplosionDamage(structure) {
        const playerPos = this.player.getPosition();
        const cx = structure.x;
        const cy = structure.groundY - structure.bodyHeight / 2;

        const dx = playerPos.x - cx;
        const dy = playerPos.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < structure.explosionDamageRadius) {
            this.player.takeDamage(structure.explosionDamageToPlayer);
        }

        // Also damage nearby enemy structures (for refinery shrapnel)
        if (structure.structureType === 'refinery') {
            for (const other of this.structures) {
                if (other === structure || other.isDestroyed) continue;
                const odx = other.x - cx;
                const ody = other.groundY - cy;
                const odist = Math.sqrt(odx * odx + ody * ody);

                if (odist < structure.explosionDamageRadius) {
                    other.takeDamage(40);  // Heavy shrapnel damage to nearby structures
                }
            }
        }
    }

    /**
     * Update enemy energy bolts — move, check lifetime, check collision with player.
     */
    _updateEnemyBolts(time, delta, playerObj) {
        const allBolts = [...this.enemyRedBolts, ...this.enemyGreenBolts];
        const cam = this.scene.cameras.main;

        for (const bolt of allBolts) {
            if (!bolt._proj.active) continue;

            // Check distance traveled
            const dx = bolt.x - bolt._proj.startX;
            const dy = bolt.y - bolt._proj.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Despawn if too far or off screen
            if (dist > bolt._proj.maxDist || this._isOffScreen(bolt, cam)) {
                this._deactivateProjectile(bolt);
                continue;
            }

            // Check collision with player
            if (this._bodiesOverlap(bolt, playerObj)) {
                this.player.takeDamage(bolt._proj.damage);
                this.showHitSpark(bolt.x, bolt.y);
                this._deactivateProjectile(bolt);
            }
        }
    }

    /**
     * Update tracking missiles — home toward player, check lifetime, check collision.
     */
    _updateTrackingMissiles(time, delta, playerObj, playerPos) {
        const cam = this.scene.cameras.main;

        for (const missile of this.trackingMissiles) {
            if (!missile._proj.active) continue;

            // Check lifetime — self-destruct after 4 seconds
            const age = time - missile._proj.spawnTime;
            if (age > missile._proj.lifetime) {
                // Self-destruct effect
                this.showHitSpark(missile.x, missile.y);
                this._deactivateProjectile(missile);
                continue;
            }

            // Home toward the player — adjust velocity each frame
            const dx = playerPos.x - missile.x;
            const dy = playerPos.y - missile.y;
            const angle = Math.atan2(dy, dx);

            // Smooth turning — blend current heading toward target
            const speed = missile._proj.speed;
            missile.body.setVelocity(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed
            );
            missile.setRotation(angle);

            // Check collision with player
            if (this._bodiesOverlap(missile, playerObj)) {
                this.player.takeDamage(missile._proj.damage);
                this.showHitSpark(missile.x, missile.y);
                this._deactivateProjectile(missile);
            }

            // Off screen cleanup (far off screen)
            if (this._isOffScreen(missile, cam, 400)) {
                this._deactivateProjectile(missile);
            }
        }
    }

    /**
     * Check if a projectile is off screen.
     */
    _isOffScreen(obj, cam, buffer) {
        buffer = buffer || 150;
        return (
            obj.x < cam.scrollX - buffer ||
            obj.x > cam.scrollX + cam.width + buffer ||
            obj.y < cam.scrollY - buffer ||
            obj.y > cam.scrollY + cam.height + buffer
        );
    }

    // =====================================================================
    // MISSILE SMOKE TRAIL — Thick smoke puffs behind tracking missiles
    // =====================================================================

    /**
     * Spawn a single smoke puff at a position (behind a missile's exhaust).
     * The puff starts opaque gray-white, drifts slightly, and fades over ~1 second.
     *
     * @param {number} x — World X to spawn the puff
     * @param {number} y — World Y to spawn the puff
     */
    _spawnMissileSmoke(x, y) {
        const puff = this.missileSmokePuffs.find(p => !p.active);
        if (!puff) return;

        puff.active = true;
        puff.graphic.setPosition(x, y);
        puff.graphic.setVisible(true);
        puff.graphic.setAlpha(0.5);
        puff.graphic.setScale(0.6);
        // Slight random drift so the trail isn't a straight line
        puff.vx = (Math.random() - 0.5) * 15;
        puff.vy = (Math.random() - 0.5) * 15;
        puff.life = 0.8 + Math.random() * 0.4;
    }

    /**
     * Update all active missile smoke puffs — drift, grow, fade.
     *
     * @param {number} delta — Frame time in ms
     */
    _updateMissileSmoke(delta) {
        const dt = delta / 1000;
        for (const puff of this.missileSmokePuffs) {
            if (!puff.active) continue;
            puff.life -= dt;
            if (puff.life <= 0) {
                puff.active = false;
                puff.graphic.setVisible(false);
                continue;
            }
            // Drift slightly
            puff.graphic.x += puff.vx * dt;
            puff.graphic.y += puff.vy * dt;
            // Grow larger as smoke disperses
            const scale = 0.6 + (1.0 - puff.life) * 1.0;
            puff.graphic.setScale(scale);
            // Fade out over lifetime
            puff.graphic.setAlpha(Math.max(0, puff.life * 0.5));
        }
    }
}
