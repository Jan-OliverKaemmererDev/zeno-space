import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { AtmosphereTheme } from '../utils/sky-cloud-generator';

/**
 * Service handling terrain generation and grass blade instancing.
 */
@Injectable()
export class GrasTerrainService {
  /**
   * Terrain elevation function creating the rolling hills and hillside vista:
   * - Foreground: slope descending from right to left and forward
   * - Midground: wide lush green valley with rolling slopes
   * - Background: distant foothills along the horizon
   */
  getTerrainHeight(x: number, z: number): number {
    // 1. Foreground slope
    const foreSlopeZ = Math.max(-0.6, Math.min(2.5, (17.0 - z) * 0.11));
    const foreSlopeX = Math.tanh(x * 0.036) * 2.6;
    const foregroundHill = foreSlopeZ + foreSlopeX;

    // 2. Wide valley & undulating hills (z: +4 to -24)
    const midValley =
      Math.sin(x * 0.046 + z * 0.076 + 1.25) * 2.3 +
      Math.cos(-x * 0.052 + z * 0.068 + 0.7) * 1.9;

    // 3. Continuous foothill ridge at the horizon
    const horizonFoothills =
      Math.sin(x * 0.038) * 1.7 + Math.sin(x * 0.082) * 0.95;
    const distantRise = Math.max(0.0, -z - 6.0) * 0.078;

    // Depth blending
    const depthT = Math.min(1.0, Math.max(0.0, (18.0 - z) / 15.0));

    return (
      foregroundHill * (1.0 - depthT * 0.65) +
      (midValley * 0.95 + horizonFoothills * 1.2 + distantRise) * depthT
    );
  }

  /**
   * Creates the underlying rolling ground mesh with moss texture.
   */
  createTerrainMesh(
    textureLoader: THREE.TextureLoader,
    theme: AtmosphereTheme
  ): THREE.Mesh {
    const groundGeo = new THREE.PlaneGeometry(380, 130, 200, 120);
    groundGeo.rotateX(-Math.PI / 2);
    const posAttr = groundGeo.attributes['position'];
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i) - 20.0;
      posAttr.setZ(i, z);
      posAttr.setY(i, this.getTerrainHeight(x, z) - 0.04);
    }
    groundGeo.computeVertexNormals();

    const groundTex = textureLoader.load('/images/gras-harmonie/moss-ground.jpg');
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(52, 20);
    groundTex.colorSpace = THREE.SRGBColorSpace;

    const groundMat = new THREE.MeshBasicMaterial({
      map: groundTex,
      color: theme.groundColor.clone(),
    });

    return new THREE.Mesh(groundGeo, groundMat);
  }

  /**
   * Builds custom multi-segmented grass blade geometry and instanced mesh.
   */
  createGrassMesh(
    bladeCount: number,
    grassMaterial: THREE.ShaderMaterial
  ): THREE.InstancedMesh {
    const bladeHeight = 1.18;
    const bladeWidth = 0.038;
    const bladeSegmentsY = 7;
    const bladeGeo = new THREE.PlaneGeometry(
      bladeWidth,
      bladeHeight,
      1,
      bladeSegmentsY
    );

    const bladePos = bladeGeo.attributes['position'];
    for (let i = 0; i < bladePos.count; i++) {
      const y = bladePos.getY(i) + bladeHeight / 2; // Base rooted at y = 0
      bladePos.setY(i, y);

      const t = y / bladeHeight; // 0 at base, 1 at tip
      const taper = Math.max(0.12, 1.0 - Math.pow(t, 1.25) * 0.88);
      bladePos.setX(i, bladePos.getX(i) * taper);

      const curve = Math.pow(t, 2.2) * 0.22;
      bladePos.setZ(i, curve);
    }
    bladeGeo.computeVertexNormals();

    const instMesh = new THREE.InstancedMesh(bladeGeo, grassMaterial, bladeCount);

    const colorVars = new Float32Array(bladeCount);
    const bladeSeeds = new Float32Array(bladeCount);
    const isFlowers = new Float32Array(bladeCount);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < bladeCount; i++) {
      let x: number;
      let z: number;
      let scaleMult = 1.0;

      if (i < bladeCount * 0.28) {
        // Zone 1: Foreground & immediate hillside (z: +20 to +3)
        const t = Math.pow(Math.random(), 0.85);
        z = 20.0 - t * 17.0;
        const halfSpan = 20.0 + (20.0 - z) * 1.6;
        x = (Math.random() - 0.5) * (halfSpan * 2.0);
        scaleMult = 1.0;
      } else if (i < bladeCount * 0.64) {
        // Zone 2: Midground rolling valley & pastures (z: +3 to -24)
        z = 3.0 - Math.random() * 27.0;
        const distFactor = (3.0 - z) / 27.0;
        const halfSpan = 45.0 + distFactor * 52.0;
        x = (Math.random() - 0.5) * (halfSpan * 2.0);
        scaleMult = 1.35;
      } else {
        // Zone 3: Distant background rolling foothills (z: -24 to -75)
        const t = Math.pow(Math.random(), 0.9);
        z = -24.0 - t * 51.0;
        const distFactor = (-z - 24.0) / 51.0;
        const halfSpan = 96.0 + distFactor * 84.0;
        x = (Math.random() - 0.5) * (halfSpan * 2.0);
        scaleMult = 1.55 + distFactor * 1.35;
      }

      const y = this.getTerrainHeight(x, z);

      dummy.position.set(x, y, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.rotation.x = (Math.random() - 0.5) * 0.22;
      dummy.rotation.z = (Math.random() - 0.5) * 0.22;

      // ~4.2% delicate wildflower blooms
      const isFlower = Math.random() < 0.042 ? 1.0 : 0.0;
      isFlowers[i] = isFlower;

      // Natural organic variation
      const heightScale =
        (0.82 + Math.random() * 0.42) * scaleMult * (isFlower > 0.5 ? 1.2 : 1.0);
      const widthScale =
        (0.88 + Math.random() * 0.32) * scaleMult * (isFlower > 0.5 ? 1.15 : 1.0);
      dummy.scale.set(widthScale, heightScale, widthScale);

      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);

      colorVars[i] = Math.random();
      bladeSeeds[i] = Math.random();
    }

    bladeGeo.setAttribute(
      'aColorVariation',
      new THREE.InstancedBufferAttribute(colorVars, 1)
    );
    bladeGeo.setAttribute(
      'aBladeSeed',
      new THREE.InstancedBufferAttribute(bladeSeeds, 1)
    );
    bladeGeo.setAttribute(
      'aIsFlower',
      new THREE.InstancedBufferAttribute(isFlowers, 1)
    );

    instMesh.instanceMatrix.needsUpdate = true;
    return instMesh;
  }
}
