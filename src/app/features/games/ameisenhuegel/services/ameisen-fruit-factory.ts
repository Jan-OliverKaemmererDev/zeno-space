import * as THREE from 'three';
import { FruitChunk, FruitItem, FruitType } from '../models/fruit.model';
import { AmeisenTerrainFactory } from './ameisen-terrain-factory';

/**
 * Factory for procedurally creating realistic 3D fallen fruits
 * (Apples, Pears, Strawberries, Oranges) resting naturally on the mossy planet surface,
 * composed of detachable food chunks that break off as ants harvest them.
 * Modeled strictly to look like delicious fruits lying on the grass, not trees!
 */
export class AmeisenFruitFactory {
  private readonly fruitsGroup = new THREE.Group();
  private nextId = 1;
  private readonly activeFruits: FruitItem[] = [];

  constructor() {}

  getGroup(): THREE.Group {
    return this.fruitsGroup;
  }

  getActiveFruits(): FruitItem[] {
    return this.activeFruits;
  }

  getFruitById(id: string): FruitItem | undefined {
    return this.activeFruits.find((f) => f.id === id);
  }

  /**
   * Spawns a new fruit anchored on the spherical planet surface.
   */
  spawnFruit(type?: FruitType, customPos?: THREE.Vector3): FruitItem {
    const fruitType: FruitType =
      type ??
      (['apfel', 'birne', 'erdbeere', 'orange'] as FruitType[])[Math.floor(Math.random() * 4)];

    const fruitGroup = new THREE.Group();
    const id = `fruit_${this.nextId++}`;
    fruitGroup.name = id;

    let pos: THREE.Vector3;
    if (customPos) {
      pos = AmeisenTerrainFactory.getPointOnPlanet(customPos, 0.42);
    } else {
      // Spawn on upper and middle hemisphere of the enlarged planet
      const phi = 0.28 + Math.random() * 0.95;
      const theta = Math.random() * Math.PI * 2;
      pos = AmeisenTerrainFactory.polarToSurfacePoint(phi, theta, 0.42);
    }

    fruitGroup.position.copy(pos);
    AmeisenTerrainFactory.orientObjectOnPlanet(fruitGroup, pos);

    // Build the specific fruit core and detachable chunk pieces
    const { coreMesh, chunks, totalChunks } = this.buildFruitMeshes(fruitType);
    fruitGroup.add(coreMesh);

    for (const chunk of chunks) {
      fruitGroup.add(chunk.mesh);
    }

    // Glowing hover beacon disc on surface beneath fruit
    const beaconGeo = new THREE.RingGeometry(0.85, 1.25, 32);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.rotation.x = Math.PI / 2;
    beaconMesh.position.y = -0.36;
    beaconMesh.name = 'beacon';
    fruitGroup.add(beaconMesh);

    fruitGroup.userData = { isFruit: true, fruitId: id };

    const fruitItem: FruitItem = {
      id,
      type: fruitType,
      position: pos,
      meshGroup: fruitGroup,
      chunks,
      totalChunks,
      remainingChunks: totalChunks,
      isDepleted: false,
      spawnTime: performance.now(),
      bounceOffset: Math.random() * Math.PI * 2,
    };

    this.activeFruits.push(fruitItem);
    this.fruitsGroup.add(fruitGroup);

    return fruitItem;
  }

  /**
   * Detaches a physical chunk from the fruit when an ant harvests it.
   */
  harvestChunk(fruit: FruitItem): THREE.Mesh | null {
    if (fruit.isDepleted || fruit.remainingChunks <= 0) {
      return null;
    }

    const unharvested = fruit.chunks.find((c) => !c.isHarvested);
    if (!unharvested) {
      fruit.isDepleted = true;
      this.depleteFruit(fruit);
      return null;
    }

    unharvested.isHarvested = true;
    unharvested.mesh.visible = false;
    fruit.remainingChunks--;

    // Create a physical floating crumb mesh to be held by the ant
    const crumbGeo = unharvested.mesh.geometry.clone();
    const crumbMat = (unharvested.mesh.material as THREE.Material).clone();
    const carriedCrumb = new THREE.Mesh(crumbGeo, crumbMat);
    carriedCrumb.scale.set(0.68, 0.68, 0.68);

    // Fruit core shrinks proportionally as chunks are removed
    const coreMesh = fruit.meshGroup.children[0] as THREE.Mesh;
    if (coreMesh) {
      const shrinkRatio = Math.max(0.35, fruit.remainingChunks / fruit.totalChunks);
      coreMesh.scale.setScalar(shrinkRatio);
    }

    if (fruit.remainingChunks <= 0) {
      fruit.isDepleted = true;
      this.depleteFruit(fruit);
    }

    return carriedCrumb;
  }

