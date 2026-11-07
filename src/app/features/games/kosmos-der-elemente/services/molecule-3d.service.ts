import * as THREE from 'three';
import { MoleculeDef } from '../models/elemente.types';

/**
 * Service that constructs 3D Ball-and-Stick (Kugeln und Stäbe) representations of molecules.
 * Features CPK atom coloration, accurate 3D spatial bonds, double/triple bonds,
 * and smooth rotational physics.
 */
export class Molecule3DService {
  readonly group = new THREE.Group();
  private currentMolecule: MoleculeDef | null = null;

  private atomMeshes: THREE.Mesh[] = [];
  private bondMeshes: THREE.Mesh[] = [];

  // Reusable geometries and materials
  private sphereGeo = new THREE.SphereGeometry(1, 28, 28);
  private bondGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 16);
  private bondMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.25,
    metalness: 0.65,
  });

  /**
   * Sets and renders the active molecule.
   *
   * @param mol - The molecule definition to construct.
   */
  setMolecule(mol: MoleculeDef): void {
    this.clear();
    this.currentMolecule = mol;

    const scale = 2.4; // spatial spread multiplier

    // 1. Build Atoms (Kugeln)
    mol.atoms.forEach((atom) => {
      const atomMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(atom.color),
        roughness: 0.35,
        metalness: 0.2,
      });

      const mesh = new THREE.Mesh(this.sphereGeo, atomMat);
      mesh.scale.setScalar(atom.radius * 2.2);
      mesh.position.set(atom.x * scale, atom.y * scale, atom.z * scale);
      mesh.userData = { atom };

      this.atomMeshes.push(mesh);
      this.group.add(mesh);
    });

    // 2. Build Bonds (Stäbe)
    mol.bonds.forEach((bond) => {
      const atomA = mol.atoms[bond.atomA];
      const atomB = mol.atoms[bond.atomB];
      if (!atomA || !atomB) return;

      const pA = new THREE.Vector3(atomA.x * scale, atomA.y * scale, atomA.z * scale);
      const pB = new THREE.Vector3(atomB.x * scale, atomB.y * scale, atomB.z * scale);

      if (bond.order === 1) {
        this.createCylinderBond(pA, pB, 0);
      } else if (bond.order === 2) {
        this.createCylinderBond(pA, pB, 0.12);
        this.createCylinderBond(pA, pB, -0.12);
      } else if (bond.order === 3) {
        this.createCylinderBond(pA, pB, 0);
        this.createCylinderBond(pA, pB, 0.16);
        this.createCylinderBond(pA, pB, -0.16);
      }
    });

    // Centering: compute bounding box and recenter
    const box = new THREE.Box3().setFromObject(this.group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    this.group.children.forEach((c) => {
      c.position.sub(center);
    });
  }

  /**
   * Constructs a single cylindrical bond between two 3D positions with an optional lateral offset.
   */
  private createCylinderBond(pA: THREE.Vector3, pB: THREE.Vector3, offsetDist = 0): void {
    const dir = new THREE.Vector3().subVectors(pB, pA);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);

    // Lateral perpendicular vector for parallel multi-bonds
    if (offsetDist !== 0) {
      const up = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const perp = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(offsetDist);
      mid.add(perp);
    }

    const cylinder = new THREE.Mesh(this.bondGeo, this.bondMat);
    cylinder.scale.set(1, len, 1);
    cylinder.position.copy(mid);

    // Orient cylinder along direction vector
    cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

    this.bondMeshes.push(cylinder);
    this.group.add(cylinder);
  }

  /**
   * Called on each frame.
   * Auto-rotation is intentionally removed so the user has full manual control via mouse/pointer drag.
   */
  update(_elapsed: number): void {
    // Intentionally no automatic self-rotation:
    // Molecule orientation is controlled directly by user mouse drag in kosmos-der-elemente.component.ts
  }

  /**
   * Raycasts against all atom and bond meshes in the active molecule.
   *
   * @param raycaster - The THREE.Raycaster instance.
   * @returns The active MoleculeDef if hit, or null if no part was hit.
   */
  raycast(raycaster: THREE.Raycaster): MoleculeDef | null {
    if (!this.group.visible || this.group.children.length === 0) {
      return null;
    }
    this.group.updateMatrixWorld(true);
    const intersects = raycaster.intersectObjects(this.group.children, true);
    if (intersects.length > 0) {
      return this.currentMolecule;
    }
    return null;
  }

  getCurrentMolecule(): MoleculeDef | null {
    return this.currentMolecule;
  }

  /**
   * Clears all meshes from the molecule group.
   */
  clear(): void {
    this.atomMeshes.forEach((mesh) => {
      (mesh.material as THREE.Material).dispose();
      this.group.remove(mesh);
    });
    this.bondMeshes.forEach((mesh) => {
      this.group.remove(mesh);
    });
    this.atomMeshes = [];
    this.bondMeshes = [];
    this.currentMolecule = null;
  }
}

