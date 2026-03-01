/**
 * FormationGenerator.js — Alien Geological Formations
 *
 * Generates above-ground rock formations scattered across the terrain.
 * These are natural geological features of the alien planet — NOT enemy
 * structures. They sit on top of the terrain surface and add visual
 * variety to the world.
 *
 * Formation types:
 *   - Spires: tall, thin, pointed rock columns
 *   - Arches: curved formations with open archways
 *   - Mesas/Plateaus: flat-topped elevated rock platforms
 *   - Crystal clusters: angular, translucent crystal growths
 *
 * Each formation is created as a Phaser Container holding its Graphics
 * objects, so collision can be added in a later phase.
 */

const FormationGenerator = {

    /**
     * Generates all geological formations across the world.
     * Places 15-25 formations of mixed types at random positions along
     * the terrain, with varied sizes. Each formation's base aligns with
     * the terrain surface at its position.
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {number[]} heightMap — The terrain height map
     * @param {number} worldWidth — World width in pixels
     * @returns {Phaser.GameObjects.Container[]} — Array of formation containers
     */
    generateFormations: function (scene, heightMap, worldWidth) {
        const formations = [];

        // How many formations to place (15-25)
        const count = 15 + Math.floor(Math.random() * 11);

        // Divide the world into zones to prevent clumping.
        // Each zone gets 0-2 formations, ensuring good spread.
        const zoneWidth = worldWidth / count;

        for (let i = 0; i < count; i++) {
            // Pick a random X position within this zone
            const x = zoneWidth * i + zoneWidth * 0.2 + Math.random() * zoneWidth * 0.6;

            // Get the terrain surface Y at this position
            const mapIndex = Math.floor(Math.min(Math.max(x, 0), worldWidth - 1));
            const surfaceY = heightMap[mapIndex];

            // Pick a random formation type
            const typeRoll = Math.random();
            let formation;

            if (typeRoll < 0.3) {
                // 30% chance: Spire
                formation = this._createSpire(scene, x, surfaceY);
            } else if (typeRoll < 0.5) {
                // 20% chance: Arch
                formation = this._createArch(scene, x, surfaceY);
            } else if (typeRoll < 0.75) {
                // 25% chance: Mesa/Plateau
                formation = this._createMesa(scene, x, surfaceY);
            } else {
                // 25% chance: Crystal cluster
                formation = this._createCrystalCluster(scene, x, surfaceY);
            }

            formations.push(formation);
        }

        return formations;
    },

    /**
     * Creates a tall, thin, pointed rock spire.
     * Like a stalagmite but sharper and more angular — alien geology.
     * Some spires have glowing ore veins running up them.
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {number} x — X position (world coordinates)
     * @param {number} surfaceY — Y position of the terrain surface here
     * @returns {Phaser.GameObjects.Container} — The spire container
     */
    _createSpire: function (scene, x, surfaceY) {
        const g = scene.add.graphics();

        // Vary the size — some small, some large
        const height = 80 + Math.random() * 220;  // 80-300px tall
        const baseWidth = 20 + Math.random() * 30; // 20-50px wide at base

        // Main spire body — dark stone with angular shape
        g.fillStyle(0x1e1a16, 1);
        g.beginPath();
        g.moveTo(0, 0);                               // Pointed tip (top)
        g.lineTo(-baseWidth * 0.3, -height * 0.3);    // Upper left face
        g.lineTo(-baseWidth * 0.5, -height * 0.7);    // Mid-left
        g.lineTo(-baseWidth * 0.6, -height);           // Base left
        g.lineTo(baseWidth * 0.5, -height);            // Base right
        g.lineTo(baseWidth * 0.4, -height * 0.65);    // Mid-right
        g.lineTo(baseWidth * 0.2, -height * 0.25);    // Upper right face
        g.closePath();
        g.fillPath();

        // Slightly lighter face on one side to suggest 3D depth
        g.fillStyle(0x262018, 0.7);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(baseWidth * 0.2, -height * 0.25);
        g.lineTo(baseWidth * 0.4, -height * 0.65);
        g.lineTo(baseWidth * 0.5, -height);
        g.lineTo(baseWidth * 0.1, -height);
        g.lineTo(-baseWidth * 0.1, -height * 0.5);
        g.closePath();
        g.fillPath();

        // Edge lines for definition
        g.lineStyle(1, 0x2e2a22, 0.6);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(-baseWidth * 0.3, -height * 0.3);
        g.lineTo(-baseWidth * 0.5, -height * 0.7);
        g.lineTo(-baseWidth * 0.6, -height);
        g.lineTo(baseWidth * 0.5, -height);
        g.lineTo(baseWidth * 0.4, -height * 0.65);
        g.lineTo(baseWidth * 0.2, -height * 0.25);
        g.closePath();
        g.strokePath();

        // 50% chance of having an ore vein running up the spire
        if (Math.random() > 0.5) {
            g.lineStyle(2, 0x8b2252, 0.7);
            g.beginPath();
            g.moveTo(-baseWidth * 0.1, -height * 0.9);
            g.lineTo(-baseWidth * 0.15, -height * 0.6);
            g.lineTo(0, -height * 0.3);
            g.lineTo(baseWidth * 0.05, -height * 0.1);
            g.strokePath();

            // Gold accent
            g.lineStyle(1, 0xdaa520, 0.5);
            g.beginPath();
            g.moveTo(-baseWidth * 0.05, -height * 0.85);
            g.lineTo(-baseWidth * 0.08, -height * 0.55);
            g.lineTo(baseWidth * 0.03, -height * 0.25);
            g.strokePath();
        }

        // Position the spire so its base sits on the terrain surface.
        // The spire is drawn with tip at (0,0) going DOWN, so we offset
        // the container so the base (bottom of spire) is at surfaceY.
        const container = scene.add.container(x, surfaceY - height, [g]);
        container.setDepth(-5);

        return container;
    },

    /**
     * Creates a curved rock arch formation.
     * An ancient, weathered arch with an open space underneath that a
     * player could theoretically fly through. Drawn as two pillars
     * connected by a curved top piece.
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {number} x — X position (world coordinates)
     * @param {number} surfaceY — Y position of the terrain surface here
     * @returns {Phaser.GameObjects.Container} — The arch container
     */
    _createArch: function (scene, x, surfaceY) {
        const g = scene.add.graphics();

        // Arch dimensions
        const archWidth = 100 + Math.random() * 120;   // 100-220px wide
        const archHeight = 100 + Math.random() * 150;   // 100-250px tall
        const pillarWidth = 18 + Math.random() * 14;    // 18-32px pillar thickness

        const halfW = archWidth / 2;

        // --- Left pillar ---
        g.fillStyle(0x1e1a16, 1);
        g.fillRect(-halfW - pillarWidth / 2, -archHeight, pillarWidth, archHeight);

        // --- Right pillar ---
        g.fillStyle(0x1e1a16, 1);
        g.fillRect(halfW - pillarWidth / 2, -archHeight, pillarWidth, archHeight);

        // --- Arch top (curved connection between pillars) ---
        // Draw as a thick curved line across the top
        g.fillStyle(0x1e1a16, 1);
        g.beginPath();

        // Outer curve (top of arch)
        const outerH = archHeight + 30 + Math.random() * 20;
        g.moveTo(-halfW - pillarWidth / 2, -archHeight);
        // Approximate a curve with several line segments
        const curveSteps = 12;
        for (let i = 0; i <= curveSteps; i++) {
            const t = i / curveSteps;
            const cx = -halfW + t * archWidth;
            // Parabolic curve: highest in the middle
            const cy = -archHeight - (outerH - archHeight) * Math.sin(t * Math.PI);
            g.lineTo(cx, cy);
        }
        g.lineTo(halfW + pillarWidth / 2, -archHeight);

        // Inner curve (bottom of arch bridge — the opening)
        const innerH = archHeight * 0.7;
        for (let i = curveSteps; i >= 0; i--) {
            const t = i / curveSteps;
            const cx = -halfW + pillarWidth / 2 + t * (archWidth - pillarWidth);
            const cy = -innerH * 0.4 - innerH * 0.6 * Math.sin(t * Math.PI);
            g.lineTo(cx, cy);
        }

        g.closePath();
        g.fillPath();

        // --- Weathering details: lighter patches on the pillars ---
        g.fillStyle(0x262018, 0.5);
        g.fillRect(-halfW - pillarWidth / 2 + 3, -archHeight * 0.8, pillarWidth * 0.4, archHeight * 0.3);
        g.fillRect(halfW - pillarWidth / 2 + 4, -archHeight * 0.5, pillarWidth * 0.4, archHeight * 0.4);

        // --- Edge definition ---
        g.lineStyle(1, 0x2e2a22, 0.5);
        // Left pillar outline
        g.strokeRect(-halfW - pillarWidth / 2, -archHeight, pillarWidth, archHeight);
        // Right pillar outline
        g.strokeRect(halfW - pillarWidth / 2, -archHeight, pillarWidth, archHeight);

        // --- Optional ore vein along the arch ---
        if (Math.random() > 0.4) {
            g.lineStyle(2, 0x8b2252, 0.6);
            g.beginPath();
            g.moveTo(-halfW, -archHeight * 0.3);
            g.lineTo(-halfW + 5, -archHeight * 0.7);
            g.lineTo(-halfW + pillarWidth * 0.3, -archHeight);
            g.strokePath();
        }

        // Position so the base of the pillars sits on the terrain
        const container = scene.add.container(x, surfaceY, [g]);
        container.setDepth(-5);

        return container;
    },

    /**
     * Creates a flat-topped mesa/plateau formation.
     * Wide and sturdy looking, elevated above the terrain.
     * Some have ore veins glowing along their edges.
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {number} x — X position (world coordinates)
     * @param {number} surfaceY — Y position of the terrain surface here
     * @returns {Phaser.GameObjects.Container} — The mesa container
     */
    _createMesa: function (scene, x, surfaceY) {
        const g = scene.add.graphics();

        // Mesa dimensions
        const mesaWidth = 120 + Math.random() * 150;    // 120-270px wide
        const mesaHeight = 60 + Math.random() * 100;     // 60-160px tall
        const topWidth = mesaWidth * (0.6 + Math.random() * 0.2);  // Top is narrower than base
        const halfBase = mesaWidth / 2;
        const halfTop = topWidth / 2;

        // --- Main mesa body (trapezoidal shape) ---
        g.fillStyle(0x1e1a16, 1);
        g.beginPath();
        g.moveTo(-halfTop, -mesaHeight);          // Top-left
        g.lineTo(halfTop, -mesaHeight);            // Top-right
        g.lineTo(halfBase, 0);                     // Bottom-right
        g.lineTo(-halfBase, 0);                    // Bottom-left
        g.closePath();
        g.fillPath();

        // --- Flat top surface (slightly lighter for contrast) ---
        g.fillStyle(0x2a2420, 0.9);
        g.beginPath();
        g.moveTo(-halfTop, -mesaHeight);
        g.lineTo(halfTop, -mesaHeight);
        g.lineTo(halfTop, -mesaHeight + 8);
        g.lineTo(-halfTop, -mesaHeight + 8);
        g.closePath();
        g.fillPath();

        // --- Horizontal striations on the mesa face ---
        const strataCount = Math.floor(mesaHeight / 15);
        for (let s = 0; s < strataCount; s++) {
            const sy = -mesaHeight + 12 + s * (mesaHeight - 12) / strataCount;
            const t = (sy + mesaHeight) / mesaHeight;  // 0 at top, 1 at bottom
            const leftEdge = -halfTop + (halfTop - halfBase) * (1 - t) * -1;
            const rightEdge = halfTop + (halfBase - halfTop) * t;

            // Slightly different shade for each stratum
            const shade = (s % 2 === 0) ? 0x161210 : 0x201a14;
            g.lineStyle(1, shade, 0.4);
            g.beginPath();
            g.moveTo(-halfTop - (halfBase - halfTop) * t, sy);
            g.lineTo(halfTop + (halfBase - halfTop) * t, sy);
            g.strokePath();
        }

        // --- Edge outline ---
        g.lineStyle(1, 0x2e2a22, 0.5);
        g.beginPath();
        g.moveTo(-halfTop, -mesaHeight);
        g.lineTo(halfTop, -mesaHeight);
        g.lineTo(halfBase, 0);
        g.lineTo(-halfBase, 0);
        g.closePath();
        g.strokePath();

        // --- Ore veins along edges (60% chance) ---
        if (Math.random() > 0.4) {
            // Vein along left face
            g.lineStyle(2, 0x8b2252, 0.7);
            g.beginPath();
            g.moveTo(-halfTop - 2, -mesaHeight * 0.2);
            g.lineTo(-halfTop - (halfBase - halfTop) * 0.5 - 3, -mesaHeight * 0.6);
            g.lineTo(-halfBase + 5, -2);
            g.strokePath();

            // Gold accent
            g.lineStyle(1, 0xdaa520, 0.5);
            g.beginPath();
            g.moveTo(-halfTop, -mesaHeight * 0.15);
            g.lineTo(-halfTop - (halfBase - halfTop) * 0.5 - 1, -mesaHeight * 0.55);
            g.strokePath();
        }

        // Position so the base sits on terrain
        const container = scene.add.container(x, surfaceY, [g]);
        container.setDepth(-5);

        return container;
    },

    /**
     * Creates a cluster of angular, translucent crystals growing out
     * of the ground at odd angles. These have a faint inner glow
     * suggesting mineral energy.
     *
     * @param {Phaser.Scene} scene — The game scene
     * @param {number} x — X position (world coordinates)
     * @param {number} surfaceY — Y position of the terrain surface here
     * @returns {Phaser.GameObjects.Container} — The crystal cluster container
     */
    _createCrystalCluster: function (scene, x, surfaceY) {
        const g = scene.add.graphics();

        // Pick a glow color for this cluster: purplish or amber
        const isPurple = Math.random() > 0.4;
        const glowColor = isPurple ? 0x7733aa : 0xcc8833;
        const brightColor = isPurple ? 0xaa55dd : 0xffaa44;
        const faintColor = isPurple ? 0x442266 : 0x664422;

        // Number of crystals in this cluster (3-7)
        const crystalCount = 3 + Math.floor(Math.random() * 5);

        for (let c = 0; c < crystalCount; c++) {
            // Each crystal is a tall, thin hexagonal prism shape
            // (simplified to a 4-sided polygon for clean vector look)
            const cHeight = 30 + Math.random() * 80;   // 30-110px tall
            const cWidth = 6 + Math.random() * 12;      // 6-18px wide
            const cAngle = (Math.random() - 0.5) * 0.8; // Tilted at odd angles
            const cX = (Math.random() - 0.5) * 60;      // Spread out horizontally

            // Save/restore state for rotation
            // Since Graphics doesn't support per-shape rotation, we calculate
            // rotated points manually
            const cos = Math.cos(cAngle);
            const sin = Math.sin(cAngle);

            // Crystal vertices (before rotation), drawn pointing UP from base
            const points = [
                { x: -cWidth / 2, y: 0 },               // Base left
                { x: -cWidth / 3, y: -cHeight },         // Tip left
                { x: 0, y: -cHeight - cWidth * 0.3 },    // Tip top (pointed)
                { x: cWidth / 3, y: -cHeight },           // Tip right
                { x: cWidth / 2, y: 0 }                   // Base right
            ];

            // Rotate and offset each point
            const rotated = points.map(p => ({
                x: cX + p.x * cos - p.y * sin,
                y: p.x * sin + p.y * cos
            }));

            // --- Crystal body (semi-transparent for glassy look) ---
            g.fillStyle(faintColor, 0.5);
            g.beginPath();
            g.moveTo(rotated[0].x, rotated[0].y);
            for (let p = 1; p < rotated.length; p++) {
                g.lineTo(rotated[p].x, rotated[p].y);
            }
            g.closePath();
            g.fillPath();

            // --- Lighter inner face (suggests internal refraction) ---
            g.fillStyle(glowColor, 0.3);
            g.beginPath();
            g.moveTo(rotated[1].x, rotated[1].y);
            g.lineTo(rotated[2].x, rotated[2].y);
            g.lineTo(rotated[3].x, rotated[3].y);
            g.lineTo(cX, -cHeight * 0.3);
            g.closePath();
            g.fillPath();

            // --- Crystal edge lines (crisp vector look) ---
            g.lineStyle(1, brightColor, 0.6);
            g.beginPath();
            g.moveTo(rotated[0].x, rotated[0].y);
            for (let p = 1; p < rotated.length; p++) {
                g.lineTo(rotated[p].x, rotated[p].y);
            }
            g.closePath();
            g.strokePath();

            // --- Center glow line (bright stripe down the middle) ---
            g.lineStyle(1, brightColor, 0.4);
            g.beginPath();
            g.moveTo(cX, 0);
            g.lineTo(rotated[2].x, rotated[2].y);
            g.strokePath();
        }

        // --- Subtle ground glow around the crystal base ---
        g.fillStyle(glowColor, 0.15);
        g.fillEllipse(0, 5, 80, 20);

        // Create container and position at terrain surface
        const container = scene.add.container(x, surfaceY, [g]);
        container.setDepth(-5);

        // --- Gentle pulse animation for the crystal glow ---
        scene.tweens.add({
            targets: g,
            alpha: { from: 0.7, to: 1.0 },
            duration: 1500 + Math.random() * 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: Math.random() * 1500
        });

        return container;
    }
};
