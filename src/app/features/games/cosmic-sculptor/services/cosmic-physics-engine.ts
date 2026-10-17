import * as THREE from 'three';
import {
  CelestialBody,
  PlanetSubtype,
  CollisionShockwave,
  StardustBurst,
} from '../models/cosmic-sculptor.types';
import {
  G_CONST,
  GRAVITATIONAL_SOFTENING,
  computeCircularOrbitVelocity,
  findNextSafeOrbitRadius,
  generateRealisticPlanetName,
} from '../utils/cosmic-math';
import { CelestialTextureFactory } from './celestial-texture-factory';
import { OrbitHarpSystem } from './orbit-harp-system';

/**
 * Handles N-body celestial gravitational physics, non-intersecting initial orbital insertion,
 * harmonious planet mesh instantiation, collision shockwaves, and black hole mechanics.
 */
export class CosmicPhysicsEngine {
  private readonly sceneGroup = new THREE.Group();
  private readonly shockwaveGroup = new THREE.Group();
  private readonly particlesGroup = new THREE.Group();

  private bodies: CelestialBody[] = [];
  private shockwaves: CollisionShockwave[] = [];
  private bursts: StardustBurst[] = [];

  private bodyCounter = 0;
  private collisionCounter = 0;

  readonly sunMass = 1000.0;
  readonly sunRadius = 3.6;

  constructor(
    private readonly textureFactory: CelestialTextureFactory,
    private readonly harpSystem: OrbitHarpSystem
  ) {
    this.sceneGroup.name = 'CosmicPhysicsSceneGroup';
    this.sceneGroup.add(this.shockwaveGroup);
    this.sceneGroup.add(this.particlesGroup);
  }

  getGroup(): THREE.Group {
    return this.sceneGroup;
  }

  getBodies(): CelestialBody[] {
    return this.bodies;
  }

  getCollisionCount(): number {
    return this.collisionCounter;
  }

  getPlanetCount(): number {
    return this.bodies.filter((b) => b.type === 'planet').length;
  }

  getBlackHoleCount(): number {
    return this.bodies.filter((b) => b.type === 'black-hole').length;
  }

