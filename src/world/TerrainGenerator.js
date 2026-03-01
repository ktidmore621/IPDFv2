/**
 * TerrainGenerator.js — Procedural Alien Terrain
 *
 * Generates the planet's ground surface using layered noise for an uneven,
 * alien landscape. The terrain has:
 *   - A noise-generated surface line with rolling hills, ridges, and craters
 *   - A thin surface crust layer (lighter colored top "skin")
 *   - A rock body with horizontal striations (geological layer lines)
 *   - Voidheart Ore vein clusters that pulse with a purplish-red glow
 *
 * All terrain is generated once at scene creation time — nothing is
 * recalculated per frame. The ore vein pulse uses Phaser tweens for
 * efficient animation.
 *
 * --- MOBILE OPTIMIZATION (Phase 2 fix) ---
 * The terrain is split into chunks no wider than 2048px. This prevents
 * any single Graphics object or texture from exceeding mobile GPU limits
 * (typically 4096px max texture size). Each chunk is drawn onto a temporary
 * Graphics, baked into a RenderTexture, and the Graphics is destroyed.
 * This means terrain renders as a handful of cheap textured quads instead
 * of hundreds of live Graphics draw calls per frame.
 *
 * Chunk size of 2048px is conservative — safe even on older mobile devices.
 * A 12,000px world creates 6 chunks.
 */

