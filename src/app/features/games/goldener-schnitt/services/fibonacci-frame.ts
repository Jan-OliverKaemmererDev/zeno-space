import * as THREE from 'three';
import { getFibonacciSequence } from '../utils/phyllotaxis-geometry';

/**
 * Service managing the 3D Fibonacci Rectangles, Golden Logarithmic Spiral,
 * white cosmic starfield, golden pollen particle field, and two rotating spiral galaxies
 * (top-right and bottom-left) in the scene background.
 *
 * Expands dynamically as more seeds/numbers are added to the scene.
 */
export class FibonacciFrame {
  private frameGroup: THREE.Group | null = null;
  private goldenElementsGroup: THREE.Group | null = null;

  private spiralLine: THREE.Line | null = null;
  private squareLines: THREE.LineSegments | null = null;
  private particlePoints: THREE.Points | null = null;
  private particleMaterial: THREE.PointsMaterial | null = null;

  // White background starfield
  private starfieldPoints: THREE.Points | null = null;
  private starfieldMaterial: THREE.PointsMaterial | null = null;

  // Two distant spiral galaxies
  private galaxyTopRight: THREE.Group | null = null;
  private galaxyTopRightPoints: THREE.Points | null = null;
  private galaxyBottomLeft: THREE.Group | null = null;
  private galaxyBottomLeftPoints: THREE.Points | null = null;

  // Soft glow sprite texture for all particle systems
  private particleGlowTexture: THREE.CanvasTexture | null = null;

  private currentVisibleStep = 4.0;
  private targetVisibleStep = 4.0;
  private readonly maxSteps = 16;
  private readonly pointsPerStep = 24;

  /**
   * Initializes the 3D Fibonacci geometry, white starfield,
   * golden pollen cloud, and distant spiral galaxies.
   */
  init(parentGroup: THREE.Group): void {
    this.frameGroup = new THREE.Group();
    this.frameGroup.position.set(0, 0, 0);
    parentGroup.add(this.frameGroup);

    // Group for elements that rotate in sync with the golden sunflower seeds
    this.goldenElementsGroup = new THREE.Group();
    this.goldenElementsGroup.position.set(0, 0, -0.6);
    this.frameGroup.add(this.goldenElementsGroup);

    this.createFibonacciSquaresAndSpiral();
    this.createGoldenPollenParticles();
    this.createWhiteStarfield();
    this.createGalaxies();
  }

  /**
   * Updates time-based animations:
   * - Smooth dynamic expansion of the Fibonacci spiral and squares harmonized with seed count
   * - Synchronized rotation of the golden elements with the numbers
   * - Gentle self-rotation of the two spiral galaxies on their own axes
   *
   * @param time - Current timestamp in seconds.
   * @param seedCount - Current number of seeds placed in the scene.
   * @param rotationAngle - Global golden rotation angle matching the numbers.
   */
  update(time: number, seedCount: number, rotationAngle = 0): void {
    if (!this.frameGroup) return;

    // Dynamically expand visible lines in harmony with the outer boundary of the seed swarm:
    // Sunflower phyllotaxis boundary grows with r = 2.75 + 0.68 * sqrt(N).
    // The Fibonacci spiral radius grows with phi^step.
    // By coupling step = 7.2 + log_phi(seedOuterRadius / 2.75), the spiral expansion
    // precisely tracks the outer boundary of the numbers and never runs away into empty space.
    const count = Math.max(1, seedCount);
    const seedOuterRadius = 2.75 + 0.68 * Math.sqrt(count);
    const phi = (1 + Math.sqrt(5)) / 2;
    this.targetVisibleStep = Math.min(
      this.maxSteps,
      7.2 + Math.log(seedOuterRadius / 2.75) / Math.log(phi)
    );
    this.currentVisibleStep += (this.targetVisibleStep - this.currentVisibleStep) * 0.16;

    // Rotate golden elements (spiral line, squares, golden pollen) in sync with the seeds
    if (this.goldenElementsGroup) {
      this.goldenElementsGroup.rotation.z = rotationAngle;
    }

    // Dynamically adjust draw ranges to expand the golden lines
    if (this.squareLines?.geometry) {
      const visibleSquares = Math.min(this.maxSteps, Math.floor(this.currentVisibleStep));
      this.squareLines.geometry.setDrawRange(0, visibleSquares * 8);
    }

    if (this.spiralLine?.geometry) {
      const totalPoints = this.maxSteps * this.pointsPerStep + 1;
      const visiblePoints = Math.min(
        totalPoints,
        Math.floor(this.currentVisibleStep * this.pointsPerStep)
      );
      this.spiralLine.geometry.setDrawRange(0, visiblePoints);
    }

    // Golden pollen particles gentle drifting
    if (this.particlePoints) {
      this.particlePoints.rotation.z = time * 0.012;
    }

    // Self-rotation of the two spiral galaxies around their own axes
    if (this.galaxyTopRight) {
      this.galaxyTopRight.rotation.z = time * 0.018;
    }
    if (this.galaxyBottomLeft) {
      this.galaxyBottomLeft.rotation.z = -time * 0.024;
    }
  }