  /**
   * Initializes the central Sun with a warm golden nectar texture and soft radiant corona.
   */
  initSun(): CelestialBody {
    const sunGeo = new THREE.SphereGeometry(this.sunRadius, 48, 48);
    const sunTex = this.textureFactory.createSunTexture();
    const sunMat = new THREE.MeshBasicMaterial({
      map: sunTex,
      color: 0xffffff,
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);

    // Warm, soothing solar corona glow
    const coronaGeo = new THREE.SphereGeometry(this.sunRadius * 1.35, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    sunMesh.add(coronaMesh);

    // Outer ethereal aura
    const outerCoronaGeo = new THREE.SphereGeometry(this.sunRadius * 1.75, 32, 32);
    const outerCoronaMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const outerCoronaMesh = new THREE.Mesh(outerCoronaGeo, outerCoronaMat);
    sunMesh.add(outerCoronaMesh);

    const sun: CelestialBody = {
      id: 'celestial-sun',
      type: 'sun',
      name: 'Sol Harmonia',
      mesh: sunMesh,
      glowMesh: coronaMesh,
      mass: this.sunMass,
      radius: this.sunRadius,
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      color: new THREE.Color(0xf59e0b),
      rotationSpeed: 0.0004,
      orbitTrackId: '',
    };

    this.sceneGroup.add(sunMesh);
    this.bodies.push(sun);
    return sun;
  }

  /**
   * Spawns an aesthetic, beautifully colored planet on a brand new, non-intersecting concentric orbit.
   *
   * @param specificSubtype Optional subtype (e.g. terrestrial, gas-giant, etc.).
   * @returns Newly spawned CelestialBody.
   */
  spawnPlanet(specificSubtype?: PlanetSubtype): CelestialBody {
    this.bodyCounter++;
    const currentRadii = this.bodies
      .filter((b) => b.type !== 'sun')
      .map((b) => Math.hypot(b.position.x, b.position.z));

    // Guarantee non-intersecting concentric orbit
    const orbitRadius = findNextSafeOrbitRadius(currentRadii, 11.5, 5.5);

    const subtypes: PlanetSubtype[] = ['terrestrial', 'gas-giant', 'ice-giant', 'desert', 'volcanic'];
    const subtype = specificSubtype ?? subtypes[this.bodyCounter % subtypes.length];
    const name = generateRealisticPlanetName(subtype, this.bodyCounter);

    // Harmonious colors and comfortable dimensions
    let radius = 1.0;
    let mass = 1.8;
    let dominantColor = new THREE.Color(0x38bdf8);

    if (subtype === 'gas-giant') {
      radius = 1.6 + Math.random() * 0.3;
      mass = 3.6 + Math.random() * 0.8;
      dominantColor = new THREE.Color(0xf59e0b); // Warm Amber
    } else if (subtype === 'ice-giant') {
      radius = 1.3 + Math.random() * 0.2;
      mass = 2.4 + Math.random() * 0.5;
      dominantColor = new THREE.Color(0x38bdf8); // Sky Cyan
    } else if (subtype === 'desert') {
      radius = 0.9 + Math.random() * 0.15;
      mass = 1.3 + Math.random() * 0.3;
      dominantColor = new THREE.Color(0xfb923c); // Warm Apricot
    } else if (subtype === 'volcanic') {
      radius = 0.95 + Math.random() * 0.2;
      mass = 1.5 + Math.random() * 0.3;
      dominantColor = new THREE.Color(0x818cf8); // Twilight Lavender
    } else {
      // terrestrial
      radius = 1.1 + Math.random() * 0.15;
      mass = 1.9 + Math.random() * 0.3;
      dominantColor = new THREE.Color(0x10b981); // Emerald / Azure
    }

    // Velvety smooth material with soft inner luminance (non-plastic, relaxing!)
    const geo = new THREE.SphereGeometry(radius, 40, 40);
    const texture = this.textureFactory.getPlanetTexture(subtype, this.bodyCounter);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.35,
      metalness: 0.0,
      emissive: dominantColor,
      emissiveIntensity: 0.14,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // Ethereal atmospheric glow envelope
    const atmosphereGeo = new THREE.SphereGeometry(radius * 1.08, 32, 32);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: dominantColor,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    mesh.add(atmosphereMesh);

    let cloudsMesh: THREE.Mesh | undefined;
    let ringsMesh: THREE.Mesh | undefined;

    // Atmospheric cloud layer for terrestrial planets
    if (subtype === 'terrestrial') {
      const cloudGeo = new THREE.SphereGeometry(radius * 1.025, 36, 36);
      const cloudTex = this.textureFactory.createTerrestrialCloudsTexture();
      const cloudMat = new THREE.MeshStandardMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.NormalBlending,
        roughness: 0.4,
      });
      cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
      mesh.add(cloudsMesh);
    }

    // Translucent golden rings for gas giants
    if (subtype === 'gas-giant') {
      const ringGeo = new THREE.RingGeometry(radius * 1.45, radius * 2.6, 64);
      const ringTex = this.textureFactory.createSaturnRingTexture();
      const ringMat = new THREE.MeshStandardMaterial({
        map: ringTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
        roughness: 0.3,
      });
      ringsMesh = new THREE.Mesh(ringGeo, ringMat);
      ringsMesh.rotation.x = Math.PI / 2.3;
      mesh.add(ringsMesh);
    }

    // Initial Keplerian orbital insertion (non-intersecting concentric orbit)
    const angle = Math.random() * Math.PI * 2;
    const posX = Math.cos(angle) * orbitRadius;
    const posZ = Math.sin(angle) * orbitRadius;
    const posY = 0;

    mesh.position.set(posX, posY, posZ);

    // Calm, meditative orbital velocity: v = sqrt(G * M / r)
    const speed = computeCircularOrbitVelocity(this.sunMass, orbitRadius);
    const velX = -Math.sin(angle) * speed;
    const velZ = Math.cos(angle) * speed;
    const velY = 0; // Pure planar ecliptic orbit matching harp track

    this.sceneGroup.add(mesh);

    // Register resonant harp string orbit track
    const trackId = `track-${Date.now()}-${this.bodyCounter}`;
    const noteIndex = Math.min(9, Math.floor((orbitRadius / 45.0) * 10));
    this.harpSystem.createOrbitTrack(trackId, `planet-${this.bodyCounter}`, orbitRadius, dominantColor, noteIndex);

    const planet: CelestialBody = {
      id: `planet-${this.bodyCounter}`,
      type: 'planet',
      name,
      subtype,
      mesh,
      cloudsMesh,
      ringsMesh,
      mass,
      radius,
      position: new THREE.Vector3(posX, posY, posZ),
      velocity: new THREE.Vector3(velX, velY, velZ),
      color: dominantColor,
      rotationSpeed: 0.0006 + Math.random() * 0.0008, // Calm, gentle, meditative rotation!
      orbitTrackId: trackId,
      orbitRadius,
      orbitalAngle: angle,
    };

    this.bodies.push(planet);
    return planet;
  }

