import * as THREE from 'three';
import { GenomeSpecies } from '../models/elemente.types';

/**
 * Service that builds and animates a high-fidelity 3D DNA Double Helix.
 * Displays sugar-phosphate backbones and glowing base pairs (A-T, G-C)
 * mapped to the active species' characteristic DNA motif.
 */
export class Dna3DService {
  readonly group = new THREE.Group();

  private backboneSpheres: THREE.Mesh[] = [];
  private baseMeshes: THREE.Mesh[] = [];
  private hydrogenBonds: THREE.Mesh[] = [];

  // Reusable materials
  private sphereGeo = new THREE.SphereGeometry(0.24, 16, 16);
  private bondCylGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 12);
  private hBondGeo = new THREE.SphereGeometry(0.1, 12, 12);

  private matBackbone = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    roughness: 0.3,
    metalness: 0.5,
  });

  private matA = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.25 }); // Adenine: Cyan
  private matT = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.25 }); // Thymine: Gold
  private matG = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.25 }); // Guanine: Emerald Green
  private matC = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.25 }); // Cytosine: Magenta
  private matH = new THREE.MeshBasicMaterial({ color: 0xffffff });

  /**
   * Constructs the DNA double helix for a given species.
   *
   * @param species - Active species with DNA sequence motif.
   */
  buildHelix(species: GenomeSpecies): void {
    this.clear();

    // Adapt the backbone color to the species' signature color
    if (species.color) {
      this.matBackbone.color.set(new THREE.Color(species.color));
    } else {
      this.matBackbone.color.set(0x93c5fd);
    }

    const sequence = species.dnaSequenceSample || 'ATGCGATCGATCGATCGATC';
    const totalSteps = Math.max(36, sequence.length * 2);
    const radius = 2.4;
    const heightStep = 0.55;
    const pitch = 0.36; // twist angle in radians per step

    for (let i = 0; i < totalSteps; i++) {
      const angle = i * pitch;
      const y = (i - totalSteps / 2) * heightStep;

      // Position on Strand 1
      const x1 = Math.cos(angle) * radius;
      const z1 = Math.sin(angle) * radius;
      const p1 = new THREE.Vector3(x1, y, z1);

      // Position on Strand 2 (180° opposite)
      const x2 = Math.cos(angle + Math.PI) * radius;
      const z2 = Math.sin(angle + Math.PI) * radius;
      const p2 = new THREE.Vector3(x2, y, z2);

      // 1. Sugar-Phosphate Backbone nodes
      const node1 = new THREE.Mesh(this.sphereGeo, this.matBackbone);
      node1.position.copy(p1);
      this.backboneSpheres.push(node1);
      this.group.add(node1);

      const node2 = new THREE.Mesh(this.sphereGeo, this.matBackbone);
      node2.position.copy(p2);
      this.backboneSpheres.push(node2);
      this.group.add(node2);

      // 2. Base Pairs (A-T or G-C)
      const baseChar = sequence[i % sequence.length].toUpperCase();
      let matBase1: THREE.MeshStandardMaterial;
      let matBase2: THREE.MeshStandardMaterial;

      if (baseChar === 'A') {
        matBase1 = this.matA;
        matBase2 = this.matT;
      } else if (baseChar === 'T') {
        matBase1 = this.matT;
        matBase2 = this.matA;
      } else if (baseChar === 'G') {
        matBase1 = this.matG;
        matBase2 = this.matC;
      } else {
        matBase1 = this.matC;
        matBase2 = this.matG;
      }

      // Midpoint between strands (where hydrogen bonds form)
      const pMid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

      // Base 1 Cylinder (Strand 1 to Midpoint)
      this.createHalfRung(p1, pMid, matBase1);

      // Base 2 Cylinder (Midpoint to Strand 2)
      this.createHalfRung(pMid, p2, matBase2);

      // Hydrogen bond glowing node
      const hBond = new THREE.Mesh(this.hBondGeo, this.matH);
      hBond.position.copy(pMid);
      this.hydrogenBonds.push(hBond);
      this.group.add(hBond);
    }
  }

  private createHalfRung(
    pStart: THREE.Vector3,
    pEnd: THREE.Vector3,
    mat: THREE.MeshStandardMaterial,
  ): void {
    const dir = new THREE.Vector3().subVectors(pEnd, pStart);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);

    const cyl = new THREE.Mesh(this.bondCylGeo, mat);
    cyl.scale.set(1, len, 1);
    cyl.position.copy(mid);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

    this.baseMeshes.push(cyl);
    this.group.add(cyl);
  }

  /**
   * Updates gentle vertical floating bob without overriding user navigation.
   *
   * @param elapsed - Total elapsed time in seconds.
   * @param basePanY - Base vertical pan offset.
   */
  update(elapsed: number, basePanY = 0): void {
    this.group.position.y = basePanY + Math.sin(elapsed * 0.8) * 0.35;
  }

  /**
   * Clears all meshes from the DNA group.
   */
  clear(): void {
    this.backboneSpheres.forEach((m) => this.group.remove(m));
    this.baseMeshes.forEach((m) => this.group.remove(m));
    this.hydrogenBonds.forEach((m) => this.group.remove(m));
    this.backboneSpheres = [];
    this.baseMeshes = [];
    this.hydrogenBonds = [];
  }
}