  /**
   * Generates the authentic nested Fibonacci squares and the congruent Fibonacci Golden Spiral.
   * Every quarter-circular arc is inscribed directly within its respective Fibonacci square,
   * curving from corner to corner with C1 tangent continuity.
   *
   * The pole (convergence center) is positioned exactly at (0, 0), and scale is calibrated
   * to seamlessly harmonize with Vogel's sunflower phyllotaxis.
   */
  private createFibonacciSquaresAndSpiral(): void {
    if (!this.goldenElementsGroup) return;

    const fibs = getFibonacciSequence(this.maxSteps);
    const scale = 0.16; // Normalized scale calibrated to seed radius

    // Direction cycle for expanding Fibonacci rectangles:
    // 0: Left, 1: Down, 2: Right, 3: Up
    let minX = -1;
    let maxX = 1;
    let minY = 0;
    let maxY = 1;

    const squareBoxes: { x: number; y: number; s: number }[] = [
      { x: 0, y: 0, s: 1 },
      { x: -1, y: 0, s: 1 },
    ];

    for (let i = 2; i < this.maxSteps; i++) {
      const s = fibs[i];
      const dir = (i - 1) % 4;
      let bx = 0;
      let by = 0;

      if (dir === 1) {
        // Down
        bx = minX;
        by = minY - s;
        minY = by;
      } else if (dir === 2) {
        // Right
        bx = maxX;
        by = minY;
        maxX = bx + s;
      } else if (dir === 3) {
        // Up
        bx = minX;
        by = maxY;
        maxY = by + s;
      } else {
        // Left (dir === 0)
        bx = minX - s;
        by = minY;
        minX = bx;
      }

      squareBoxes.push({ x: bx, y: by, s });
    }

    // Mathematical pole offset so the spiral's convergence center is positioned at (0, 0)
    const poleX = -0.5;
    const poleY = 0.25;

    // 1. Generate Square line segments (translucent subtle gold)
    const squareVertices: number[] = [];
    for (let i = 0; i < squareBoxes.length; i++) {
      const box = squareBoxes[i];
      const x0 = (box.x - poleX) * scale;
      const y0 = (box.y - poleY) * scale;
      const x1 = (box.x + box.s - poleX) * scale;
      const y1 = (box.y + box.s - poleY) * scale;
      const z = -0.15;

      // 4 edges per square = 8 vertices
      squareVertices.push(x0, y0, z, x1, y0, z);
      squareVertices.push(x1, y0, z, x1, y1, z);
      squareVertices.push(x1, y1, z, x0, y1, z);
      squareVertices.push(x0, y1, z, x0, y0, z);
    }

    // 2. Generate the authentic quarter-circular arcs inscribed inside the Fibonacci squares
    interface ArcDef {
      cx: number;
      cy: number;
      r: number;
      a0: number;
      a1: number;
    }
    const arcs: ArcDef[] = [
      { cx: 0 - poleX, cy: 0 - poleY, r: 1, a0: 0, a1: Math.PI / 2 },
      { cx: 0 - poleX, cy: 0 - poleY, r: 1, a0: Math.PI / 2, a1: Math.PI },
    ];

    for (let i = 2; i < this.maxSteps; i++) {
      const prev = arcs[i - 1];
      const endX = prev.cx + prev.r * Math.cos(prev.a1);
      const endY = prev.cy + prev.r * Math.sin(prev.a1);
      const a0 = prev.a1;
      const a1 = a0 + Math.PI / 2;
      const r = fibs[i];
      const cx = endX - r * Math.cos(a0);
      const cy = endY - r * Math.sin(a0);
      arcs.push({ cx, cy, r, a0, a1 });
    }

    const spiralVertices: number[] = [];
    for (let s = 0; s < this.maxSteps; s++) {
      const arc = arcs[s];
      for (let p = 0; p < this.pointsPerStep; p++) {
        const th = arc.a0 + (p / this.pointsPerStep) * (arc.a1 - arc.a0);
        const px = (arc.cx + arc.r * Math.cos(th)) * scale;
        const py = (arc.cy + arc.r * Math.sin(th)) * scale;
        spiralVertices.push(px, py, -0.10);
      }
    }
    const lastArc = arcs[this.maxSteps - 1];
    spiralVertices.push(
      (lastArc.cx + lastArc.r * Math.cos(lastArc.a1)) * scale,
      (lastArc.cy + lastArc.r * Math.sin(lastArc.a1)) * scale,
      -0.10
    );

    // Buffer geometry for Squares
    const squareGeo = new THREE.BufferGeometry();
    squareGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(squareVertices, 3)
    );
    squareGeo.setDrawRange(0, 7 * 8);

