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

    // Warm, soothing solar atmospheric limb glow
    const coronaGeo = new THREE.SphereGeometry(this.sunRadius * 1.15, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    sunMesh.add(coronaMesh);

    // Radiant camera-facing solar corona sprite (intense, visible volumetric glow)
    const coronaTex = this.textureFactory.createSolarCoronaTexture();
    const coronaSpriteMat = new THREE.SpriteMaterial({
      map: coronaTex,
      color: 0xfffbeb,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coronaSprite = new THREE.Sprite(coronaSpriteMat);
    coronaSprite.scale.set(this.sunRadius * 4.6, this.sunRadius * 4.6, 1);
    sunMesh.add(coronaSprite);

    // Outer ethereal aura extending into interplanetary space
    const outerAuraMat = new THREE.SpriteMaterial({
      map: coronaTex,
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outerAuraSprite = new THREE.Sprite(outerAuraMat);
    outerAuraSprite.scale.set(this.sunRadius * 9.5, this.sunRadius * 9.5, 1);
    sunMesh.add(outerAuraSprite);

    // Soft, slender expanding solar pulse wavefronts (delicate, transparent, smoothly fading)
    const pulseTex = this.textureFactory.createSolarPulseTexture();
    const solarPulseSprites: THREE.Sprite[] = [];
    const pulseCount = 3;

    for (let p = 0; p < pulseCount; p++) {
      const pulseMat = new THREE.SpriteMaterial({
        map: pulseTex,
        color: 0xfef08a,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pulseSprite = new THREE.Sprite(pulseMat);
      pulseSprite.scale.set(this.sunRadius * 2.2, this.sunRadius * 2.2, 1);
      sunMesh.add(pulseSprite);
      solarPulseSprites.push(pulseSprite);
    }

    const sun: CelestialBody = {
      id: 'celestial-sun',
      type: 'sun',
      name: 'Sol Harmonia',
      mesh: sunMesh,
      glowMesh: coronaMesh,
      coronaSprite,
      solarPulseSprites,
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

    // Guarantee non-intersecting concentric orbit with comfortable distance from the glowing Sun
    const orbitRadius = findNextSafeOrbitRadius(currentRadii, 24.0, 6.8);

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
    let ringsMesh: THREE.Object3D | undefined;

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

    // Shimmering particle ring system for gas giants (dense, white & gray, 100% circular!)
    if (subtype === 'gas-giant') {
      const ringParticleCount = 10000; // Dense, continuous, velvety ring disc
      const ringPositions = new Float32Array(ringParticleCount * 3);
      const ringColors = new Float32Array(ringParticleCount * 3);

      // Authentic white & gray ring particles: ice whites, silver pearls, and mineral grays
      const colWhite = new THREE.Color(0xffffff);
      const colSnow = new THREE.Color(0xf8fafc);
      const colSilver = new THREE.Color(0xf1f5f9);
      const colPearlGray = new THREE.Color(0xe2e8f0);
      const colSlateLight = new THREE.Color(0xcbd5e1);
      const colAshGray = new THREE.Color(0x94a3b8);
      const colDuskGray = new THREE.Color(0x64748b);

      for (let i = 0; i < ringParticleCount; i++) {
        // Polar coordinates guarantee 100% true circular rings without clipping
        const theta = Math.random() * Math.PI * 2;

        // Structured concentric rings: dense Ring B, Cassini division gap, and Ring A
        const isRingB = Math.random() < 0.62;
        let r: number;
        if (isRingB) {
          // Main dense inner ring (Ring B)
          r = radius * (1.42 + Math.random() * 0.52);
        } else {
          // Outer ring (Ring A)
          r = radius * (2.06 + Math.random() * 0.56);
        }

        // Very faint sparse particles in the Cassini gap (1.94 to 2.06)
        if (Math.random() < 0.02) {
          r = radius * (1.94 + Math.random() * 0.12);
        }

        // Slight vertical dispersion for 3D realism
        const h = (Math.random() + Math.random() - 1.0) * (radius * 0.02);

        ringPositions[i * 3] = Math.cos(theta) * r;
        ringPositions[i * 3 + 1] = h;
        ringPositions[i * 3 + 2] = Math.sin(theta) * r;

        // Rich white & gray palette with natural shading
        const colorMix = Math.random();
        const baseCol =
          colorMix < 0.32
            ? colWhite
            : colorMix < 0.58
            ? colSnow
            : colorMix < 0.76
            ? colSilver
            : colorMix < 0.88
            ? colPearlGray
            : colorMix < 0.95
            ? colSlateLight
            : colorMix < 0.98
            ? colAshGray
            : colDuskGray;

        const brightness = 0.60 + Math.random() * 0.40;
        ringColors[i * 3] = baseCol.r * brightness;
        ringColors[i * 3 + 1] = baseCol.g * brightness;
        ringColors[i * 3 + 2] = baseCol.b * brightness;
      }

      const ringGeo = new THREE.BufferGeometry();
      ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
      ringGeo.setAttribute('color', new THREE.BufferAttribute(ringColors, 3));

      const particleTexture = this.textureFactory.getParticleGlowTexture();
      const ringMat = new THREE.PointsMaterial({
        size: 0.09,
        map: particleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const ringsPoints = new THREE.Points(ringGeo, ringMat);
      // Realistic axial tilt relative to orbital plane
      ringsPoints.rotation.x = Math.PI / 2.3;
      mesh.add(ringsPoints);
      ringsMesh = ringsPoints;
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
   * Can be placed freely at customPosition or placed automatically on the next safe orbit.
   */
  spawnBlackHole(customPosition?: THREE.Vector3): CelestialBody {
    this.bodyCounter++;
    const currentRadii = this.bodies
      .filter((b) => b.type === 'planet')
      .map((b) => b.orbitRadius ?? Math.hypot(b.position.x, b.position.z));

    let posX: number;
    let posZ: number;

    if (customPosition) {
      posX = customPosition.x;
      posZ = customPosition.z;
    } else {
      const orbitRadius = findNextSafeOrbitRadius(currentRadii, 32.0, 7.5);
      const angle = Math.random() * Math.PI * 2;
      posX = Math.cos(angle) * orbitRadius;
      posZ = Math.sin(angle) * orbitRadius;
    }

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

    mesh.position.set(posX, 0, posZ);

    this.sceneGroup.add(mesh);

    // Stationary black hole firmly fixed at placement location without orbit track
    const blackHole: CelestialBody = {
      id: `blackhole-${this.bodyCounter}`,
      type: 'black-hole',
      name: `Singularität Zeno-X${this.bodyCounter}`,
      mesh,
      glowMesh: diskMesh,
      mass,
      radius,
      position: new THREE.Vector3(posX, 0, posZ),
      velocity: new THREE.Vector3(0, 0, 0),
      color: new THREE.Color(0xf59e0b),
      rotationSpeed: 0.003, // Serene, gentle accretion spin
      orbitTrackId: '',
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
  update(dt: number, onCollision?: (pos: THREE.Vector3, isBlackHole: boolean, bothBlackHoles?: boolean) => void): void {
    const hasBlackHole = this.bodies.some((b) => b.type === 'black-hole');

    // Case 1: Peaceful state without Black Holes.
    // Planets do NOT perturb each other with gravity. They follow pure, stable Keplerian circular orbits.
    if (!hasBlackHole) {
      for (const b of this.bodies) {
        if (b.type === 'sun') {
          b.mesh.rotation.y += b.rotationSpeed;
          if (b.coronaSprite) {
            const pulse = 1.0 + Math.sin(performance.now() * 0.0018) * 0.035;
            b.coronaSprite.scale.set(b.radius * 4.6 * pulse, b.radius * 4.6 * pulse, 1);
          }
          if (b.solarPulseSprites) {
            const nowTime = performance.now() / 1000;
            const cycleDuration = 3.6;
            const baseScale = b.radius * 2.2;
            const maxScale = b.radius * 5.4;

            for (let p = 0; p < b.solarPulseSprites.length; p++) {
              const sprite = b.solarPulseSprites[p];
              const phaseOffset = (p / b.solarPulseSprites.length) * cycleDuration;
              const progress = ((nowTime + phaseOffset) % cycleDuration) / cycleDuration;

              const scale = baseScale + progress * (maxScale - baseScale);
              sprite.scale.set(scale, scale, 1);

              // Slender, gentle transparent pulse that softly fades into space
              const opacity = 0.22 * Math.sin(progress * Math.PI) * (1.0 - progress * 0.45);
              sprite.material.opacity = Math.max(0, opacity);
            }
          }
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

    // Case 2: One or more Black Holes have formed!
    // - Black Holes pull all planets with immense gravity.
    // - If multiple Black Holes exist, they also attract each other with mutual gravitation.
    // - The central Sun stays firmly anchored at (0, 0, 0).
    const n = this.bodies.length;
    const accelerations: THREE.Vector3[] = Array.from({ length: n }, () => new THREE.Vector3());

    for (let i = 0; i < n; i++) {
      const b1 = this.bodies[i];
      if (b1.type === 'sun') continue; // Sol Harmonia stays firmly anchored at (0, 0, 0)

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const b2 = this.bodies[j];

        // 1. Planets do NOT attract each other (keeps solar system stable until perturbed by black holes):
        if (b1.type === 'planet' && b2.type === 'planet') {
          continue;
        }

        // 2. Black holes are ONLY attracted by other black holes (not by the sun or planets):
        if (b1.type === 'black-hole' && b2.type !== 'black-hole') {
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
        if (b.coronaSprite) {
          const pulse = 1.0 + Math.sin(performance.now() * 0.0018) * 0.035;
          b.coronaSprite.scale.set(b.radius * 4.6 * pulse, b.radius * 4.6 * pulse, 1);
        }
        if (b.solarPulseSprites) {
          const nowTime = performance.now() / 1000;
          const cycleDuration = 3.6;
          const baseScale = b.radius * 2.2;
          const maxScale = b.radius * 5.4;

          for (let p = 0; p < b.solarPulseSprites.length; p++) {
            const sprite = b.solarPulseSprites[p];
            const phaseOffset = (p / b.solarPulseSprites.length) * cycleDuration;
            const progress = ((nowTime + phaseOffset) % cycleDuration) / cycleDuration;

            const scale = baseScale + progress * (maxScale - baseScale);
            sprite.scale.set(scale, scale, 1);

            const opacity = 0.22 * Math.sin(progress * Math.PI) * (1.0 - progress * 0.45);
            sprite.material.opacity = Math.max(0, opacity);
          }
        }
        continue;
      }

      b.velocity.addScaledVector(accelerations[i], dt);
      b.position.addScaledVector(b.velocity, dt);
      b.position.y = 0;
      b.velocity.y = 0;

      b.mesh.position.copy(b.position);
      b.mesh.rotation.y += b.rotationSpeed;

      if (b.type === 'black-hole') {
        if (b.glowMesh) {
          b.glowMesh.rotation.z += b.rotationSpeed;
        }
      } else {
        if (b.cloudsMesh) {
          b.cloudsMesh.rotation.y += b.rotationSpeed * 0.35;
        }

        if (b.orbitTrackId) {
          const currentDist = Math.hypot(b.position.x, b.position.z);
          this.harpSystem.updateOrbitRadius(b.orbitTrackId, currentDist);
          b.orbitRadius = currentDist;
          b.orbitalAngle = Math.atan2(b.position.z, b.position.x);
        }
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
          const bothBlackHoles = b1.type === 'black-hole' && b2.type === 'black-hole';

          this.spawnShockwave(
            collisionPos,
            bothBlackHoles ? new THREE.Color(0xfbbf24) : hasBlackHole ? new THREE.Color(0xf59e0b) : new THREE.Color(0x38bdf8)
          );
          this.spawnStardustBurst(collisionPos, bothBlackHoles ? 100 : 50);

          if (onCollision) {
            onCollision(collisionPos, hasBlackHole, bothBlackHoles);
          }

          if (b1.type === 'sun') {
            toRemoveIndices.add(j);
          } else if (b2.type === 'sun') {
            toRemoveIndices.add(i);
          } else if (bothBlackHoles) {
            // Two black holes merge into a larger, more massive singularity with higher attraction!
            const [survivor, absorbed, removeIdx] = b1.mass >= b2.mass ? [b1, b2, j] : [b2, b1, i];
            const totalMass = survivor.mass + absorbed.mass;
            survivor.mass = totalMass;

            // Weighted midpoint position and settled stationary state
            survivor.position.lerp(absorbed.position, absorbed.mass / totalMass);
            survivor.position.y = 0;
            survivor.velocity.set(0, 0, 0);
            survivor.mesh.position.copy(survivor.position);

            // Visibly grow the black hole: event horizon, photon ring and accretion disk expand
            survivor.radius = Math.pow(Math.pow(survivor.radius, 2.5) + Math.pow(absorbed.radius, 2.5), 1 / 2.5);
            survivor.mesh.scale.setScalar(survivor.radius / 1.8);

            toRemoveIndices.add(removeIdx);
          } else if (b1.type === 'black-hole') {
            b1.mass += b2.mass;
            b1.radius = Math.min(b1.radius * 1.05, Math.cbrt(Math.pow(b1.radius, 3) + Math.pow(b2.radius, 3)));
            b1.mesh.scale.setScalar(b1.radius / 1.8);
            toRemoveIndices.add(j);
          } else if (b2.type === 'black-hole') {
            b2.mass += b1.mass;
            b2.radius = Math.min(b2.radius * 1.05, Math.cbrt(Math.pow(b2.radius, 3) + Math.pow(b1.radius, 3)));
            b2.mesh.scale.setScalar(b2.radius / 1.8);
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
