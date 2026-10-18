import * as THREE from 'three';

/**
 * Factory for creating the grand 3D spherical Ant Planet ("Der Große Ameisen-Planet"),
 * draped in a high-resolution moss and grass landscape texture,
 * crowned by the volcanic Ant Hill at the North Pole,
 * slender pine and forest groves, atmospheric halo,
 * and dynamic golden Ameisenstraße pheromone highways.
 */
export class AmeisenTerrainFactory {
  public static readonly PLANET_RADIUS = 34.0;

  private readonly rootGroup = new THREE.Group();
  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];
  private readonly disposableTextures: THREE.Texture[] = [];
  private readonly antTrailPoints: THREE.Vector3[] = [];

  private hillGroup!: THREE.Group;
  private currentHillLevel = 1;
  private targetHillScale = 1.0;
  private currentHillScale = 1.0;

  private dustPoints!: THREE.Points;
  private starfieldPoints!: THREE.Points;
  private pheromonePoints!: THREE.Points;
  private glowSpriteTexture: THREE.CanvasTexture | null = null;

  // Dynamic active harvest trail line between hill and selected fruit
  private activeHarvestTrailMesh: THREE.Mesh | null = null;
  private activeHarvestTrailGeo: THREE.BufferGeometry | null = null;

  constructor() {
    this.glowSpriteTexture = this.createSoftGlowTexture();
    this.buildCosmicStarfield();
    this.buildSphericalPlanet();
    this.buildAtmosphereHalo();
    this.buildAntHill();
    this.buildPlanetaryAntTrails();
    this.buildPlanetaryFlora();
    this.buildSunMotesAndFireflies();
  }

  getGroup(): THREE.Group {
    return this.rootGroup;
  }

  getPlanetRadius(): number {
    return AmeisenTerrainFactory.PLANET_RADIUS;
  }

  /**
   * Computes exact surface height at any 3D direction on the spherical planet.
   */
  public static getSurfaceRadiusAtDirection(dir: THREE.Vector3): number {
    const nx = dir.x;
    const ny = dir.y;
    const nz = dir.z;

    // Gentle organic hills and valleys across the sphere
    let disp =
      Math.sin(nx * 3.5 + nz * 3.0) * Math.cos(ny * 3.5) * 0.35 +
      Math.sin(ny * 5.0 - nx * 4.0) * 0.18;

    // Flatten the North Pole plateau (where ny > 0.88) so the Ant Hill sits cleanly
    if (ny > 0.86) {
      const poleFactor = Math.max(0, 1.0 - (ny - 0.86) / 0.14);
      disp *= poleFactor;
    }

    return AmeisenTerrainFactory.PLANET_RADIUS + disp;
  }

  /**
   * Projects any 3D point onto the planet surface at a given radial offset above ground.
   */
  public static getPointOnPlanet(dirOrPos: THREE.Vector3, heightOffset = 0): THREE.Vector3 {
    const dir = dirOrPos.clone().normalize();
    const r = AmeisenTerrainFactory.getSurfaceRadiusAtDirection(dir) + heightOffset;
    return dir.multiplyScalar(r);
  }

  /**
   * Converts spherical polar coordinates (phi from North Pole, theta around equator) to a 3D surface vector.
   */
  public static polarToSurfacePoint(phi: number, theta: number, heightOffset = 0): THREE.Vector3 {
    const dir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    ).normalize();
    return AmeisenTerrainFactory.getPointOnPlanet(dir, heightOffset);
  }

  /**
   * Aligns a Three.js Object3D so its local Y-axis points along the outward planetary normal
   * and its local Z-axis points along the tangential heading vector.
   */
  public static orientObjectOnPlanet(
    obj: THREE.Object3D,
    position: THREE.Vector3,
    heading?: THREE.Vector3,
  ): void {
    const normal = position.clone().normalize();
    let forward = heading ? heading.clone() : new THREE.Vector3(0, 0, 1);

    // Project forward vector onto the tangential plane
    forward.sub(normal.clone().multiplyScalar(forward.dot(normal)));
    if (forward.lengthSq() < 0.0001) {
      forward = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      forward.sub(normal.clone().multiplyScalar(forward.dot(normal)));
    }
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, normal).normalize();
    const m = new THREE.Matrix4().makeBasis(right, normal, forward);
    obj.quaternion.setFromRotationMatrix(m);
  }

  /**
   * Returns coordinates of the main ant hill entrance.
   */
  getAntHillEntrancePosition(): THREE.Vector3 {
    return AmeisenTerrainFactory.polarToSurfacePoint(0.12, 0, 0.22);
  }

  getTrailWaypoints(): THREE.Vector3[] {
    return this.antTrailPoints;
  }

  /**
   * Generates a soft particle glow sprite for fireflies and golden pheromones.
   */
  private createSoftGlowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.35, 'rgba(254, 240, 138, 0.85)');
      grad.addColorStop(0.7, 'rgba(234, 179, 8, 0.28)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    this.disposableTextures.push(tex);
    return tex;
  }

  /**
   * Builds a deep cosmic starfield surrounding the planet.
   */
  private buildCosmicStarfield(): void {
    const starCount = 2400;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const colWhite = new THREE.Color(0xf8fafc);
    const colGold = new THREE.Color(0xfef08a);
    const colCyan = new THREE.Color(0xbae6fd);
    const colEmerald = new THREE.Color(0xa7f3d0);

    for (let i = 0; i < starCount; i++) {
      const r = 260.0 + Math.random() * 80.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const pick = Math.random();
      const col = pick < 0.5 ? colWhite : pick < 0.75 ? colGold : pick < 0.9 ? colCyan : colEmerald;
      const brightness = 0.35 + Math.random() * 0.65;

      colors[i * 3] = col.r * brightness;
      colors[i * 3 + 1] = col.g * brightness;
      colors[i * 3 + 2] = col.b * brightness;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.5,
      sizeAttenuation: false,
      vertexColors: true,
      map: this.glowSpriteTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.starfieldPoints = new THREE.Points(starGeo, starMat);
    this.rootGroup.add(this.starfieldPoints);

    this.disposableGeometries.push(starGeo);
    this.disposableMaterials.push(starMat);
  }

  /**
   * Builds the 3D organic spherical planet draped in the moss and grass texture.
   */
  private buildSphericalPlanet(): void {
    const planetGeo = new THREE.SphereGeometry(AmeisenTerrainFactory.PLANET_RADIUS, 128, 96);
    const pos = planetGeo.attributes['position'];
    const colors = new Float32Array(pos.count * 3);

    const colPoleSoil = new THREE.Color(0x5c3e23);
    const colMeadow = new THREE.Color(0x4d8c2a);
    const colForest = new THREE.Color(0x285e19);
    const colGoldenMoss = new THREE.Color(0x7cb32f);

    const dir = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      dir.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const exactR = AmeisenTerrainFactory.getSurfaceRadiusAtDirection(dir);
      pos.setXYZ(i, dir.x * exactR, dir.y * exactR, dir.z * exactR);

      // Biome color blending
      const noise = Math.sin(dir.x * 5.0 + dir.z * 5.0) * Math.cos(dir.y * 5.0);
      const blend = (noise + 1.0) * 0.5;

      let vCol: THREE.Color;
      if (dir.y > 0.86) {
        const t = Math.min(1.0, (dir.y - 0.86) / 0.14);
        vCol = colMeadow.clone().lerp(colPoleSoil, t * 0.85);
      } else {
        vCol = colForest.clone().lerp(colMeadow, blend);
        if (noise > 0.35) {
          vCol.lerp(colGoldenMoss, (noise - 0.35) * 0.6);
        }
      }

      colors[i * 3] = vCol.r;
      colors[i * 3 + 1] = vCol.g;
      colors[i * 3 + 2] = vCol.b;
    }

    planetGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    planetGeo.computeVertexNormals();

    // Load moss ground texture generated specifically for Ameisenhügel
    const textureLoader = new THREE.TextureLoader();
    const mossTexture = textureLoader.load('/images/ameisenhuegel/moss-ground.jpg');
    mossTexture.wrapS = THREE.RepeatWrapping;
    mossTexture.wrapT = THREE.RepeatWrapping;
    mossTexture.repeat.set(24, 12);
    mossTexture.colorSpace = THREE.SRGBColorSpace;
    this.disposableTextures.push(mossTexture);

    const planetMat = new THREE.MeshStandardMaterial({
      map: mossTexture,
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.04,
    });

    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetMesh.receiveShadow = true;
    planetMesh.castShadow = true;
    planetMesh.name = 'planetGlobe';
    this.rootGroup.add(planetMesh);

    this.disposableGeometries.push(planetGeo);
    this.disposableMaterials.push(planetMat);
  }

  /**
   * Builds atmospheric halo around the larger planet horizon.
   */
  private buildAtmosphereHalo(): void {
    const atmoGeo = new THREE.SphereGeometry(AmeisenTerrainFactory.PLANET_RADIUS * 1.035, 64, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0.09,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    this.rootGroup.add(atmoMesh);

    const outerGlowGeo = new THREE.SphereGeometry(
      AmeisenTerrainFactory.PLANET_RADIUS * 1.09,
      64,
      48,
    );
    const outerGlowMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.04,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outerGlowMesh = new THREE.Mesh(outerGlowGeo, outerGlowMat);
    this.rootGroup.add(outerGlowMesh);

    this.disposableGeometries.push(atmoGeo, outerGlowGeo);
    this.disposableMaterials.push(atmoMat, outerGlowMat);
  }

  /**
   * Builds the sculpted Ant Hill crowning the North Pole plateau.
   */
  private buildAntHill(): void {
    this.hillGroup = new THREE.Group();
    const R = AmeisenTerrainFactory.PLANET_RADIUS;
    this.hillGroup.position.set(0, R - 0.45, 0);

    // 1. Organic Terraced Mound Cone
    const moundGeo = new THREE.ConeGeometry(4.8, 3.2, 48, 16);
    const moundPos = moundGeo.attributes['position'];
    const moundColors = new Float32Array(moundPos.count * 3);

    const colBaseEarth = new THREE.Color(0x52361e);
    const colTopEarth = new THREE.Color(0x7a4f2b);

    for (let i = 0; i < moundPos.count; i++) {
      const x = moundPos.getX(i);
      const y = moundPos.getY(i);
      const z = moundPos.getZ(i);

      const angle = Math.atan2(z, x);
      const ridgeNoise =
        (Math.sin(angle * 7.0 + y * 2.5) * 0.16 + Math.cos(x * 3.5 + z * 3.5) * 0.1) *
        (1.0 - Math.max(0, y) / 3.4);

      let newY = y;
      if (y > 1.1) {
        newY = 1.1 - (y - 1.1) * 0.35;
      }

      moundPos.setXYZ(i, x + Math.cos(angle) * ridgeNoise, newY, z + Math.sin(angle) * ridgeNoise);

      const t = Math.max(0, Math.min(1, (y + 1.6) / 3.2));
      const c = colBaseEarth.clone().lerp(colTopEarth, t);
      moundColors[i * 3] = c.r;
      moundColors[i * 3 + 1] = c.g;
      moundColors[i * 3 + 2] = c.b;
    }
    moundGeo.setAttribute('color', new THREE.BufferAttribute(moundColors, 3));
    moundGeo.computeVertexNormals();

    const moundMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.05,
    });

    const moundMesh = new THREE.Mesh(moundGeo, moundMat);
    moundMesh.position.y = 1.35;
    moundMesh.castShadow = true;
    moundMesh.receiveShadow = true;
    this.hillGroup.add(moundMesh);

    // 2. Summit Crater Rim
    const craterRimGeo = new THREE.TorusGeometry(0.85, 0.28, 16, 32);
    const craterRimMat = new THREE.MeshStandardMaterial({
      color: 0x422a14,
      roughness: 0.92,
    });
    const craterRim = new THREE.Mesh(craterRimGeo, craterRimMat);
    craterRim.rotation.x = Math.PI / 2;
    craterRim.position.y = 2.45;
    this.hillGroup.add(craterRim);

    const craterInnerGeo = new THREE.CircleGeometry(0.8, 24);
    const craterInnerMat = new THREE.MeshBasicMaterial({ color: 0x140a03 });
    const craterInner = new THREE.Mesh(craterInnerGeo, craterInnerMat);
    craterInner.rotation.x = -Math.PI / 2;
    craterInner.position.y = 2.4;
    this.hillGroup.add(craterInner);

    // 3. Front Archway Entrance Cave
    const archGeo = new THREE.TorusGeometry(0.68, 0.24, 14, 24);
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x36200f,
      roughness: 0.9,
    });
    const archMesh = new THREE.Mesh(archGeo, archMat);
    archMesh.position.set(0, 0.72, 3.1);
    archMesh.rotation.x = -Math.PI / 5;
    this.hillGroup.add(archMesh);

    const tunnelGeo = new THREE.CircleGeometry(0.62, 24);
    const tunnelMat = new THREE.MeshBasicMaterial({ color: 0x080402 });
    const tunnelMesh = new THREE.Mesh(tunnelGeo, tunnelMat);
    tunnelMesh.position.set(0, 0.72, 3.08);
    tunnelMesh.rotation.x = -Math.PI / 5;
    this.hillGroup.add(tunnelMesh);

    // Bioluminescent glow radiating from the hill entrance
    const burrowLight = new THREE.PointLight(0xfbbf24, 2.5, 12.0, 1.4);
    burrowLight.position.set(0, 1.1, 2.8);
    this.hillGroup.add(burrowLight);

    // Scattered pine needles & tiny pebbles on the mound
    const needleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.65, 5);
    const needleMat = new THREE.MeshStandardMaterial({ color: 0x382310, roughness: 0.92 });
    for (let i = 0; i < 48; i++) {
      const needleMesh = new THREE.Mesh(needleGeo, needleMat);
      const angle = Math.random() * Math.PI * 2;
      const r = 1.2 + Math.random() * 3.2;
      const h = (1 - r / 4.8) * 2.8 + 0.15;
      needleMesh.position.set(Math.cos(angle) * r, h, Math.sin(angle) * r);
      needleMesh.rotation.set(
        (Math.random() - 0.5) * 1.5,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 1.5,
      );
      needleMesh.castShadow = true;
      this.hillGroup.add(needleMesh);
    }

    this.rootGroup.add(this.hillGroup);

    this.disposableGeometries.push(
      moundGeo,
      craterRimGeo,
      craterInnerGeo,
      archGeo,
      tunnelGeo,
      needleGeo,
    );
    this.disposableMaterials.push(
      moundMat,
      craterRimMat,
      craterInnerMat,
      archMat,
      tunnelMat,
      needleMat,
    );
  }

  /**
   * Builds the winding golden Ameisenstraße highways curving outward across the planet.
   */
  private buildPlanetaryAntTrails(): void {
    const trailAngles = [0.0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
    const allParticlePositions: number[] = [];

    const trailMat = new THREE.MeshStandardMaterial({
      color: 0x6e4e2e,
      emissive: 0x45280c,
      emissiveIntensity: 0.25,
      roughness: 0.88,
      transparent: true,
      opacity: 0.85,
    });
    this.disposableMaterials.push(trailMat);

    for (let tIdx = 0; tIdx < trailAngles.length; tIdx++) {
      const baseTheta = trailAngles[tIdx];
      const curvePts: THREE.Vector3[] = [];

      const steps = 24;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const phi = 0.12 + u * 1.15;
        const theta = baseTheta + Math.sin(u * Math.PI * 2.2) * 0.35;
        const surfacePt = AmeisenTerrainFactory.polarToSurfacePoint(phi, theta, 0.04);
        curvePts.push(surfacePt);

        if (tIdx === 0) {
          this.antTrailPoints.push(surfacePt);
        }
      }

      const curve = new THREE.CatmullRomCurve3(curvePts);
      const tubeGeo = new THREE.TubeGeometry(curve, 80, 0.38, 8, false);

      // Flatten tube radially against planet surface
      const posAttr = tubeGeo.attributes['position'];
      const v = new THREE.Vector3();
      for (let i = 0; i < posAttr.count; i++) {
        v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        const surfaceR = AmeisenTerrainFactory.getSurfaceRadiusAtDirection(v.clone().normalize());
        v.normalize().multiplyScalar(surfaceR + 0.03);
        posAttr.setXYZ(i, v.x, v.y, v.z);
      }
      tubeGeo.computeVertexNormals();

      const trailMesh = new THREE.Mesh(tubeGeo, trailMat);
      trailMesh.receiveShadow = true;
      this.rootGroup.add(trailMesh);
      this.disposableGeometries.push(tubeGeo);

      // Pheromone golden particles
      const pCount = 110;
      for (let i = 0; i < pCount; i++) {
        const pt = curve.getPoint(i / pCount);
        const normal = pt.clone().normalize();
        const jitter = new THREE.Vector3(
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 0.7,
        );
        pt.add(jitter)
          .normalize()
          .multiplyScalar(
            AmeisenTerrainFactory.getSurfaceRadiusAtDirection(normal) + 0.18 + Math.random() * 0.22,
          );
        allParticlePositions.push(pt.x, pt.y, pt.z);
      }
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.Float32BufferAttribute(allParticlePositions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0xfde047,
      size: 0.45,
      map: this.glowSpriteTexture,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.pheromonePoints = new THREE.Points(pGeo, pMat);
    this.rootGroup.add(this.pheromonePoints);

    this.disposableGeometries.push(pGeo);
    this.disposableMaterials.push(pMat);
  }

  /**
   * Highlights or builds an active Ameisenstraße ribbon directly connecting
   * the Ant Hill to a targeted fruit!
   */
  setActiveHarvestTrail(targetFruitPos: THREE.Vector3): void {
    if (this.activeHarvestTrailMesh) {
      this.rootGroup.remove(this.activeHarvestTrailMesh);
      this.activeHarvestTrailGeo?.dispose();
    }

    const startPt = this.getAntHillEntrancePosition();
    const endPt = targetFruitPos.clone();

    // Create curved spherical arc waypoints between entrance and fruit
    const arcPts: THREE.Vector3[] = [];
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const interpolated = startPt.clone().lerp(endPt, t).normalize();
      const pt = AmeisenTerrainFactory.getPointOnPlanet(interpolated, 0.05);
      arcPts.push(pt);
    }

    const curve = new THREE.CatmullRomCurve3(arcPts);
    this.activeHarvestTrailGeo = new THREE.TubeGeometry(curve, 36, 0.28, 6, false);

    const trailMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xeab308,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.75,
      roughness: 0.6,
    });

    this.activeHarvestTrailMesh = new THREE.Mesh(this.activeHarvestTrailGeo, trailMat);
    this.rootGroup.add(this.activeHarvestTrailMesh);
  }

  clearActiveHarvestTrail(): void {
    if (this.activeHarvestTrailMesh) {
      this.rootGroup.remove(this.activeHarvestTrailMesh);
      this.activeHarvestTrailGeo?.dispose();
      this.activeHarvestTrailMesh = null;
      this.activeHarvestTrailGeo = null;
    }
  }

  /**
   * Populates the planet with slender, realistically proportioned forest trees (pines & birches)
   * and smooth moss boulders. NOTE: Mushrooms have been completely removed per user request!
   */
  private buildPlanetaryFlora(): void {
    // Slender Tree Trunks
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 3.8, 8);
    trunkGeo.translate(0, 1.9, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x452a16, roughness: 0.9 });

    // Pine Foliage Cones
    const pineCrownGeo1 = new THREE.ConeGeometry(1.6, 2.4, 8);
    pineCrownGeo1.translate(0, 3.4, 0);
    const pineCrownGeo2 = new THREE.ConeGeometry(1.2, 2.0, 8);
    pineCrownGeo2.translate(0, 4.4, 0);
    const pineCrownGeo3 = new THREE.ConeGeometry(0.8, 1.6, 8);
    pineCrownGeo3.translate(0, 5.2, 0);

    const pineMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8 }); // Deep pine green
    const birchFoliageMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 });

    const treeCount = 28;
    for (let i = 0; i < treeCount; i++) {
      const phi = 0.48 + (i / treeCount) * 1.85;
      const theta = i * 2.39996 + (Math.random() - 0.5) * 0.3;

      const treeGroup = new THREE.Group();
      const pos = AmeisenTerrainFactory.polarToSurfacePoint(phi, theta, 0);
      treeGroup.position.copy(pos);
      AmeisenTerrainFactory.orientObjectOnPlanet(treeGroup, pos);

      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      if (i % 2 === 0) {
        // Majestic layered pine tree
        const c1 = new THREE.Mesh(pineCrownGeo1, pineMat);
        const c2 = new THREE.Mesh(pineCrownGeo2, pineMat);
        const c3 = new THREE.Mesh(pineCrownGeo3, pineMat);
        c1.castShadow = true;
        c2.castShadow = true;
        c3.castShadow = true;
        treeGroup.add(c1, c2, c3);
      } else {
        // Slender leafy birch tree
        const crownGeo = new THREE.DodecahedronGeometry(1.4, 1);
        const crown = new THREE.Mesh(crownGeo, birchFoliageMat);
        crown.position.y = 3.8;
        crown.scale.set(1.1, 1.35, 1.1);
        crown.castShadow = true;
        treeGroup.add(crown);
      }

      const s = 0.85 + Math.random() * 0.35;
      treeGroup.scale.set(s, s, s);
      this.rootGroup.add(treeGroup);
    }

    // Moss boulders scattered around planet
    const boulderGeo = new THREE.DodecahedronGeometry(0.8, 1);
    const boulderMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.95 });
    for (let b = 0; b < 24; b++) {
      const phi = 0.38 + Math.random() * 2.0;
      const theta = Math.random() * Math.PI * 2;
      const boulder = new THREE.Mesh(boulderGeo, boulderMat);
      const bPos = AmeisenTerrainFactory.polarToSurfacePoint(phi, theta, 0.2);
      boulder.position.copy(bPos);
      AmeisenTerrainFactory.orientObjectOnPlanet(boulder, bPos);
      boulder.scale.set(1.0, 0.45, 0.8);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      this.rootGroup.add(boulder);
    }

    this.disposableGeometries.push(
      trunkGeo,
      pineCrownGeo1,
      pineCrownGeo2,
      pineCrownGeo3,
      boulderGeo,
    );
    this.disposableMaterials.push(trunkMat, pineMat, birchFoliageMat, boulderMat);
  }

  /**
   * Drifting sun motes and golden fireflies orbiting the planet.
   */
  private buildSunMotesAndFireflies(): void {
    const fireflyCount = 220;
    const positions = new Float32Array(fireflyCount * 3);

    const R = AmeisenTerrainFactory.PLANET_RADIUS;
    for (let i = 0; i < fireflyCount; i++) {
      const r = R + 0.6 + Math.random() * 8.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = 0.2 + Math.random() * 2.6;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }

    const fireflyGeo = new THREE.BufferGeometry();
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const fireflyMat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 0.35,
      map: this.glowSpriteTexture,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.dustPoints = new THREE.Points(fireflyGeo, fireflyMat);
    this.rootGroup.add(this.dustPoints);

    this.disposableGeometries.push(fireflyGeo);
    this.disposableMaterials.push(fireflyMat);
  }

  setHillLevel(level: number): void {
    this.currentHillLevel = Math.max(1, Math.min(3, level));
    this.targetHillScale = 1.0 + (this.currentHillLevel - 1) * 0.22;
  }

  update(nowSeconds: number): void {
    if (this.hillGroup && Math.abs(this.currentHillScale - this.targetHillScale) > 0.005) {
      this.currentHillScale += (this.targetHillScale - this.currentHillScale) * 0.08;
      this.hillGroup.scale.set(this.currentHillScale, this.currentHillScale, this.currentHillScale);
    }

    if (this.dustPoints) {
      this.dustPoints.rotation.y = nowSeconds * 0.025;
      this.dustPoints.rotation.x = Math.sin(nowSeconds * 0.015) * 0.04;
    }

    if (this.starfieldPoints) {
      this.starfieldPoints.rotation.y = nowSeconds * 0.003;
    }
  }

  dispose(): void {
    for (const g of this.disposableGeometries) g.dispose();
    for (const m of this.disposableMaterials) m.dispose();
    for (const t of this.disposableTextures) t.dispose();
    this.disposableGeometries.length = 0;
    this.disposableMaterials.length = 0;
    this.disposableTextures.length = 0;
    this.rootGroup.clear();
  }
}