    const squareMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.squareLines = new THREE.LineSegments(squareGeo, squareMat);
    this.squareLines.frustumCulled = false;
    this.goldenElementsGroup.add(this.squareLines);

    // Buffer geometry for Continuous Golden Spiral curve (radiant glowing gold)
    const spiralGeo = new THREE.BufferGeometry();
    spiralGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(spiralVertices, 3)
    );
    spiralGeo.setDrawRange(0, 7 * this.pointsPerStep);

    const spiralMat = new THREE.LineBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.spiralLine = new THREE.Line(spiralGeo, spiralMat);
    this.spiralLine.frustumCulled = false;
    this.goldenElementsGroup.add(this.spiralLine);
  }

  /**
   * Creates a reusable soft circular radial glow sprite texture for all particle systems
   * (starfield, pollen cloud, and spiral galaxies) inspired by Stellaris galaxy-background.
   */
  private createParticleGlowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 8);
      gradient.addColorStop(0, 'rgba(255,255,255,1.0)');
      gradient.addColorStop(0.25, 'rgba(255,255,255,0.85)');
      gradient.addColorStop(0.55, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0.0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 16, 16);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    return texture;
  }

  /**
   * Creates a sparkling cosmic cloud of golden pollen/stardust particles.
   */
  private createGoldenPollenParticles(): void {
    if (!this.goldenElementsGroup) return;

    if (!this.particleGlowTexture) {
      this.particleGlowTexture = this.createParticleGlowTexture();
    }

    const particleCount = 2800;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const goldA = new THREE.Color(0xfde047);
    const goldB = new THREE.Color(0xf59e0b);
    const goldC = new THREE.Color(0xd97706);

    for (let i = 0; i < particleCount; i++) {
      const theta = i * 2.3999632;
      const radius = 1.2 + 0.48 * Math.sqrt(i) + (Math.random() - 0.5) * 1.8;
      const z = -2.5 + (Math.random() - 0.5) * 6.0;

      positions[i * 3] = radius * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(theta);
      positions[i * 3 + 2] = z;

      const mix = Math.random();
      const col = mix < 0.5 ? goldA.clone().lerp(goldB, mix * 2) : goldB.clone().lerp(goldC, (mix - 0.5) * 2);
      col.multiplyScalar(0.6 + Math.random() * 0.4);

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      map: this.particleGlowTexture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.particlePoints = new THREE.Points(particleGeo, this.particleMaterial);
    this.particlePoints.frustumCulled = false;
    this.goldenElementsGroup.add(this.particlePoints);
  }

  /**
   * Creates the deep background white particle starfield.
   * Particles are sized identically to the golden particles (size: 0.16)
   * with soft circular glow and brightness modulation.
   */
  private createWhiteStarfield(): void {
    if (!this.frameGroup) return;

    if (!this.particleGlowTexture) {
      this.particleGlowTexture = this.createParticleGlowTexture();
    }

    const starCount = 3200;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const starColor = new THREE.Color(0xffffff);

    // Distribute across a broad deep cosmic volume behind the scene
    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 440;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 300;
      positions[i * 3 + 2] = -12.0 - Math.random() * 120.0;

      // Natural stellar magnitude brightness variation (like Stellaris background stars)
      const brightness = 0.4 + Math.random() * 0.6;
      colors[i * 3] = starColor.r * brightness;
      colors[i * 3 + 1] = starColor.g * brightness;
      colors[i * 3 + 2] = starColor.b * brightness;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.starfieldMaterial = new THREE.PointsMaterial({
      size: 0.16, // Exactly matching golden particles size
      vertexColors: true,
      map: this.particleGlowTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.starfieldPoints = new THREE.Points(starGeo, this.starfieldMaterial);
    this.starfieldPoints.frustumCulled = false;
    this.frameGroup.add(this.starfieldPoints);
  }

  /**
   * Creates the two spiral galaxies:
   * 1. Top-Right: Small, faint, and placed deep in the cosmic distance (z = -80.0)
   * 2. Bottom-Left: Extremely large, prominent, and sweeping across the lower-left cosmos
   */
  private createGalaxies(): void {
    if (!this.frameGroup) return;

    if (!this.particleGlowTexture) {
      this.particleGlowTexture = this.createParticleGlowTexture();
    }

    // 1. Top-Right Distant Dwarf Spiral Galaxy (Small & deeply distant)
    this.galaxyTopRight = new THREE.Group();
    this.galaxyTopRight.position.set(42.0, 26.0, -80.0);
    // Aesthetic 3D perspective tilt
    this.galaxyTopRight.rotation.x = 0.62;
    this.galaxyTopRight.rotation.y = -0.35;

    this.galaxyTopRightPoints = this.createSpiralGalaxy({
      count: 2200,
      radius: 4.2,
      branches: 2,
      spin: 0.65,
      randomness: 0.32,
      randomnessPower: 2.8,
      size: 0.13,
      opacity: 0.62,
    });
    this.galaxyTopRight.add(this.galaxyTopRightPoints);
    this.frameGroup.add(this.galaxyTopRight);

    // 2. Bottom-Left Giant Spiral Galaxy (Extremely large & prominent)
    this.galaxyBottomLeft = new THREE.Group();
    this.galaxyBottomLeft.position.set(-32.0, -22.0, -18.0);
    // Aesthetic 3D perspective tilt
    this.galaxyBottomLeft.rotation.x = -0.58;
    this.galaxyBottomLeft.rotation.y = 0.42;

    this.galaxyBottomLeftPoints = this.createSpiralGalaxy({
      count: 14000,
      radius: 38.0,
      branches: 2,
      spin: 0.42,
      randomness: 0.38,
      randomnessPower: 2.7,
      size: 0.18,
      opacity: 0.92,
    });
    this.galaxyBottomLeft.add(this.galaxyBottomLeftPoints);
    this.frameGroup.add(this.galaxyBottomLeft);
  }

  /**
   * Procedurally generates a spiral galaxy with Stellaris 3-layer morphology:
   * - Dense spherical core bulge
   * - Soft inter-arm disc dust
   * - Logarithmic spiral arms with power-law scatter & star clusters
   */
  private createSpiralGalaxy(params: {
    count: number;
    radius: number;
    branches: number;
    spin: number;
    randomness: number;
    randomnessPower: number;
    size?: number;
    opacity?: number;
  }): THREE.Points {
    const {
      count,
      radius,
      branches,
      spin,
      randomness,
      randomnessPower,
      size = 0.16,
      opacity = 0.90,
    } = params;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    // Color palette: Pure White and Luminous Light Blues (Ice Blue, Sky Blue, Electric Cyan, Azure)
    const colorWhite = new THREE.Color(0xffffff);
    const colorCoreGlow = new THREE.Color(0xf0f9ff); // Radiant diamond white-blue
    const colorIceBlue = new THREE.Color(0xe0f2fe); // Luminous ice blue
    const colorLightCyan = new THREE.Color(0xbae6fd); // Electric light cyan
    const colorSkyBlue = new THREE.Color(0x7dd3fc); // Sky blue
    const colorDeepAzure = new THREE.Color(0x0284c7); // Deep celestial ocean blue
    const colorCluster = new THREE.Color(0xffffff); // Brilliant stellar cluster

    const coreCount = Math.floor(count * 0.18); // Dense core
    const discCount = Math.floor(count * 0.32); // Inter-arm disc
    const armCount = count - coreCount - discCount; // Spiral arms
    const coreRadius = radius * 0.18;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      let x = 0;
      let y = 0;
      let z = 0;
      let mixedColor = colorWhite.clone();

      if (i < coreCount) {
        // Layer 1: Dense spherical/ellipsoid galactic core bulge (Stellaris core)
        const r = Math.pow(Math.random(), 2.2) * coreRadius;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);

        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi) * 0.45; // flattened disc thickness

        mixedColor = Math.random() < 0.65 ? colorWhite.clone() : colorCoreGlow.clone();
        mixedColor.multiplyScalar(0.75 + Math.random() * 0.25);
      } else if (i < coreCount + discCount) {
        // Layer 2: Ambient galactic disc to fill space between arms (Stellaris disc)
        const r = Math.pow(Math.random(), 1.45) * radius;
        const angle = Math.random() * Math.PI * 2;

        x = Math.cos(angle) * r;
        y = Math.sin(angle) * r;
        z = (Math.random() - 0.5) * (r < coreRadius ? 0.7 : 0.24);

        const normR = r / radius;
        if (normR < 0.45) {
          mixedColor = colorLightCyan.clone().lerp(colorSkyBlue, Math.random());
        } else {
          mixedColor = colorSkyBlue.clone().lerp(colorDeepAzure, Math.random());
        }
        // Softer disc stardust so arms stand out
        mixedColor.multiplyScalar(0.42 + Math.random() * 0.38);
      } else {
        // Layer 3: Prominent logarithmic spiral arms with power-distributed scatter
        const armIndex = i % branches;
        const branchAngle = (armIndex / branches) * Math.PI * 2;
        const r = Math.pow(Math.random(), 1.15) * radius;
        const spinAngle = r * spin;

        // Power-law scatter (Stellaris formula): dense spine with ethereal outer spray
        const randomX = Math.pow(Math.random(), randomnessPower) *
          (Math.random() < 0.5 ? 1 : -1) * randomness * r;
        const randomY = Math.pow(Math.random(), randomnessPower) *
          (Math.random() < 0.5 ? 1 : -1) * randomness * r;
        const randomZ = Math.pow(Math.random(), 2.0) *
          (Math.random() < 0.5 ? 1 : -1) * 0.22 * (1.0 + r * 0.12);

        const th = branchAngle + spinAngle;
        x = Math.cos(th) * r + randomX;
        y = Math.sin(th) * r + randomY;
        z = randomZ;

        const normR = r / radius;
        if (normR < 0.35) {
          mixedColor = colorCoreGlow.clone().lerp(colorLightCyan, normR / 0.35);
        } else if (normR < 0.72) {
          const t = (normR - 0.35) / 0.37;
          mixedColor = colorLightCyan.clone().lerp(colorSkyBlue, t);
        } else {
          const t = (normR - 0.72) / 0.28;
          mixedColor = colorSkyBlue.clone().lerp(colorDeepAzure, t);
        }

        // Occasional bright stellar clusters along the spiral arms (like Stellaris)
        if (r > 2.0 && Math.random() > 0.93) {
          mixedColor = Math.random() < 0.5 ? colorWhite.clone() : colorIceBlue.clone();
        }

        // Natural stellar magnitude variation
        mixedColor.multiplyScalar(0.55 + Math.random() * 0.45);
      }

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      map: this.particleGlowTexture || undefined,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  /**
   * Cleanly disposes all geometry, materials, groups, meshes, and textures.
   */
  dispose(parentGroup: THREE.Group): void {
    if (this.frameGroup) {
      if (this.spiralLine) {
        this.spiralLine.geometry.dispose();
        (this.spiralLine.material as THREE.Material).dispose();
        this.goldenElementsGroup?.remove(this.spiralLine);
        this.spiralLine = null;
      }
      if (this.squareLines) {
        this.squareLines.geometry.dispose();
        (this.squareLines.material as THREE.Material).dispose();
        this.goldenElementsGroup?.remove(this.squareLines);
        this.squareLines = null;
      }
      if (this.particlePoints) {
        this.particlePoints.geometry.dispose();
        this.particleMaterial?.dispose();
        this.goldenElementsGroup?.remove(this.particlePoints);
        this.particlePoints = null;
      }
      if (this.starfieldPoints) {
        this.starfieldPoints.geometry.dispose();
        this.starfieldMaterial?.dispose();
        this.frameGroup.remove(this.starfieldPoints);
        this.starfieldPoints = null;
      }
      if (this.galaxyTopRightPoints) {
        this.galaxyTopRightPoints.geometry.dispose();
        (this.galaxyTopRightPoints.material as THREE.Material).dispose();
        this.galaxyTopRight?.remove(this.galaxyTopRightPoints);
        this.galaxyTopRightPoints = null;
      }
      if (this.galaxyTopRight) {
        this.frameGroup.remove(this.galaxyTopRight);
        this.galaxyTopRight = null;
      }
      if (this.galaxyBottomLeftPoints) {
        this.galaxyBottomLeftPoints.geometry.dispose();
        (this.galaxyBottomLeftPoints.material as THREE.Material).dispose();
        this.galaxyBottomLeft?.remove(this.galaxyBottomLeftPoints);
        this.galaxyBottomLeftPoints = null;
      }
      if (this.galaxyBottomLeft) {
        this.frameGroup.remove(this.galaxyBottomLeft);
        this.galaxyBottomLeft = null;
      }
      if (this.goldenElementsGroup) {
        this.frameGroup.remove(this.goldenElementsGroup);
        this.goldenElementsGroup = null;
      }
      if (this.particleGlowTexture) {
        this.particleGlowTexture.dispose();
        this.particleGlowTexture = null;
      }
      parentGroup.remove(this.frameGroup);
      this.frameGroup = null;
    }
  }
}
