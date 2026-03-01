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
 */

const TerrainGenerator = {

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
                    heightMap[px] += dip;  // Push terrain DOWN (higher Y = lower on screen... wait, no: higher Y = lower visually. Craters go down, so add to Y.)
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
     * @param {Phaser.Scene} scene — The game scene
     * @param {number[]} heightMap — The terrain height map from generateHeightMap
     * @param {number} worldWidth — World width in pixels
     * @param {number} worldHeight — World height in pixels
     * @returns {Phaser.GameObjects.Graphics} — The rock body graphic
     */
    createRockBody: function (scene, heightMap, worldWidth, worldHeight) {
        const rock = scene.add.graphics();
        rock.setDepth(-10);

        // --- Draw the main rock fill ---
        // We draw the terrain as a filled polygon: the top edge follows
        // the heightMap, and the bottom/sides are straight lines along
        // the world edges.
        //
        // Drawing every single pixel as a line would be thousands of
        // lineTo calls. Instead, we sample every few pixels for performance.
        const step = 4;  // Sample every 4 pixels (still smooth at 1920px view)

        // Base rock color — dark gray-brown alien stone
        rock.fillStyle(0x1a1410, 1);
        rock.beginPath();
        rock.moveTo(0, worldHeight);  // Bottom-left corner

        // Trace the terrain surface from left to right
        for (let x = 0; x < worldWidth; x += step) {
            rock.lineTo(x, heightMap[x]);
        }
        // Make sure we reach the right edge
        rock.lineTo(worldWidth - 1, heightMap[worldWidth - 1]);

        // Close the shape along the bottom
        rock.lineTo(worldWidth, worldHeight);  // Bottom-right corner
        rock.closePath();
        rock.fillPath();

        // --- Geological striations (horizontal layer lines) ---
        // These are thin lines at different Y positions that suggest
        // layers of rock built up over time — like a cliff face.
        // We only draw them where they're visible (above the lowest point).
        const minY = Math.min(...heightMap.filter((_, i) => i % 100 === 0));
        const strataSpacing = 25;  // Pixels between each striation line
        const strataColors = [0x1e1814, 0x161210, 0x201a14, 0x141010, 0x1c1610];

        for (let sy = minY + 20; sy < worldHeight; sy += strataSpacing) {
            // Pick a slightly varied color for this layer
            const color = strataColors[Math.floor((sy / strataSpacing) % strataColors.length)];
            const alpha = 0.3 + Math.random() * 0.2;

            rock.lineStyle(1, color, alpha);
            rock.beginPath();

            let started = false;
            for (let x = 0; x < worldWidth; x += step) {
                // Only draw the striation where it's inside the rock (below surface)
                if (sy > heightMap[x]) {
                    if (!started) {
                        rock.moveTo(x, sy);
                        started = true;
                    } else {
                        rock.lineTo(x, sy);
                    }
                } else {
                    // Surface is above this striation Y — restart the line
                    if (started) {
                        rock.strokePath();
                        rock.beginPath();
                        started = false;
                    }
                }
            }
            if (started) {
                rock.strokePath();
            }
        }

        return rock;
    },

    /**
     * Creates the thin surface crust — a lighter colored strip along the
     * top edge of the terrain that looks like the planet's "skin."
     * It has a rough, jagged edge to suggest erosion and wear.
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {number[]} heightMap — The terrain height map
     * @param {number} worldWidth — World width in pixels
     * @returns {Phaser.GameObjects.Graphics} — The crust graphic
     */
    createSurfaceCrust: function (scene, heightMap, worldWidth) {
        const crust = scene.add.graphics();
        crust.setDepth(-9);  // Just above the rock body

        const crustThickness = 12;  // How thick the crust layer is (in pixels)
        const step = 3;  // Sample every 3 pixels for slightly more detail than rock

        // --- Main crust fill (slightly lighter than rock below) ---
        crust.fillStyle(0x2a2420, 1);
        crust.beginPath();

        // Top edge: follows the heightMap exactly
        crust.moveTo(0, heightMap[0]);
        for (let x = step; x < worldWidth; x += step) {
            crust.lineTo(x, heightMap[x]);
        }
        crust.lineTo(worldWidth - 1, heightMap[worldWidth - 1]);

        // Bottom edge: follows the heightMap but pushed down by crustThickness,
        // with small random jitter for a rough/jagged look
        for (let x = worldWidth - 1; x >= 0; x -= step) {
            const jitter = Math.sin(x * 0.05) * 3 + Math.sin(x * 0.13) * 2;
            crust.lineTo(x, heightMap[x] + crustThickness + jitter);
        }
        crust.closePath();
        crust.fillPath();

        // --- Surface edge highlight ---
        // A thin bright line right along the top to give a crisp edge
        crust.lineStyle(2, 0x3a3430, 0.8);
        crust.beginPath();
        crust.moveTo(0, heightMap[0]);
        for (let x = step; x < worldWidth; x += step) {
            crust.lineTo(x, heightMap[x]);
        }
        crust.strokePath();

        // --- Scattered surface rocks / debris along the top ---
        // Small angular shapes sitting on the surface line
        for (let i = 0; i < 150; i++) {
            const rx = Math.floor(Math.random() * worldWidth);
            const ry = heightMap[Math.min(rx, worldWidth - 1)];
            const size = 3 + Math.random() * 8;

            // Dark little rock shapes
            crust.fillStyle(0x222018, 0.6 + Math.random() * 0.3);
            crust.beginPath();
            crust.moveTo(rx, ry);
            crust.lineTo(rx + size * 0.6, ry - size * 0.8);
            crust.lineTo(rx + size, ry - size * 0.2);
            crust.lineTo(rx + size * 0.8, ry + 2);
            crust.closePath();
            crust.fillPath();
        }

        return crust;
    },

    /**
     * Creates the glowing Voidheart Ore vein clusters embedded in the rock.
     * These are branching, crack-like veins of purplish-red with gold accents
     * that pulse slowly (brightness animation via tweens).
     *
     * Each cluster is a separate Graphics object so it can be individually
     * tweened for the pulse effect.
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {number[]} heightMap — The terrain height map
     * @param {number} worldWidth — World width in pixels
     * @param {number} worldHeight — World height in pixels
     * @returns {Phaser.GameObjects.Graphics[]} — Array of ore vein graphics (for cleanup if needed)
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
            // a "breathing" glow effect. Each cluster has a slightly different
            // duration and delay so they don't all pulse in sync.
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
