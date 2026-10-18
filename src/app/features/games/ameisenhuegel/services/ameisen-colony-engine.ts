import * as THREE from 'three';
import { AntData, AntRole } from '../models/ameisen.model';
import { FruitItem } from '../models/fruit.model';
import { EnemyItem } from '../models/enemy.model';
import { AmeisenFruitFactory } from './ameisen-fruit-factory';
import { AmeisenEnemyFactory } from './ameisen-enemy-factory';
import { AmeisenTerrainFactory } from './ameisen-terrain-factory';

/**
 * High-performance Spherical Ant Colony Simulation Engine.
 * Features Three.js InstancedMesh rendering for 60 FPS performance with hundreds of ants
 * crawling seamlessly around the 3D spherical planet.
 * Ants march in an orderly single-file Ameisenstraße (two-way column with outward and return lanes)
 * when harvesting fruits, rather than a disorganized swarm.
 */
export class AmeisenColonyEngine {
  private readonly rootGroup = new THREE.Group();
  private readonly ants: AntData[] = [];
  private readonly maxAntCapacity = 350;

  // Instanced Rendering
  private instancedBodyMesh!: THREE.InstancedMesh;
  private readonly dummyTransform = new THREE.Object3D();

  // Carried Crumb Meshes Container
  private readonly carriedCrumbsGroup = new THREE.Group();

  // Ant Hill Entrance coordinates
  private readonly hillEntrance: THREE.Vector3;

  // Colony Progress Signals / Counters
  private foodDeliveredCount = 0;
  private defeatedEnemiesCount = 0;
  private hillLevel = 1;

  constructor(
    private readonly fruitFactory: AmeisenFruitFactory,
    private readonly enemyFactory: AmeisenEnemyFactory,
    private readonly terrainFactory?: AmeisenTerrainFactory,
  ) {
    this.hillEntrance =
      this.terrainFactory?.getAntHillEntrancePosition() ??
      AmeisenTerrainFactory.polarToSurfacePoint(0.12, 0, 0.22);

    this.rootGroup.add(this.carriedCrumbsGroup);
    this.initInstancedAntMesh();
    this.initStarterColony(20);
  }

  getGroup(): THREE.Group {
    return this.rootGroup;
  }

  getAntCount(): number {
    return this.ants.length;
  }

  getFoodStock(): number {
    return this.foodDeliveredCount;
  }

  getDefeatedEnemies(): number {
    return this.defeatedEnemiesCount;
  }

  getHillLevel(): number {
    return this.hillLevel;
  }