const TerrainGenerator = {

    // How wide each terrain chunk is in pixels.
    // Must not exceed the minimum mobile max texture size (usually 4096).
    // 2048 is safe for essentially all devices.
    CHUNK_SIZE: 2048,

    /**
     * Generates the full terrain height map using multi-octave noise.
     * This creates an array of Y values (one per X pixel) that defines
     * the top edge of the ground across the entire world.
     *
     * Multi-octave noise works by layering several sine waves at different
     * frequencies (how often they repeat) and amplitudes (how tall they are).
     * Low frequency = broad rolling hills. High frequency = small bumps.
     * Layering them creates natural-looking terrain.
     *
     * @param {number} worldWidth — Total world width in pixels
     * @param {number} worldHeight — Total world height in pixels
     * @param {number} groundBaseY — The baseline Y position for the ground
     * @returns {number[]} — Array of Y values, one per pixel of world width
     */
    generateHeightMap: function (worldWidth, worldHeight, groundBaseY) {
        const heightMap = [];

        // We use a seeded pseudo-random to make terrain feel random but
        // consistent. Each octave uses different phase offsets so they
        // don't all peak at the same spots.
        const seed1 = 1.3;
        const seed2 = 2.7;
        const seed3 = 4.1;
        const seed4 = 7.3;
        const seed5 = 11.9;

        // Maximum terrain variation above and below the baseline.
        // The terrain surface will fluctuate within this range.
        const maxVariation = 250;

        for (let x = 0; x < worldWidth; x++) {
            // --- Octave 1: Broad rolling hills (very low frequency) ---
            // These create the large-scale shape of the landscape
            const oct1 = Math.sin(x * 0.0003 + seed1) * 0.4;

            // --- Octave 2: Medium formations (ridges and valleys) ---
            const oct2 = Math.sin(x * 0.0008 + seed2) * 0.25;

            // --- Octave 3: Smaller undulations ---
            const oct3 = Math.sin(x * 0.002 + seed3) * 0.15;

            // --- Octave 4: Fine detail (bumps and roughness) ---
            const oct4 = Math.sin(x * 0.005 + seed4) * 0.1;

            // --- Octave 5: Micro-roughness (surface texture) ---
            const oct5 = Math.sin(x * 0.012 + seed5) * 0.05;

            // --- Sharp features: occasional ridges and craters ---
            // Use abs(sin) to create sharp V-shaped valleys/ridges
            const ridge = Math.abs(Math.sin(x * 0.0004 + 3.5)) * 0.15;

            // Combine all octaves into a single height value
            const combined = oct1 + oct2 + oct3 + oct4 + oct5 - ridge;

            // Convert to actual Y position.
            // Negative combined values = terrain goes UP (lower Y in screen coords)
            // Positive combined values = terrain goes DOWN (higher Y)
            heightMap[x] = groundBaseY + combined * maxVariation;
        }

        // --- Post-processing: Add a few deep craters ---
        // Place 3-5 craters at random positions along the terrain
        const craterCount = 3 + Math.floor(Math.random() * 3);
        for (let c = 0; c < craterCount; c++) {
            // Place craters away from the very edges
            const craterX = 1500 + Math.floor((worldWidth - 3000) * (c + 0.5) / craterCount);
            const craterWidth = 200 + Math.floor(Math.random() * 300);
            const craterDepth = 60 + Math.floor(Math.random() * 80);

            for (let dx = -craterWidth; dx <= craterWidth; dx++) {
                const px = craterX + dx;
                if (px >= 0 && px < worldWidth) {
                    // Smooth crater shape using cosine falloff
                    const t = dx / craterWidth;
                    const dip = craterDepth * (0.5 + 0.5 * Math.cos(t * Math.PI));
                    heightMap[px] += dip;  // Push terrain DOWN (higher Y = lower visually)
                }
            }
        }

        return heightMap;
    },

    /**
     * Creates the main terrain visuals: rock body with geological layers.
     * This draws the filled rock area below the surface line, complete
     * with horizontal striations that suggest geological strata.
     *
     * --- CHUNKING FOR MOBILE ---
     * Instead of one massive 12,000px-wide polygon (which exceeds mobile
     * GPU texture limits), the terrain is split into 2048px-wide chunks.
     * Each chunk is its own Graphics object positioned at the correct
     * world coordinates. 2048px is safely within the 4096px mobile limit.
     *
     * NOTE: We previously tried baking each chunk into a RenderTexture,
     * but Phaser 4's Beam renderer can't capture unrendered Graphics via
     * RenderTexture.draw() during create() — the deferred WebGL commands
     * haven't executed yet, so the RT ends up empty (black screen).
     * Keeping each chunk as a live Graphics object works reliably.
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {number[]} heightMap — The terrain height map from generateHeightMap
     * @param {number} worldWidth — World width in pixels
     * @param {number} worldHeight — World height in pixels
     * @returns {Phaser.GameObjects.Graphics[]} — Array of terrain chunk Graphics
     */
    createRockBody: function (scene, heightMap, worldWidth, worldHeight) {
        const CHUNK_W = this.CHUNK_SIZE;
        const step = 4;  // Sample every 4 pixels (still smooth at 1920px view)
        const chunks = [];

        for (let chunkStart = 0; chunkStart < worldWidth; chunkStart += CHUNK_W) {
            const chunkEnd = Math.min(chunkStart + CHUNK_W, worldWidth);
            const chunkW = chunkEnd - chunkStart;

            // Find the highest terrain point (minimum Y) in this chunk
            // so we know the vertical extent of this chunk.
            let minY = worldHeight;
            for (let x = chunkStart; x < chunkEnd; x += step) {
                if (heightMap[x] < minY) minY = heightMap[x];
            }
            minY = Math.floor(minY) - 20;  // 20px padding above highest point
            const chunkH = worldHeight - minY;

            // --- Draw this chunk's terrain onto a Graphics object ---
            // The Graphics is positioned at (chunkStart, minY) in world space.
            // All drawing coordinates are local (0,0) to (chunkW, chunkH).
            const chunkG = scene.add.graphics();
            chunkG.setPosition(chunkStart, minY);
            chunkG.setDepth(-10);

            // Base rock color — dark gray-brown alien stone
            chunkG.fillStyle(0x1a1410, 1);
            chunkG.beginPath();
            chunkG.moveTo(0, chunkH);  // Bottom-left corner of chunk

            // Trace the terrain surface from left to right within this chunk
            for (let x = chunkStart; x < chunkEnd; x += step) {
                chunkG.lineTo(x - chunkStart, heightMap[x] - minY);
            }
            // Make sure we reach the right edge of the chunk
            chunkG.lineTo(chunkW, heightMap[Math.min(chunkEnd - 1, worldWidth - 1)] - minY);
            chunkG.lineTo(chunkW, chunkH);  // Bottom-right corner
            chunkG.closePath();
            chunkG.fillPath();

            // --- Geological striations (horizontal layer lines) ---
            // Thin lines at different Y positions that suggest layers of rock.
            // Only drawn where they're visible (inside the rock body).
            const strataSpacing = 25;
            const strataColors = [0x1e1814, 0x161210, 0x201a14, 0x141010, 0x1c1610];

            for (let sy = minY + 20; sy < worldHeight; sy += strataSpacing) {
                const localSY = sy - minY;  // Y relative to chunk top
                const color = strataColors[Math.floor((sy / strataSpacing) % strataColors.length)];
                const alpha = 0.3 + Math.random() * 0.2;

                chunkG.lineStyle(1, color, alpha);
                chunkG.beginPath();

                let started = false;
                for (let x = chunkStart; x < chunkEnd; x += step) {
                    // Only draw where this Y is inside the rock (below surface)
                    if (sy > heightMap[x]) {
                        if (!started) {
                            chunkG.moveTo(x - chunkStart, localSY);
                            started = true;
                        } else {
                            chunkG.lineTo(x - chunkStart, localSY);
                        }
                    } else {
                        // Surface is above this striation Y — restart the line
                        if (started) {
                            chunkG.strokePath();
                            chunkG.beginPath();
                            started = false;
                        }
                    }
                }
                if (started) {
                    chunkG.strokePath();
                }
            }

            chunks.push(chunkG);
        }

        return chunks;
    },

    /**
     * Creates the thin surface crust — a lighter colored strip along the
     * top edge of the terrain that looks like the planet's "skin."
     * It has a rough, jagged edge to suggest erosion and wear.
     *
     * --- CHUNKING FOR MOBILE ---
     * Chunked the same way as the rock body to stay within mobile GPU
     * texture limits. Each chunk is a live Graphics object positioned
     * at the correct world coordinates (no RT baking — see createRockBody
     * comment for why).
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {number[]} heightMap — The terrain height map
     * @param {number} worldWidth — World width in pixels
     * @returns {Phaser.GameObjects.Graphics[]} — Array of crust chunk Graphics
     */
    createSurfaceCrust: function (scene, heightMap, worldWidth) {
        const CHUNK_W = this.CHUNK_SIZE;
        const crustThickness = 12;
        const step = 3;  // Slightly more detail than rock body
        const chunks = [];

        for (let chunkStart = 0; chunkStart < worldWidth; chunkStart += CHUNK_W) {
            const chunkEnd = Math.min(chunkStart + CHUNK_W, worldWidth);
            const chunkW = chunkEnd - chunkStart;

            // Find the highest terrain point in this chunk
            let minY = Infinity;
            for (let x = chunkStart; x < chunkEnd; x += step) {
                if (heightMap[x] < minY) minY = heightMap[x];
            }
            // Padding: crust sits on top of terrain, so go a bit higher
            minY = Math.floor(minY) - 10;

            // Create the chunk Graphics and position it at the correct
            // world coordinates. All drawing is in local (0,0)-based coords.
            const chunkG = scene.add.graphics();
            chunkG.setPosition(chunkStart, minY);
            chunkG.setDepth(-9);  // Just above the rock body

            // --- Main crust fill (slightly lighter than rock below) ---
            chunkG.fillStyle(0x2a2420, 1);
            chunkG.beginPath();

            // Top edge: follows the heightMap
            chunkG.moveTo(0, heightMap[Math.min(chunkStart, worldWidth - 1)] - minY);
            for (let x = chunkStart + step; x < chunkEnd; x += step) {
                chunkG.lineTo(x - chunkStart, heightMap[x] - minY);
            }
            chunkG.lineTo(chunkW - 1, heightMap[Math.min(chunkEnd - 1, worldWidth - 1)] - minY);

            // Bottom edge: follows the heightMap pushed down by crustThickness,
            // with small random jitter for a rough/jagged look
            for (let x = chunkEnd - 1; x >= chunkStart; x -= step) {
                const jitter = Math.sin(x * 0.05) * 3 + Math.sin(x * 0.13) * 2;
                chunkG.lineTo(x - chunkStart, heightMap[Math.min(x, worldWidth - 1)] + crustThickness + jitter - minY);
            }
            chunkG.closePath();
            chunkG.fillPath();

            // --- Surface edge highlight ---
            // A thin bright line right along the top to give a crisp edge
            chunkG.lineStyle(2, 0x3a3430, 0.8);
            chunkG.beginPath();
            chunkG.moveTo(0, heightMap[Math.min(chunkStart, worldWidth - 1)] - minY);
            for (let x = chunkStart + step; x < chunkEnd; x += step) {
                chunkG.lineTo(x - chunkStart, heightMap[x] - minY);
            }
            chunkG.strokePath();

            // --- Scattered surface rocks / debris along the top ---
            // Small angular shapes sitting on the surface line.
            // Scale rock count proportionally to chunk width (was 150 for full world).
            const rockCount = Math.floor(150 * (chunkW / worldWidth));
            for (let i = 0; i < rockCount; i++) {
                const rx = Math.floor(Math.random() * chunkW);
                const worldX = chunkStart + rx;
                const ry = heightMap[Math.min(worldX, worldWidth - 1)] - minY;
                const size = 3 + Math.random() * 8;

                chunkG.fillStyle(0x222018, 0.6 + Math.random() * 0.3);
                chunkG.beginPath();
                chunkG.moveTo(rx, ry);
                chunkG.lineTo(rx + size * 0.6, ry - size * 0.8);
                chunkG.lineTo(rx + size, ry - size * 0.2);
                chunkG.lineTo(rx + size * 0.8, ry + 2);
                chunkG.closePath();
                chunkG.fillPath();
            }

            chunks.push(chunkG);
        }

        return chunks;
    },

    /**
     * Creates the glowing Voidheart Ore vein clusters embedded in the rock.
     * These are branching, crack-like veins of purplish-red with gold accents
     * that pulse slowly (brightness animation via tweens).
     *
     * Each cluster is a separate Graphics object so it can be individually
     * tweened for the pulse effect. These are already small (200-400px wide)
     * so they don't need chunking.
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {number[]} heightMap — The terrain height map
     * @param {number} worldWidth — World width in pixels
     * @param {number} worldHeight — World height in pixels
     * @returns {Phaser.GameObjects.Graphics[]} — Array of ore vein graphics
     */
    createVoidheartOreVeins: function (scene, heightMap, worldWidth, worldHeight) {
        const veins = [];

        // Place 6-8 vein clusters spread across the world
        const clusterCount = 6 + Math.floor(Math.random() * 3);
        const spacing = worldWidth / (clusterCount + 1);

        for (let c = 0; c < clusterCount; c++) {
            // Center X of this cluster, with some randomness
            const clusterX = spacing * (c + 1) + (Math.random() - 0.5) * spacing * 0.4;
            const clusterWidth = 200 + Math.random() * 200;  // 200-400px wide

            // The cluster sits inside the rock, below the surface
            const surfaceY = heightMap[Math.floor(Math.min(Math.max(clusterX, 0), worldWidth - 1))];
            const clusterTopY = surfaceY + 20;   // Start 20px below surface
            const clusterBottomY = Math.min(surfaceY + 180, worldHeight - 20);

            // Create the ore vein graphic for this cluster
            const oreGraphic = scene.add.graphics();
            oreGraphic.setDepth(-8);  // Above rock body, below surface crust details

            // --- Draw branching veins ---
            // Each cluster has a main trunk vein and several branches
            const branchCount = 5 + Math.floor(Math.random() * 6);

            for (let b = 0; b < branchCount; b++) {
                // Start point for this branch
                const startX = clusterX - clusterWidth / 2 + Math.random() * clusterWidth;
                const startY = clusterTopY + Math.random() * (clusterBottomY - clusterTopY);

                // Each branch is a series of connected line segments
                // that wander semi-randomly, creating a crack-like pattern
                const segmentCount = 4 + Math.floor(Math.random() * 6);
                const segmentLength = 20 + Math.random() * 40;

                // Primary vein color — purplish-red
                oreGraphic.lineStyle(2 + Math.random() * 2, 0x8b2252, 0.8);
                oreGraphic.beginPath();
                oreGraphic.moveTo(startX, startY);

                let px = startX;
                let py = startY;
                // General direction for this branch (tends to go outward/downward)
                const baseAngle = Math.random() * Math.PI * 2;

                for (let s = 0; s < segmentCount; s++) {
                    // Each segment wanders from the general direction
                    const angle = baseAngle + (Math.random() - 0.5) * 1.5;
                    px += Math.cos(angle) * segmentLength * (0.5 + Math.random() * 0.5);
                    py += Math.sin(angle) * segmentLength * (0.3 + Math.random() * 0.5);

                    // Keep within the rock (below surface)
                    const localSurfaceY = heightMap[Math.floor(Math.min(Math.max(px, 0), worldWidth - 1))];
                    if (py < localSurfaceY + 8) py = localSurfaceY + 8;
                    if (py > worldHeight - 10) py = worldHeight - 10;

                    oreGraphic.lineTo(px, py);
                }
                oreGraphic.strokePath();

                // --- Gold accent vein (thinner, offset slightly) ---
                oreGraphic.lineStyle(1, 0xdaa520, 0.6);
                oreGraphic.beginPath();
                oreGraphic.moveTo(startX + 2, startY + 1);

                px = startX + 2;
                py = startY + 1;
                for (let s = 0; s < segmentCount; s++) {
                    const angle = baseAngle + (Math.random() - 0.5) * 1.5;
                    px += Math.cos(angle) * segmentLength * (0.4 + Math.random() * 0.4);
                    py += Math.sin(angle) * segmentLength * (0.3 + Math.random() * 0.4);

                    const localSurfaceY = heightMap[Math.floor(Math.min(Math.max(px, 0), worldWidth - 1))];
                    if (py < localSurfaceY + 10) py = localSurfaceY + 10;
                    if (py > worldHeight - 10) py = worldHeight - 10;

                    oreGraphic.lineTo(px, py);
                }
                oreGraphic.strokePath();
            }

            // --- Glow nodes: bright spots where veins are especially concentrated ---
            // Small filled circles along the cluster to suggest ore deposits
            const nodeCount = 3 + Math.floor(Math.random() * 4);
            for (let n = 0; n < nodeCount; n++) {
                const nx = clusterX - clusterWidth / 3 + Math.random() * (clusterWidth * 0.66);
                const ny = clusterTopY + 10 + Math.random() * (clusterBottomY - clusterTopY - 20);
                const nRadius = 3 + Math.random() * 5;

                // Outer glow
                oreGraphic.fillStyle(0x8b2252, 0.3);
                oreGraphic.fillCircle(nx, ny, nRadius * 2.5);

                // Inner bright core
                oreGraphic.fillStyle(0xcc3366, 0.6);
                oreGraphic.fillCircle(nx, ny, nRadius);

                // Gold sparkle at center
                oreGraphic.fillStyle(0xdaa520, 0.7);
                oreGraphic.fillCircle(nx, ny, nRadius * 0.4);
            }

            // --- Pulse animation using Phaser tweens ---
            // Slowly oscillate the alpha of each ore cluster to create
            // a "breathing" glow effect. This tweens the alpha property
            // on the existing Graphics object — no new textures created.
            scene.tweens.add({
                targets: oreGraphic,
                alpha: { from: 0.6, to: 1.0 },
                duration: 2000 + Math.random() * 1500,   // 2-3.5 seconds per pulse
                yoyo: true,                                // Go back and forth
                repeat: -1,                                // Loop forever
                ease: 'Sine.easeInOut',                   // Smooth sine wave
                delay: Math.random() * 2000               // Stagger the starts
            });

            veins.push(oreGraphic);
        }

        return veins;
    }
};
