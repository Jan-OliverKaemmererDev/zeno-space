import * as THREE from 'three';
import { EnemyItem, EnemyType } from '../models/enemy.model';
import { FruitItem } from '../models/fruit.model';
import { AmeisenTerrainFactory } from './ameisen-terrain-factory';

/**
 * Factory for spawning and managing large enemy insects (Beetles, Wasps, Spiders)
 * that crawl and fly across the spherical planet surface toward fruits until swarmed by ants.
 */
export class AmeisenEnemyFactory {
  private readonly enemiesGroup = new THREE.Group();
  private nextId = 1;
  private readonly activeEnemies: EnemyItem[] = [];

  constructor() {}

  getGroup(): THREE.Group {
    return this.enemiesGroup;
  }

  getActiveEnemies(): EnemyItem[] {
    return this.activeEnemies;
  }

  getEnemyById(id: string): EnemyItem | undefined {
    return this.activeEnemies.find((e) => e.id === id);
  }

  /**
   * Spawns an enemy insect in the equatorial/lower hemisphere of the spherical planet.
   */
  spawnEnemy(type?: EnemyType): EnemyItem {
    const enemyType: EnemyType =
      type ?? (['kaefer', 'wespe', 'spinne'] as EnemyType[])[Math.floor(Math.random() * 3)];

    const enemyGroup = new THREE.Group();
    const id = `enemy_${this.nextId++}`;
    enemyGroup.name = id;

    // Spawn around the lower/equatorial hemisphere (phi between 1.35 and 1.85)
    const phi = 1.35 + Math.random() * 0.5;
    const theta = Math.random() * Math.PI * 2;
    const heightOffset = enemyType === 'wespe' ? 1.45 : 0.36;

    const initialPos = AmeisenTerrainFactory.polarToSurfacePoint(phi, theta, heightOffset);
    const initialHeading = new THREE.Vector3(0, 1, 0);

    enemyGroup.position.copy(initialPos);
    AmeisenTerrainFactory.orientObjectOnPlanet(enemyGroup, initialPos, initialHeading);

    // Build specific 3D mesh
    const { mesh, maxHp, speed } = this.buildInsectMesh(enemyType);
    enemyGroup.add(mesh);

    // Build floating health indicator bar above insect
    const healthBarGroup = this.createHealthBar();
    healthBarGroup.position.y = enemyType === 'wespe' ? 1.15 : 0.95;
    enemyGroup.add(healthBarGroup);

    // Threat warning ring on planet surface beneath enemy
    const ringGeo = new THREE.RingGeometry(0.95, 1.25, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = enemyType === 'wespe' ? -1.35 : -0.3;
    ringMesh.name = 'threatRing';
    enemyGroup.add(ringMesh);

    enemyGroup.userData = { isEnemy: true, enemyId: id };

    const enemyItem: EnemyItem = {
      id,
      type: enemyType,
      position: initialPos,
      heading: initialHeading,
      targetFruitId: null,
      meshGroup: enemyGroup,
      healthBarGroup,
      healthBarMesh: healthBarGroup.getObjectByName('healthFill') as THREE.Mesh,
      maxHp,
      currentHp: maxHp,
      speed,
      rotationY: 0,
      isEating: false,
      eatTimer: 0,
      isDead: false,
      wingFlapPhase: 0,
      walkPhase: 0,
    };

    this.activeEnemies.push(enemyItem);
    this.enemiesGroup.add(enemyGroup);

    return enemyItem;
  }

  /**
   * Deals damage to an enemy from ant bites.
   * Returns true if the enemy was defeated by this hit.
   */
  damageEnemy(enemy: EnemyItem, damage: number): boolean {
    if (enemy.isDead) return false;

    enemy.currentHp = Math.max(0, enemy.currentHp - damage);

    if (enemy.healthBarMesh) {
      const pct = enemy.currentHp / enemy.maxHp;
      enemy.healthBarMesh.scale.x = Math.max(0.001, pct);
      enemy.healthBarMesh.position.x = -(1 - pct) * 0.45;
    }

    this.flashMesh(enemy.meshGroup);

    if (enemy.currentHp <= 0) {
      enemy.isDead = true;
      this.defeatEnemy(enemy);
      return true;
    }

    return false;
  }

  private flashMesh(group: THREE.Group): void {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat && mat.color && obj.name !== 'healthFill' && obj.name !== 'threatRing') {
          const orig = mat.color.getHex();
          mat.color.setHex(0xff3333);
          setTimeout(() => {
            mat.color.setHex(orig);
          }, 120);
        }
      }
    });
  }

  private defeatEnemy(enemy: EnemyItem): void {
    // Flip upside down relative to local surface normal
    enemy.meshGroup.rotateZ(Math.PI * 0.85);

    setTimeout(() => {
      enemy.meshGroup.visible = false;
      const idx = this.activeEnemies.indexOf(enemy);
      if (idx !== -1) {
        this.activeEnemies.splice(idx, 1);
      }
      this.enemiesGroup.remove(enemy.meshGroup);
    }, 1200);
  }

  private buildInsectMesh(type: EnemyType): {
    mesh: THREE.Group;
    maxHp: number;
    speed: number;
  } {
    const insect = new THREE.Group();
    let maxHp = 100;
    let speed = 1.6;

    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });

    if (type === 'kaefer') {
      // 1. Rhinoceros Beetle: Iridescent armored chitin shell, horn, glowing eyes & 6 jointed legs
      maxHp = 115;
      speed = 1.25;

      const chitinMat = new THREE.MeshStandardMaterial({
        color: 0x1e1b4b, // Deep iridescent midnight-indigo chitin
        roughness: 0.18,
        metalness: 0.55,
      });

      const abdomenGeo = new THREE.SphereGeometry(0.88, 16, 14);
      abdomenGeo.scale(1.15, 0.72, 1.05);
      const abdomen = new THREE.Mesh(abdomenGeo, chitinMat);
      abdomen.position.z = -0.35;
      abdomen.castShadow = true;
      insect.add(abdomen);

      const headGeo = new THREE.SphereGeometry(0.56, 14, 12);
      const head = new THREE.Mesh(headGeo, chitinMat);
      head.position.set(0, 0.1, 0.65);
      head.castShadow = true;
      insect.add(head);

      // Glowing Eyes
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.32, 0.22, 0.98);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.32, 0.22, 0.98);
      insect.add(eyeL, eyeR);

      // Curved Rhinoceros Horn
      const hornCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.2, 0.9),
        new THREE.Vector3(0, 0.68, 1.3),
        new THREE.Vector3(0, 1.15, 1.12),
      ]);
      const hornGeo = new THREE.TubeGeometry(hornCurve, 14, 0.09, 8, false);
      const horn = new THREE.Mesh(hornGeo, chitinMat);
      horn.castShadow = true;
      insect.add(horn);

      const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
      const legGeo = new THREE.CylinderGeometry(0.045, 0.03, 0.85, 6);
      for (let i = 0; i < 6; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const row = Math.floor(i / 2) - 1;
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(side * 0.72, -0.2, row * 0.45);
        leg.rotation.z = side * 0.78;
        leg.castShadow = true;
        insect.add(leg);
      }
    } else if (type === 'wespe') {
      // 2. Wasp: Striped yellow & obsidian abdomen, stinger, fluttering wings
      maxHp = 75;
      speed = 2.4;

      const yellowMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.3,
        metalness: 0.1,
      });
      const blackMat = new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.35,
        metalness: 0.2,
      });

      const abdGeo = new THREE.ConeGeometry(0.52, 1.25, 14);
      abdGeo.rotateX(Math.PI / 2);
      const abd = new THREE.Mesh(abdGeo, yellowMat);
      abd.position.z = -0.42;
      abd.castShadow = true;
      insect.add(abd);

      const stripeGeo = new THREE.TorusGeometry(0.39, 0.065, 8, 16);
      const stripe1 = new THREE.Mesh(stripeGeo, blackMat);
      stripe1.position.z = -0.3;
      insect.add(stripe1);
      const stripe2 = new THREE.Mesh(stripeGeo, blackMat);
      stripe2.position.z = -0.62;
      stripe2.scale.setScalar(0.75);
      insect.add(stripe2);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), blackMat);
      head.position.set(0, 0, 0.52);
      head.castShadow = true;
      insect.add(head);

      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.24, 0.1, 0.8);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.24, 0.1, 0.8);
      insect.add(eyeL, eyeR);

      const wingMat = new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.65,
        roughness: 0.1,
        side: THREE.DoubleSide,
      });
      const wingGeo = new THREE.PlaneGeometry(0.45, 1.2);

      const wingLeft = new THREE.Mesh(wingGeo, wingMat);
      wingLeft.position.set(-0.48, 0.36, 0.1);
      wingLeft.rotation.x = Math.PI / 2;
      wingLeft.rotation.y = 0.3;
      wingLeft.name = 'wingLeft';
      insect.add(wingLeft);

      const wingRight = new THREE.Mesh(wingGeo, wingMat);
      wingRight.position.set(0.48, 0.36, 0.1);
      wingRight.rotation.x = Math.PI / 2;
      wingRight.rotation.y = -0.3;
      wingRight.name = 'wingRight';
      insect.add(wingRight);
    } else {
      // 3. Forest Spider: Dark velvet body, crimson hourglass marking, glowing eyes, 8 legs
      maxHp = 90;
      speed = 1.75;

      const spiderMat = new THREE.MeshStandardMaterial({
        color: 0x27272a,
        roughness: 0.65,
        metalness: 0.15,
      });

      const bodyGeo = new THREE.SphereGeometry(0.68, 14, 14);
      const body = new THREE.Mesh(bodyGeo, spiderMat);
      body.position.z = -0.32;
      body.castShadow = true;
      insect.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 12, 12), spiderMat);
      head.position.set(0, 0, 0.42);
      head.castShadow = true;
      insect.add(head);

      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.18, 0.15, 0.78);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.18, 0.15, 0.78);
      insect.add(eyeL, eyeR);

      const legGeo = new THREE.CylinderGeometry(0.038, 0.025, 0.95, 6);
      for (let i = 0; i < 8; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const index = Math.floor(i / 2);
        const leg = new THREE.Mesh(legGeo, spiderMat);
        leg.position.set(side * 0.68, -0.05, (index - 1.5) * 0.35);
        leg.rotation.z = side * 0.92;
        leg.rotation.y = (index - 1.5) * 0.35;
        leg.castShadow = true;
        insect.add(leg);
      }
    }

    return { mesh: insect, maxHp, speed };
  }

  private createHealthBar(): THREE.Group {
    const barGroup = new THREE.Group();
    barGroup.name = 'healthBarGroup';

    const bgGeo = new THREE.PlaneGeometry(0.98, 0.15);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x09090b, side: THREE.DoubleSide });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    barGroup.add(bgMesh);

    const fillGeo = new THREE.PlaneGeometry(0.92, 0.1);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    fillMesh.name = 'healthFill';
    fillMesh.position.z = 0.01;
    barGroup.add(fillMesh);

    return barGroup;
  }

  /**
   * Updates enemy AI: Navigates along the curved planet surface toward active fruits to devour them.
   */
  update(
    dt: number,
    activeFruits: FruitItem[],
    onFruitDevouredChunk: (fruit: FruitItem) => void,
    cameraPosition?: THREE.Vector3,
  ): void {
    const nowSeconds = performance.now() / 1000;

    for (const enemy of this.activeEnemies) {
      if (enemy.isDead) continue;

      if (enemy.healthBarGroup && cameraPosition) {
        enemy.healthBarGroup.lookAt(cameraPosition);
      }

      // 1. Wing flap animation for wasp
      if (enemy.type === 'wespe') {
        const left = enemy.meshGroup.getObjectByName('wingLeft');
        const right = enemy.meshGroup.getObjectByName('wingRight');
        if (left && right) {
          const flap = Math.sin(nowSeconds * 44.0) * 0.65;
          left.rotation.z = flap;
          right.rotation.z = -flap;
        }
      }

      // 2. Select closest available fruit as target
      let targetFruit: FruitItem | undefined;
      if (enemy.targetFruitId) {
        targetFruit = activeFruits.find((f) => f.id === enemy.targetFruitId && !f.isDepleted);
      }

      if (!targetFruit && activeFruits.length > 0) {
        let minDist = Infinity;
        for (const fruit of activeFruits) {
          if (fruit.isDepleted) continue;
          const dist = enemy.position.distanceTo(fruit.position);
          if (dist < minDist) {
            minDist = dist;
            targetFruit = fruit;
          }
        }
        if (targetFruit) {
          enemy.targetFruitId = targetFruit.id;
        }
      }

      // 3. Move along the spherical surface toward target fruit (or North Pole hill)
      const defaultPole = new THREE.Vector3(0, AmeisenTerrainFactory.PLANET_RADIUS, 0);
      const targetPos = targetFruit ? targetFruit.position : defaultPole;
      const distToTarget = enemy.position.distanceTo(targetPos);

      const baseOffset = enemy.type === 'wespe' ? 1.45 : 0.36;

      if (distToTarget > 1.55) {
        enemy.isEating = false;
        enemy.walkPhase += dt * 9.0;

        // Compute tangent direction towards target on the sphere
        const up = enemy.position.clone().normalize();
        const toTarget = targetPos.clone().sub(enemy.position);
        const tangentDir = toTarget.addScaledVector(up, -toTarget.dot(up)).normalize();

        enemy.heading.lerp(tangentDir, Math.min(1.0, dt * 6.0)).normalize();

        const bob =
          enemy.type === 'wespe'
            ? Math.sin(nowSeconds * 5.0) * 0.12
            : Math.sin(enemy.walkPhase) * 0.05;

        const nextPos = enemy.position.clone().addScaledVector(enemy.heading, enemy.speed * dt);
        enemy.position.copy(AmeisenTerrainFactory.getPointOnPlanet(nextPos, baseOffset + bob));

        enemy.meshGroup.position.copy(enemy.position);
        AmeisenTerrainFactory.orientObjectOnPlanet(enemy.meshGroup, enemy.position, enemy.heading);
      } else if (targetFruit && !targetFruit.isDepleted) {
        // In range to devour fruit!
        enemy.isEating = true;
        enemy.eatTimer += dt;

        if (enemy.eatTimer >= 2.0) {
          enemy.eatTimer = 0;
          onFruitDevouredChunk(targetFruit);
        }

        const eatBob = Math.sin(nowSeconds * 14.0) * 0.06;
        enemy.position.copy(
          AmeisenTerrainFactory.getPointOnPlanet(enemy.position, baseOffset + eatBob),
        );
        enemy.meshGroup.position.copy(enemy.position);
        AmeisenTerrainFactory.orientObjectOnPlanet(enemy.meshGroup, enemy.position, enemy.heading);
      }
    }
  }

  dispose(): void {
    for (const enemy of [...this.activeEnemies]) {
      this.defeatEnemy(enemy);
    }
    this.activeEnemies.length = 0;
    this.enemiesGroup.clear();
  }
}