  /**
   * Builds detailed unified ant anatomy geometry (head, antennae, mandibles, thorax,
   * 6 jointed legs, and bulbous abdomen) aligned along the +Z forward axis.
   */
  private initInstancedAntMesh(): void {
    const antGeometries: THREE.BufferGeometry[] = [];

    // 1. Bulbous Abdomen (gaster) at back (-Z)
    const abdomenGeo = new THREE.SphereGeometry(0.17, 10, 10);
    abdomenGeo.scale(0.92, 0.92, 1.35);
    abdomenGeo.translate(0, 0.12, -0.26);
    antGeometries.push(abdomenGeo);

    // 2. Narrow Thorax (mesosoma) in center
    const thoraxGeo = new THREE.SphereGeometry(0.11, 8, 8);
    thoraxGeo.scale(0.75, 0.75, 1.3);
    thoraxGeo.translate(0, 0.1, 0.03);
    antGeometries.push(thoraxGeo);

    // 3. Head with mandibles at front (+Z)
    const headGeo = new THREE.SphereGeometry(0.13, 9, 9);
    headGeo.scale(0.95, 0.85, 1.05);
    headGeo.translate(0, 0.14, 0.25);
    antGeometries.push(headGeo);

    // 4. Two feeler antennae
    for (const side of [-1, 1]) {
      const antGeo = new THREE.CylinderGeometry(0.012, 0.018, 0.22, 4);
      antGeo.rotateX(Math.PI / 3.2);
      antGeo.rotateY(side * 0.35);
      antGeo.translate(side * 0.08, 0.22, 0.36);
      antGeometries.push(antGeo);
    }

    // 5. Six sturdy ant legs
    for (let l = 0; l < 6; l++) {
      const side = l % 2 === 0 ? 1 : -1;
      const row = Math.floor(l / 2) - 1;
      const legGeo = new THREE.CylinderGeometry(0.018, 0.012, 0.26, 4);
      legGeo.rotateZ(side * 0.88);
      legGeo.translate(side * 0.16, 0.05, row * 0.12 + 0.02);
      antGeometries.push(legGeo);
    }

    // Merge all parts into single high-throughput BufferGeometry
    let totalVertices = 0;
    for (const g of antGeometries) {
      totalVertices += g.attributes['position'].count;
    }

    const posArray = new Float32Array(totalVertices * 3);
    const normArray = new Float32Array(totalVertices * 3);

    let offset = 0;
    for (const g of antGeometries) {
      const pos = g.attributes['position'];
      const norm = g.attributes['normal'];
      for (let i = 0; i < pos.count; i++) {
        posArray[(offset + i) * 3] = pos.getX(i);
        posArray[(offset + i) * 3 + 1] = pos.getY(i);
        posArray[(offset + i) * 3 + 2] = pos.getZ(i);

        if (norm) {
          normArray[(offset + i) * 3] = norm.getX(i);
          normArray[(offset + i) * 3 + 1] = norm.getY(i);
          normArray[(offset + i) * 3 + 2] = norm.getZ(i);
        }
      }
      offset += pos.count;
      g.dispose();
    }

    const mergedAntGeo = new THREE.BufferGeometry();
    mergedAntGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    mergedAntGeo.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));

    const antMaterial = new THREE.MeshStandardMaterial({
      color: 0x221307,
      roughness: 0.3,
      metalness: 0.2,
    });

    this.instancedBodyMesh = new THREE.InstancedMesh(
      mergedAntGeo,
      antMaterial,
      this.maxAntCapacity,
    );
    this.instancedBodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedBodyMesh.castShadow = true;
    this.instancedBodyMesh.receiveShadow = true;

    for (let i = 0; i < this.maxAntCapacity; i++) {
      this.dummyTransform.position.set(0, -999, 0);
      this.dummyTransform.scale.set(0, 0, 0);
      this.dummyTransform.updateMatrix();
      this.instancedBodyMesh.setMatrixAt(i, this.dummyTransform.matrix);
    }
    this.instancedBodyMesh.instanceMatrix.needsUpdate = true;

    this.rootGroup.add(this.instancedBodyMesh);
  }

  private initStarterColony(count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnAnt(i < count - 4 ? 'worker' : 'soldier');
    }
  }

  /**
   * Spawns a new ant emerging from the central ant hill entrance.
   */
  spawnAnt(role: AntRole = 'worker'): AntData | null {
    if (this.ants.length >= this.maxAntCapacity) return null;

    const id = this.ants.length;
    const patrolAngle = Math.random() * Math.PI * 2;
    const patrolPhi = 0.18 + Math.random() * 0.32;
    const spawnPos = AmeisenTerrainFactory.polarToSurfacePoint(patrolPhi, patrolAngle, 0.12);

    const ant: AntData = {
      id,
      role,
      state: 'patrol',
      position: spawnPos,
      heading: new THREE.Vector3(Math.cos(patrolAngle), 0, Math.sin(patrolAngle)),
      velocity: new THREE.Vector3(),
      targetPosition: new THREE.Vector3(),
      rotationY: patrolAngle,
      targetRotationY: 0,
      speed: role === 'soldier' ? 3.4 : 4.0,
      carryingFoodType: null,
      carryingMesh: null,
      harvestTimer: 0,
      attackTimer: 0,
      targetFruitId: null,
      targetEnemyId: null,
      legPhase: Math.random() * Math.PI * 2,
      patrolAngle,
      patrolDistance: patrolPhi,
      trailProgress: 0,
      trailLane: 0.1, // outward lane
      trailDepartureDelay: 0,
    };

    this.ants.push(ant);
    return ant;
  }

  /**
   * Orders worker ants to form an orderly single-file Ameisenstraße to a specific fruit.
   * Ants depart in staggered sequence and follow a narrow column rather than rushing in a dense swarm.
   */
  orderHarvestFruit(fruitId: string): void {
    const fruit = this.fruitFactory.getFruitById(fruitId);
    if (!fruit || fruit.isDepleted) return;

    // Activate visible golden Ameisenstraße ribbon on planet surface
    this.terrainFactory?.setActiveHarvestTrail(fruit.position);

    let dispatched = 0;
    const maxToDispatch = Math.min(20, Math.max(8, fruit.remainingChunks * 2));

    for (const ant of this.ants) {
      if (ant.state === 'patrol' && !ant.carryingMesh) {
        ant.state = 'moving_to_target';
        ant.targetFruitId = fruitId;
        ant.targetEnemyId = null;
        ant.targetPosition.copy(fruit.position);

        // Stagger departure delay so ants march in single-file along the road!
        ant.trailDepartureDelay = dispatched * 0.28;
        ant.trailProgress = 0.0;
        ant.trailLane = 0.1; // Right lane for outward journey

        dispatched++;
        if (dispatched >= maxToDispatch) break;
      }
    }
  }

  /**
   * Mobilizes a strike swarm of ants to attack an invasive enemy insect.
   */
  orderAttackEnemy(enemyId: string): void {
    const enemy = this.enemyFactory.getEnemyById(enemyId);
    if (!enemy || enemy.isDead) return;

    for (const ant of this.ants) {
      if (ant.state === 'patrol' || (ant.state === 'moving_to_target' && !ant.carryingMesh)) {
        ant.state = 'attacking_enemy';
        ant.targetEnemyId = enemyId;
        ant.targetFruitId = null;
      }
    }
  }

  /**
   * Sound-the-alarm action: Mobilizes all ants to defend the closest threat or hill.
   */
  alarmAllAnts(): void {
    const activeEnemies = this.enemyFactory.getActiveEnemies();
    if (activeEnemies.length > 0) {
      this.orderAttackEnemy(activeEnemies[0].id);
    } else {
      for (const ant of this.ants) {
        if (!ant.carryingMesh) {
          ant.state = 'patrol';
          ant.patrolDistance = 0.2 + Math.random() * 0.25;
        }
      }
    }
  }

  /**
   * Main simulation step: Updates ant AI, spherical surface positions, normal orientations,
   * single-file Ameisenstraße pathfinding, harvesting, and GPU InstancedMesh updates.
   */
  update(
    dt: number,
    onFoodDeposited?: () => void,
    onEnemyDefeated?: () => void,
    onAntBite?: () => void,
  ): void {
    const activeFruits = this.fruitFactory.getActiveFruits();
    const activeEnemies = this.enemyFactory.getActiveEnemies();

    for (let i = 0; i < this.ants.length; i++) {
      const ant = this.ants[i];
      ant.legPhase += dt * ant.speed * 8.5;

      switch (ant.state) {
        case 'patrol':
          this.updatePatrol(ant, dt);
          break;

        case 'moving_to_target':
          this.updateMovingToTarget(ant, dt, activeFruits);
          break;

        case 'harvesting':
          this.updateHarvesting(ant, dt, onAntBite);
          break;

        case 'carrying_food':
          this.updateCarryingFood(ant, dt, onFoodDeposited);
          break;

        case 'attacking_enemy':
          this.updateAttackingEnemy(ant, dt, activeEnemies, onEnemyDefeated, onAntBite);
          break;
      }

      // Snap ant to planet surface with walking leg bob
      const bob = Math.sin(ant.legPhase) * 0.025;
      ant.position.copy(AmeisenTerrainFactory.getPointOnPlanet(ant.position, 0.1 + bob));

      // Orient dummy transform along planet surface normal and tangent heading
      const scale = ant.role === 'soldier' ? 1.38 : 1.0;
      this.dummyTransform.position.copy(ant.position);
      AmeisenTerrainFactory.orientObjectOnPlanet(this.dummyTransform, ant.position, ant.heading);
      this.dummyTransform.scale.set(scale, scale, scale);
      this.dummyTransform.updateMatrix();

      this.instancedBodyMesh.setMatrixAt(i, this.dummyTransform.matrix);

      // Update carried food chunk position above ant's head & mandibles
      if (ant.carryingMesh) {
        const up = ant.position.clone().normalize();
        ant.carryingMesh.position
          .copy(ant.position)
          .addScaledVector(up, 0.34)
          .addScaledVector(ant.heading, 0.25);
        AmeisenTerrainFactory.orientObjectOnPlanet(
          ant.carryingMesh,
          ant.carryingMesh.position,
          ant.heading,
        );
      }
    }

    this.instancedBodyMesh.instanceMatrix.needsUpdate = true;
  }

  private updatePatrol(ant: AntData, dt: number): void {
    ant.patrolAngle += 0.25 * dt;
    const phi = ant.patrolDistance + Math.sin(ant.patrolAngle * 2.0) * 0.08;
    const targetPt = AmeisenTerrainFactory.polarToSurfacePoint(phi, ant.patrolAngle, 0.12);

    this.moveTowardsOnSphere(ant, targetPt, ant.speed * 0.68, dt);
  }

  /**
   * Single-file marching outward along the Ameisenstraße to the targeted fruit.
   */
  private updateMovingToTarget(ant: AntData, dt: number, activeFruits: FruitItem[]): void {
    const targetFruit = activeFruits.find((f) => f.id === ant.targetFruitId);
    if (!targetFruit || targetFruit.isDepleted) {
      ant.state = 'patrol';
      ant.targetFruitId = null;
      this.terrainFactory?.clearActiveHarvestTrail();
      return;
    }

    // Stagger departure delay at the hill entrance so ants march in a line
    if (ant.trailDepartureDelay > 0) {
      ant.trailDepartureDelay -= dt;
      ant.position.copy(this.hillEntrance);
      return;
    }

    const startNorm = this.hillEntrance.clone().normalize();
    const endNorm = targetFruit.position.clone().normalize();

    // Compute great-circle angle
    const totalAngle = startNorm.angleTo(endNorm);
    const angularSpeed = ant.speed / AmeisenTerrainFactory.PLANET_RADIUS;

    ant.trailProgress = Math.min(
      1.0,
      ant.trailProgress + (angularSpeed * dt) / Math.max(0.1, totalAngle),
    );

    // Great-circle slerp interpolation along the Ameisenstraße
    const currentDir = startNorm.clone().lerp(endNorm, ant.trailProgress).normalize();

    // Lateral lane offset (+0.1 for right lane)
    const normal = currentDir.clone();
    const forward = endNorm.clone().sub(startNorm).normalize();
    const crossRight = new THREE.Vector3().crossVectors(forward, normal).normalize();

    const roadPos = AmeisenTerrainFactory.getPointOnPlanet(currentDir, 0.12);
    roadPos.addScaledVector(crossRight, ant.trailLane);
    ant.position.copy(roadPos);

    // Tangential forward heading along the trail
    ant.heading.copy(forward);

    if (ant.trailProgress >= 0.98) {
      ant.state = 'harvesting';
      ant.harvestTimer = 0;
    }
  }

  private updateHarvesting(ant: AntData, dt: number, onAntBite?: () => void): void {
    const fruit = this.fruitFactory.getFruitById(ant.targetFruitId || '');
    if (!fruit || fruit.isDepleted || fruit.remainingChunks <= 0) {
      ant.state = 'patrol';
      ant.targetFruitId = null;
      this.terrainFactory?.clearActiveHarvestTrail();
      return;
    }

    ant.harvestTimer += dt;

    if (ant.harvestTimer >= 0.72) {
      const carriedChunk = this.fruitFactory.harvestChunk(fruit);
      if (carriedChunk) {
        ant.carryingMesh = carriedChunk;
        ant.carryingFoodType = fruit.type;
        this.carriedCrumbsGroup.add(carriedChunk);
        ant.state = 'carrying_food';
        ant.trailProgress = 1.0;
        ant.trailLane = -0.1; // Switch to return lane (left lane)
        onAntBite?.();
      } else {
        ant.state = 'patrol';
        this.terrainFactory?.clearActiveHarvestTrail();
      }
    }
  }

  /**
   * Single-file marching back along the Ameisenstraße carrying the food chunk to the hill.
   */
  private updateCarryingFood(ant: AntData, dt: number, onFoodDeposited?: () => void): void {
    const targetFruit = this.fruitFactory.getFruitById(ant.targetFruitId || '');
    const fruitPos = targetFruit ? targetFruit.position : ant.position;

    const startNorm = this.hillEntrance.clone().normalize();
    const endNorm = fruitPos.clone().normalize();

    const totalAngle = startNorm.angleTo(endNorm);
    const angularSpeed = (ant.speed * 0.92) / AmeisenTerrainFactory.PLANET_RADIUS;

    // Progress moves backwards from 1.0 down to 0.0
    ant.trailProgress = Math.max(
      0.0,
      ant.trailProgress - (angularSpeed * dt) / Math.max(0.1, totalAngle),
    );

    const currentDir = startNorm.clone().lerp(endNorm, ant.trailProgress).normalize();

    // Lateral return lane offset (-0.1)
    const normal = currentDir.clone();
    const forward = startNorm.clone().sub(endNorm).normalize(); // Heading back to hill
    const crossRight = new THREE.Vector3().crossVectors(forward, normal).normalize();

    const roadPos = AmeisenTerrainFactory.getPointOnPlanet(currentDir, 0.12);
    roadPos.addScaledVector(crossRight, 0.1);
    ant.position.copy(roadPos);
    ant.heading.copy(forward);

    if (ant.trailProgress <= 0.02) {
      // Delivered to hill entrance!
      if (ant.carryingMesh) {
        this.carriedCrumbsGroup.remove(ant.carryingMesh);
        ant.carryingMesh.geometry.dispose();
        (ant.carryingMesh.material as THREE.Material).dispose();
        ant.carryingMesh = null;
      }
      ant.carryingFoodType = null;
      this.foodDeliveredCount++;
      onFoodDeposited?.();

      // Colony growth: Every 5 food chunks delivered spawns +5 new ants!
      if (this.foodDeliveredCount % 5 === 0) {
        for (let s = 0; s < 5; s++) {
          this.spawnAnt(s === 0 ? 'soldier' : 'worker');
        }
      }

      if (this.foodDeliveredCount >= 30) {
        this.hillLevel = 3;
      } else if (this.foodDeliveredCount >= 10) {
        this.hillLevel = 2;
      }

      this.terrainFactory?.setHillLevel(this.hillLevel);

      // If the fruit still has food, step back onto the outward lane!
      if (targetFruit && !targetFruit.isDepleted && targetFruit.remainingChunks > 0) {
        ant.state = 'moving_to_target';
        ant.trailProgress = 0.0;
        ant.trailLane = 0.1;
      } else {
        ant.state = 'patrol';
        ant.targetFruitId = null;
        this.terrainFactory?.clearActiveHarvestTrail();
      }
    }
  }

  private updateAttackingEnemy(
    ant: AntData,
    dt: number,
    activeEnemies: EnemyItem[],
    onEnemyDefeated?: () => void,
    onAntBite?: () => void,
  ): void {
    const enemy = activeEnemies.find((e) => e.id === ant.targetEnemyId);
    if (!enemy || enemy.isDead) {
      ant.state = 'patrol';
      ant.targetEnemyId = null;
      return;
    }

    const dist = ant.position.distanceTo(enemy.position);

    if (dist > 1.25) {
      this.moveTowardsOnSphere(ant, enemy.position, ant.speed * 1.35, dt);
    } else {
      ant.attackTimer += dt;
      if (ant.attackTimer >= 0.32) {
        ant.attackTimer = 0;
        const damage = ant.role === 'soldier' ? 5.2 : 2.4;
        const defeated = this.enemyFactory.damageEnemy(enemy, damage);
        onAntBite?.();

        if (defeated) {
          this.defeatedEnemiesCount++;
          onEnemyDefeated?.();
          this.foodDeliveredCount += 4;
          ant.state = 'patrol';
          ant.targetEnemyId = null;
        }
      }
    }
  }

  /**
   * Spherical geodesic surface steering.
   */
  private moveTowardsOnSphere(
    ant: AntData,
    targetWorldPos: THREE.Vector3,
    speed: number,
    dt: number,
  ): void {
    const currentNorm = ant.position.clone().normalize();
    const targetNorm = targetWorldPos.clone().normalize();

    const normal = currentNorm.clone();
    let forward = targetNorm.clone().sub(normal.clone().multiplyScalar(targetNorm.dot(normal)));

    if (forward.lengthSq() > 0.0001) {
      forward.normalize();
      ant.heading.lerp(forward, Math.min(1.0, dt * 10.0)).normalize();

      const angularStep = (speed * dt) / AmeisenTerrainFactory.PLANET_RADIUS;
      const angleBetween = currentNorm.angleTo(targetNorm);

      if (angleBetween > 0.01) {
        const step = Math.min(angleBetween, angularStep);
        const q = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3().crossVectors(currentNorm, ant.heading).normalize(),
          -step,
        );
        currentNorm.applyQuaternion(q);
        ant.position.copy(AmeisenTerrainFactory.getPointOnPlanet(currentNorm, 0.12));
      }
    }
  }

  resetColony(): void {
    for (const ant of this.ants) {
      if (ant.carryingMesh) {
        this.carriedCrumbsGroup.remove(ant.carryingMesh);
        ant.carryingMesh.geometry.dispose();
        (ant.carryingMesh.material as THREE.Material).dispose();
      }
    }

    this.ants.length = 0;
    this.foodDeliveredCount = 0;
    this.defeatedEnemiesCount = 0;
    this.hillLevel = 1;
    this.terrainFactory?.setHillLevel(1);
    this.terrainFactory?.clearActiveHarvestTrail();

    for (let i = 0; i < this.maxAntCapacity; i++) {
      this.dummyTransform.position.set(0, -999, 0);
      this.dummyTransform.scale.set(0, 0, 0);
      this.dummyTransform.updateMatrix();
      this.instancedBodyMesh.setMatrixAt(i, this.dummyTransform.matrix);
    }
    this.instancedBodyMesh.instanceMatrix.needsUpdate = true;

    this.initStarterColony(20);
  }

  dispose(): void {
    this.resetColony();
    if (this.instancedBodyMesh) {
      this.instancedBodyMesh.geometry.dispose();
      (this.instancedBodyMesh.material as THREE.Material).dispose();
    }
    this.rootGroup.clear();
  }
}