  private depleteFruit(fruit: FruitItem): void {
    const group = fruit.meshGroup;
    group.visible = false;
    const idx = this.activeFruits.indexOf(fruit);
    if (idx !== -1) {
      this.activeFruits.splice(idx, 1);
    }
    this.fruitsGroup.remove(group);
  }

  private buildFruitMeshes(type: FruitType): {
    coreMesh: THREE.Group;
    chunks: FruitChunk[];
    totalChunks: number;
  } {
    const coreGroup = new THREE.Group();
    const chunks: FruitChunk[] = [];
    const totalChunks = 8;

    let coreColor = 0xdc2626;
    let chunkColor = 0xfef08a;

    if (type === 'apfel') {
      // 1. Ripe Apple: Spherical with indented top & bottom dimples, tilted resting on ground
      coreColor = 0xdc2626; // Glossy ruby red
      chunkColor = 0xfef08a; // Golden-cream crisp flesh

      const appleGeo = new THREE.SphereGeometry(0.72, 24, 20);
      appleGeo.scale(1.08, 0.88, 1.08); // Flatten slightly top-to-bottom

      const pos = appleGeo.attributes['position'];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const rXZ = Math.hypot(x, z);
        const indent = Math.exp(-rXZ * 5.0) * 0.18;
        pos.setY(i, y > 0 ? y - indent : y + indent * 0.5);
      }
      appleGeo.computeVertexNormals();

      const appleMat = new THREE.MeshStandardMaterial({
        color: coreColor,
        roughness: 0.22,
        metalness: 0.08,
      });
      const appleMesh = new THREE.Mesh(appleGeo, appleMat);
      appleMesh.castShadow = true;

      // Rest the apple tilted on its side so it looks naturally fallen
      appleMesh.rotation.z = 0.45;
      appleMesh.rotation.x = 0.35;
      appleMesh.position.y = 0.28;
      coreGroup.add(appleMesh);

      // Short, delicate curved apple stem nestled in the top dimple
      const stem = this.createDelicateFruitStem(0.18, 0.02);
      stem.position.set(-0.12, 0.58, -0.08);
      stem.rotation.z = -0.4;
      coreGroup.add(stem);
    } else if (type === 'birne') {
      // 2. Pear: Bulbous bottom with smoothly tapering neck, resting flat on its side
      coreColor = 0x84cc16; // Soft golden pear green
      chunkColor = 0xd9f99d;

      const pearGroup = new THREE.Group();
      const pearMat = new THREE.MeshStandardMaterial({
        color: coreColor,
        roughness: 0.32,
        metalness: 0.04,
      });

      // Bulbous base
      const baseGeo = new THREE.SphereGeometry(0.68, 22, 18);
      baseGeo.scale(1.0, 0.9, 1.0);
      const baseMesh = new THREE.Mesh(baseGeo, pearMat);
      baseMesh.position.y = -0.12;
      baseMesh.castShadow = true;
      pearGroup.add(baseMesh);

      // Tapered neck
      const neckGeo = new THREE.ConeGeometry(0.46, 0.72, 20);
      neckGeo.translate(0, 0.36, 0);
      const neckMesh = new THREE.Mesh(neckGeo, pearMat);
      neckMesh.castShadow = true;
      pearGroup.add(neckMesh);

      // Top round crown
      const crownGeo = new THREE.SphereGeometry(0.32, 16, 14);
      const crownMesh = new THREE.Mesh(crownGeo, pearMat);
      crownMesh.position.y = 0.7;
      crownMesh.castShadow = true;
      pearGroup.add(crownMesh);

      // Lay the pear on its side on the moss!
      pearGroup.rotation.z = Math.PI / 2.3;
      pearGroup.rotation.x = 0.2;
      pearGroup.position.set(0.1, 0.26, 0);
      coreGroup.add(pearGroup);

      // Delicate curved stem lying along ground
      const stem = this.createDelicateFruitStem(0.24, 0.022);
      stem.position.set(0.48, 0.45, 0);
      stem.rotation.z = Math.PI / 2.2;
      coreGroup.add(stem);
    } else if (type === 'erdbeere') {
      // 3. Strawberry: Conical ruby berry lying on its side with leafy green calyx
      coreColor = 0xe11d48;
      chunkColor = 0xfda4af;

      const berryGeo = new THREE.ConeGeometry(0.65, 1.1, 22);
      berryGeo.rotateX(Math.PI);
      const berryMat = new THREE.MeshStandardMaterial({
        color: coreColor,
        roughness: 0.38,
        metalness: 0.05,
      });
      const berry = new THREE.Mesh(berryGeo, berryMat);
      berry.castShadow = true;

      // Golden achene seed dots
      const seedGeo = new THREE.SphereGeometry(0.028, 6, 6);
      const seedMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 });
      for (let s = 0; s < 18; s++) {
        const sAngle = (s / 18) * Math.PI * 2 * 3;
        const hNorm = (s / 18) * 0.8 - 0.35;
        const coneR = Math.max(0.12, 0.55 - (s / 18) * 0.45);
        const seed = new THREE.Mesh(seedGeo, seedMat);
        seed.position.set(Math.cos(sAngle) * coneR, hNorm, Math.sin(sAngle) * coneR);
        berry.add(seed);
      }

      // Star-shaped leafy green calyx
      const calyxGeo = new THREE.CircleGeometry(0.45, 6);
      const calyxMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, side: THREE.DoubleSide });
      const calyx = new THREE.Mesh(calyxGeo, calyxMat);
      calyx.rotation.x = Math.PI / 2;
      calyx.position.y = 0.55;
      berry.add(calyx);

      // Lay tilted on side
      berry.rotation.z = Math.PI / 2.4;
      berry.position.y = 0.28;
      coreGroup.add(berry);
    } else {
      // 4. Fresh Orange: Sun-ripened orange with pebbled texture
      coreColor = 0xf97316;
      chunkColor = 0xfdba74;

      const orangeGeo = new THREE.SphereGeometry(0.68, 22, 20);
      orangeGeo.scale(1.04, 0.94, 1.04);
      const orangeMat = new THREE.MeshStandardMaterial({
        color: coreColor,
        roughness: 0.44,
        metalness: 0.05,
      });
      const orange = new THREE.Mesh(orangeGeo, orangeMat);
      orange.castShadow = true;
      orange.position.y = 0.28;
      orange.rotation.z = 0.35;
      coreGroup.add(orange);

      const stem = this.createDelicateFruitStem(0.12, 0.02);
      stem.position.set(0.08, 0.58, 0);
      coreGroup.add(stem);
    }

    // Bite-sized detachable food chunks clustered around the fruit
    const chunkGeo = new THREE.DodecahedronGeometry(0.18, 0);
    const chunkMat = new THREE.MeshStandardMaterial({
      color: chunkColor,
      roughness: 0.42,
      metalness: 0.05,
    });

    for (let i = 0; i < totalChunks; i++) {
      const phi = (i / totalChunks) * Math.PI * 2;
      const r = 0.62;
      const yOffset = ((i % 3) - 1) * 0.16 + 0.25;
      const chunkMesh = new THREE.Mesh(chunkGeo, chunkMat);
      const offset = new THREE.Vector3(Math.cos(phi) * r, yOffset, Math.sin(phi) * r);
      chunkMesh.position.copy(offset);
      chunkMesh.castShadow = true;

      chunks.push({
        mesh: chunkMesh,
        localOffset: offset,
        isHarvested: false,
      });
    }

    return { coreMesh: coreGroup, chunks, totalChunks };
  }

  /**
   * Creates a tiny, realistic fruit stem with small delicate leaf.
   */
  private createDelicateFruitStem(height: number, radius: number): THREE.Group {
    const stemGroup = new THREE.Group();
    const stemGeo = new THREE.CylinderGeometry(radius * 0.75, radius, height, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3d210b, roughness: 0.95 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.rotation.z = -0.25;
    stemGroup.add(stem);

    // Tiny delicate leaf resting along fruit surface
    const leafGeo = new THREE.SphereGeometry(0.11, 8, 6);
    leafGeo.scale(1.8, 0.15, 0.7);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.45 });
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(0.09, height * 0.4, 0);
    leaf.rotation.z = -0.3;
    stemGroup.add(leaf);

    return stemGroup;
  }

  update(nowSeconds: number): void {
    for (const fruit of this.activeFruits) {
      const beacon = fruit.meshGroup.getObjectByName('beacon');
      if (beacon) {
        beacon.rotation.z = nowSeconds * 0.6;
        const scale = 1.0 + Math.sin(nowSeconds * 3.2 + fruit.bounceOffset) * 0.1;
        beacon.scale.set(scale, scale, scale);
      }
    }
  }

  dispose(): void {
    for (const fruit of [...this.activeFruits]) {
      this.depleteFruit(fruit);
    }
    this.activeFruits.length = 0;
    this.fruitsGroup.clear();
  }
}