  /**
   * Spawns a mystical Black Hole with an event horizon and calming amber-violet accretion disk.
   */
  spawnBlackHole(): CelestialBody {
    this.bodyCounter++;
    const currentRadii = this.bodies
      .filter((b) => b.type !== 'sun')
      .map((b) => Math.hypot(b.position.x, b.position.z));

    const orbitRadius = findNextSafeOrbitRadius(currentRadii, 16.0, 6.5);
    const radius = 1.8;
    const mass = 1200.0; // High gravitational attraction

    // Event Horizon: Deep obsidian sphere
    const horizonGeo = new THREE.SphereGeometry(radius, 40, 40);
    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0x02040a,
    });
    const mesh = new THREE.Mesh(horizonGeo, horizonMat);

    // Photon Sphere: Luminous diamond halo
    const photonGeo = new THREE.RingGeometry(radius * 1.02, radius * 1.15, 48);
    const photonMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const photonRing = new THREE.Mesh(photonGeo, photonMat);
    photonRing.rotation.x = Math.PI / 2;
    mesh.add(photonRing);

    // Smooth Amber-Violet Accretion Disk
    const diskGeo = new THREE.RingGeometry(radius * 1.25, radius * 3.6, 64);
    const diskTex = this.textureFactory.createAccretionDiskTexture();
    const diskMat = new THREE.MeshBasicMaterial({
      map: diskTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
    });
    const diskMesh = new THREE.Mesh(diskGeo, diskMat);
    diskMesh.rotation.x = Math.PI / 2.2;
    mesh.add(diskMesh);

    const angle = Math.random() * Math.PI * 2;
    const posX = Math.cos(angle) * orbitRadius;
    const posZ = Math.sin(angle) * orbitRadius;
    mesh.position.set(posX, 0, posZ);

    const speed = computeCircularOrbitVelocity(this.sunMass, orbitRadius);
    const velX = -Math.sin(angle) * speed;
    const velZ = Math.cos(angle) * speed;

    this.sceneGroup.add(mesh);

    const trackId = `track-bh-${Date.now()}-${this.bodyCounter}`;
    this.harpSystem.createOrbitTrack(
      trackId,
      `blackhole-${this.bodyCounter}`,
      orbitRadius,
      new THREE.Color(0xf59e0b),
      1
    );

    const blackHole: CelestialBody = {
      id: `blackhole-${this.bodyCounter}`,
      type: 'black-hole',
      name: `Singularität Zeno-X${this.bodyCounter}`,
      mesh,
      glowMesh: diskMesh,
      mass,
      radius,
      position: new THREE.Vector3(posX, 0, posZ),
      velocity: new THREE.Vector3(velX, 0, velZ),
      color: new THREE.Color(0xf59e0b),
      rotationSpeed: 0.003, // Serene, gentle accretion spin
      orbitTrackId: trackId,
    };

    this.bodies.push(blackHole);
    return blackHole;
  }

  /**
   * Advances the simulation using N-body gravitational integration and resolves physical collisions.
   *
   * @param dt Delta time in seconds.
   * @param onCollision Callback triggered when two celestial bodies collide or merge.
   */
  update(dt: number, onCollision?: (pos: THREE.Vector3, isBlackHole: boolean) => void): void {
    const hasBlackHole = this.bodies.some((b) => b.type === 'black-hole');

    // Case 1: Peaceful state without Black Holes.
    // Planets do NOT perturb each other with gravity. They follow pure, stable Keplerian circular orbits.
    if (!hasBlackHole) {
      for (const b of this.bodies) {
        if (b.type === 'sun') {
          b.mesh.rotation.y += b.rotationSpeed;
          continue;
        }

        if (b.orbitRadius === undefined) {
          b.orbitRadius = Math.hypot(b.position.x, b.position.z);
          b.orbitalAngle = Math.atan2(b.position.z, b.position.x);
        }

        const speed = computeCircularOrbitVelocity(this.sunMass, b.orbitRadius);
        const omega = speed / b.orbitRadius;
        b.orbitalAngle = ((b.orbitalAngle ?? 0) + omega * dt) % (Math.PI * 2);

        b.position.x = Math.cos(b.orbitalAngle) * b.orbitRadius;
        b.position.y = 0;
        b.position.z = Math.sin(b.orbitalAngle) * b.orbitRadius;
        b.velocity.x = -Math.sin(b.orbitalAngle) * speed;
        b.velocity.y = 0;
        b.velocity.z = Math.cos(b.orbitalAngle) * speed;

        b.mesh.position.copy(b.position);
        b.mesh.rotation.y += b.rotationSpeed;

        if (b.cloudsMesh) {
          b.cloudsMesh.rotation.y += b.rotationSpeed * 0.35;
        }

        if (b.orbitTrackId) {
          this.harpSystem.updateOrbitRadius(b.orbitTrackId, b.orbitRadius);
        }
      }

      this.updateShockwaves(dt);
      this.updateStardustBursts(dt);
      return;
    }

    // Case 2: A Black Hole has formed!
    // The Black Hole's immense gravitation curves space-time and pulls the planets.
    // Crucial Rule: Planets NEVER attract each other with gravity! Only the Black Hole (and the central Sun) pull them.
    const n = this.bodies.length;
    const accelerations: THREE.Vector3[] = Array.from({ length: n }, () => new THREE.Vector3());

    for (let i = 0; i < n; i++) {
      const b1 = this.bodies[i];
      if (b1.type === 'sun') continue; // Sol Harmonia is the fixed central star at (0, 0, 0)

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const b2 = this.bodies[j];

        // 1. Planets do NOT attract each other:
        if (b1.type === 'planet' && b2.type === 'planet') {
          continue;
        }

        // 2. Planets have negligible mass and do not pull the Black Hole:
        if (b1.type === 'black-hole' && b2.type === 'planet') {
          continue;
        }

        const delta = new THREE.Vector3().subVectors(b2.position, b1.position);
        const distSq = delta.lengthSq() + (GRAVITATIONAL_SOFTENING * GRAVITATIONAL_SOFTENING);
        const forceMagnitude = (G_CONST * b2.mass) / distSq;
        const forceDir = delta.normalize();

        accelerations[i].addScaledVector(forceDir, forceMagnitude);
      }
    }

    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      if (b.type === 'sun') {
        b.position.set(0, 0, 0);
        b.velocity.set(0, 0, 0);
        b.mesh.position.set(0, 0, 0);
        b.mesh.rotation.y += b.rotationSpeed;
        continue;
      }

      b.velocity.addScaledVector(accelerations[i], dt);
      b.position.addScaledVector(b.velocity, dt);
      b.position.y = 0;
      b.velocity.y = 0;

      b.mesh.position.copy(b.position);
      b.mesh.rotation.y += b.rotationSpeed;

      if (b.cloudsMesh) {
        b.cloudsMesh.rotation.y += b.rotationSpeed * 0.35;
      }

      if (b.type === 'black-hole' && b.glowMesh) {
        b.glowMesh.rotation.z += b.rotationSpeed;
      }

      if (b.orbitTrackId) {
        const currentDist = Math.hypot(b.position.x, b.position.z);
        this.harpSystem.updateOrbitRadius(b.orbitTrackId, currentDist);
        b.orbitRadius = currentDist;
        b.orbitalAngle = Math.atan2(b.position.z, b.position.x);
      }
    }

    const toRemoveIndices = new Set<number>();

    for (let i = 0; i < n; i++) {
      if (toRemoveIndices.has(i)) continue;
      const b1 = this.bodies[i];

      for (let j = i + 1; j < n; j++) {
        if (toRemoveIndices.has(j)) continue;
        const b2 = this.bodies[j];

        const dist = b1.position.distanceTo(b2.position);
        const collisionThreshold = b1.radius + b2.radius;

        if (dist <= collisionThreshold) {
          this.collisionCounter++;
          const collisionPos = new THREE.Vector3().addVectors(b1.position, b2.position).multiplyScalar(0.5);
          const hasBlackHole = b1.type === 'black-hole' || b2.type === 'black-hole';

          this.spawnShockwave(collisionPos, hasBlackHole ? new THREE.Color(0xf59e0b) : new THREE.Color(0x38bdf8));
          this.spawnStardustBurst(collisionPos, 50);

          if (onCollision) {
            onCollision(collisionPos, hasBlackHole);
          }

          if (b1.type === 'sun') {
            toRemoveIndices.add(j);
          } else if (b2.type === 'sun') {
            toRemoveIndices.add(i);
          } else if (b1.type === 'black-hole') {
            b1.mass += b2.mass;
            toRemoveIndices.add(j);
          } else if (b2.type === 'black-hole') {
            b2.mass += b1.mass;
            toRemoveIndices.add(i);
          } else {
            const [survivor, absorbed, removeIdx] = b1.mass >= b2.mass ? [b1, b2, j] : [b2, b1, i];
            const totalMass = survivor.mass + absorbed.mass;
            survivor.velocity
              .multiplyScalar(survivor.mass)
              .add(absorbed.velocity.clone().multiplyScalar(absorbed.mass))
              .divideScalar(totalMass);
            survivor.mass = totalMass;
            survivor.radius = Math.min(2.6, Math.cbrt(Math.pow(survivor.radius, 3) + Math.pow(absorbed.radius, 3)));
            survivor.mesh.scale.setScalar(survivor.radius);
            toRemoveIndices.add(removeIdx);
          }
        }
      }
    }

    if (toRemoveIndices.size > 0) {
      const remaining: CelestialBody[] = [];
      for (let i = 0; i < this.bodies.length; i++) {
        const body = this.bodies[i];
        if (toRemoveIndices.has(i)) {
          this.sceneGroup.remove(body.mesh);
          body.mesh.geometry.dispose();
          if (body.orbitTrackId) {
            this.harpSystem.removeTrack(body.orbitTrackId);
          }
        } else {
          remaining.push(body);
        }
      }
      this.bodies = remaining;
    }

    this.updateShockwaves(dt);
    this.updateStardustBursts(dt);
  }

  private spawnShockwave(pos: THREE.Vector3, color: THREE.Color): void {
    const geo = new THREE.RingGeometry(0.2, 0.7, 36);
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.rotation.x = Math.PI / 2;
    this.shockwaveGroup.add(mesh);

    this.shockwaves.push({
      mesh,
      position: pos.clone(),
      startTime: performance.now() / 1000,
      duration: 1.4,
      maxRadius: 8.5,
      color,
    });
  }

  private spawnStardustBurst(pos: THREE.Vector3, count = 50): void {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      const phi = Math.random() * Math.PI * 2;
      const theta = Math.acos(Math.random() * 2 - 1);
      const speed = 1.8 + Math.random() * 4.5;

      velocities[i * 3] = Math.sin(theta) * Math.cos(phi) * speed;
      velocities[i * 3 + 1] = Math.sin(theta) * Math.sin(phi) * speed;
      velocities[i * 3 + 2] = Math.cos(theta) * speed;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.22,
      map: this.textureFactory.getParticleGlowTexture(),
      color: 0xfde68a,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.particlesGroup.add(points);

    this.bursts.push({
      points,
      velocities,
      birthTime: performance.now() / 1000,
      lifetime: 1.6,
    });
  }

  private updateShockwaves(dt: number): void {
    const now = performance.now() / 1000;
    this.shockwaves = this.shockwaves.filter((sw) => {
      const elapsed = now - sw.startTime;
      if (elapsed >= sw.duration) {
        this.shockwaveGroup.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        (sw.mesh.material as THREE.Material).dispose();
        return false;
      }

      const progress = elapsed / sw.duration;
      const currentScale = 1.0 + progress * sw.maxRadius;
      sw.mesh.scale.set(currentScale, currentScale, currentScale);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1.0 - progress);
      return true;
    });
  }

  private updateStardustBursts(dt: number): void {
    const now = performance.now() / 1000;
    this.bursts = this.bursts.filter((burst) => {
      const elapsed = now - burst.birthTime;
      if (elapsed >= burst.lifetime) {
        this.particlesGroup.remove(burst.points);
        burst.points.geometry.dispose();
        (burst.points.material as THREE.Material).dispose();
        return false;
      }

      const progress = elapsed / burst.lifetime;
      const posAttr = burst.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const count = posAttr.count;

      for (let i = 0; i < count; i++) {
        posAttr.setXYZ(
          i,
          posAttr.getX(i) + burst.velocities[i * 3] * dt,
          posAttr.getY(i) + burst.velocities[i * 3 + 1] * dt,
          posAttr.getZ(i) + burst.velocities[i * 3 + 2] * dt
        );
      }
      posAttr.needsUpdate = true;
      (burst.points.material as THREE.PointsMaterial).opacity = 0.95 * (1.0 - progress);
      return true;
    });
  }

  resetSystem(): void {
    for (const body of this.bodies) {
      this.sceneGroup.remove(body.mesh);
      body.mesh.geometry.dispose();
    }
    this.bodies = [];
    this.bodyCounter = 0;
    this.collisionCounter = 0;

    this.harpSystem.clear();

    this.initSun();
    this.spawnPlanet('terrestrial');
    this.spawnPlanet('gas-giant');
    this.spawnPlanet('ice-giant');
  }

  dispose(): void {
    for (const body of this.bodies) {
      this.sceneGroup.remove(body.mesh);
      body.mesh.geometry.dispose();
    }
    this.bodies = [];
    this.harpSystem.clear();
  }
}
