import * as THREE from 'three';
import { PeriodicElement } from '../models/elemente.types';

export interface TileMeshUserData {
  element: PeriodicElement;
  basePosition: THREE.Vector3;
  baseRotation: THREE.Euler;
  baseScale: THREE.Vector3;
}

/**
 * Service managing the 3D Holographic Cylindrical Periodic Table (Option A)
 * and the interactive 3D Bohr Atom Model simulation.
 */
export class PeriodicTable3DService {
  readonly group = new THREE.Group();
  private tiles: THREE.Mesh[] = [];
  private tileUserDatas: TileMeshUserData[] = [];

  // Raycasting & Interaction
  private hoveredTile: THREE.Mesh | null = null;

  // 3D Bohr Atom simulation group (shown when an element is focused)
  private atomGroup = new THREE.Group();
  private nucleusMesh: THREE.Mesh | null = null;
  private atomShells: {
    group: THREE.Group;
    electrons: { mesh: THREE.Mesh; ringRadius: number; speed: number; angle: number }[];
  }[] = [];

  // Material caches
  private textures: THREE.CanvasTexture[] = [];
  private sharedPlaneGeo = new THREE.PlaneGeometry(1.9, 2.3);

  /**
   * Builds the 3D Curved Cylindrical Holo-Wall layout for the given elements.
   *
   * @param elements - The 118 periodic table elements.
   */
  buildTable(elements: PeriodicElement[]): void {
    this.clear();

    const cylinderRadius = 32;
    const horizontalAngleStep = 0.075; // radians per group column
    const verticalStep = 2.75; // vertical height per period row

    elements.forEach((elem) => {
      // Determine effective column and row for layout
      let col = elem.group;
      let row = elem.period;

      // Lanthanides (57-71) in separate bottom row (row 8.5)
      if (elem.number >= 57 && elem.number <= 71) {
        col = elem.number - 57 + 3;
        row = 8.6;
      }
      // Actinides (89-103) in separate bottom row (row 9.6)
      else if (elem.number >= 89 && elem.number <= 103) {
        col = elem.number - 89 + 3;
        row = 9.7;
      }

      // Cylinder coordinates: wrap groups 1..18 around cylinder
      const angle = (col - 9.5) * horizontalAngleStep;
      const x = Math.sin(angle) * cylinderRadius;
      const z = -(Math.cos(angle) * cylinderRadius - cylinderRadius); // concave curve curving toward back
      // Row center is 5.35: Period 1 (row 1) and Actinides (row 9.7) are perfectly vertically centered around Y = 0
      const y = -(row - 5.35) * verticalStep;

      // Render tile texture onto canvas
      const texture = this.createTileTexture(elem);
      this.textures.push(texture);

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(this.sharedPlaneGeo, material);
      mesh.position.set(x, y, z);

      // Rotate tile to face the center of the cylinder arc
      mesh.rotation.y = -angle;

      const userData: TileMeshUserData = {
        element: elem,
        basePosition: mesh.position.clone(),
        baseRotation: mesh.rotation.clone(),
        baseScale: new THREE.Vector3(1, 1, 1),
      };
      mesh.userData = userData;

      this.tiles.push(mesh);
      this.tileUserDatas.push(userData);
      this.group.add(mesh);
    });

    // Add Bohr Atom group to scene (initially invisible or placed above)
    this.atomGroup.position.set(0, 0, 5);
    this.atomGroup.visible = false;
    this.group.add(this.atomGroup);
  }

  /**
   * Generates a high-resolution crisp Canvas texture for an element tile
   * featuring glassmorphic glowing border, chemical symbol, and German name.
   */
  private createTileTexture(elem: PeriodicElement): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 310;
    const ctx = canvas.getContext('2d')!;

    // Background gradient with translucent glass tint
    const bgGradient = ctx.createLinearGradient(0, 0, 256, 310);
    bgGradient.addColorStop(0, 'rgba(26, 32, 44, 0.88)');
    bgGradient.addColorStop(1, 'rgba(11, 15, 25, 0.95)');
    ctx.fillStyle = bgGradient;
    this.roundRect(ctx, 4, 4, 248, 302, 16);
    ctx.fill();

    // Glowing category border
    ctx.strokeStyle = elem.color;
    ctx.lineWidth = 4;
    ctx.shadowColor = elem.color;
    ctx.shadowBlur = 12;
    this.roundRect(ctx, 4, 4, 248, 302, 16);
    ctx.stroke();
    ctx.shadowBlur = 0; // reset shadow

    // Atomic number (top left)
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 26px "Singlet", "Singlet-Regular", "Sniglet", "Sniglet-Regular", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${elem.number}`, 20, 42);

    // Atomic mass (top right)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '500 16px "Singlet", "Singlet-Regular", "Sniglet", "Sniglet-Regular", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(elem.atomicMass, 236, 40);

    // Chemical Symbol (Center prominent)
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 88px "Singlet", "Singlet-Regular", "Sniglet", "Sniglet-Regular", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = elem.color;
    ctx.shadowBlur = 16;
    ctx.fillText(elem.symbol, 128, 155);
    ctx.shadowBlur = 0;

    // German Element Name
    ctx.fillStyle = elem.color;
    ctx.font = '500 22px "Singlet", "Singlet-Regular", "Sniglet", "Sniglet-Regular", sans-serif';
    ctx.fillText(elem.name, 128, 215);

    // Category pill at bottom
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.roundRect(ctx, 24, 245, 208, 38, 19);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '500 15px "Singlet", "Singlet-Regular", "Sniglet", "Sniglet-Regular", sans-serif';
    ctx.fillText(elem.categoryName, 128, 270);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /**
   * Performs raycasting against all element tiles.
   */
  raycast(raycaster: THREE.Raycaster): PeriodicElement | null {
    const intersects = raycaster.intersectObjects(this.tiles, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object as THREE.Mesh;
      if (this.hoveredTile !== hit) {
        this.resetHover();
        this.hoveredTile = hit;
        hit.scale.set(1.16, 1.16, 1.16);
      }
      return (hit.userData as TileMeshUserData).element;
    }

    this.resetHover();
    return null;
  }

  resetHover(): void {
    if (this.hoveredTile) {
      this.hoveredTile.scale.set(1, 1, 1);
      this.hoveredTile = null;
    }
  }

  /**
   * Filters tiles by matching search query or category/state.
   */
  filterElements(searchQuery: string, activeCategory: string | null, activeState: string | null): void {
    const q = searchQuery.trim().toLowerCase();

    this.tiles.forEach((tile) => {
      const elem = (tile.userData as TileMeshUserData).element;
      let visible = true;

      if (q) {
        const matchName = elem.name.toLowerCase().includes(q);
        const matchSymbol = elem.symbol.toLowerCase().includes(q);
        const matchNumber = elem.number.toString() === q;
        if (!matchName && !matchSymbol && !matchNumber) {
          visible = false;
        }
      }

      if (visible && activeCategory) {
        if (elem.category !== activeCategory) {
          visible = false;
        }
      }

      if (visible && activeState) {
        if (elem.state !== activeState) {
          visible = false;
        }
      }

      const mat = tile.material as THREE.MeshBasicMaterial;
      mat.opacity = visible ? 0.94 : 0.15;
    });
  }

  /**
   * Displays the 3D Bohr Atom Model simulation for the selected element.
   * Creates a glowing nucleus and orbiting electron shells.
   *
   * @param elem - The element to simulate.
   */
  showBohrAtom(elem: PeriodicElement): void {
    this.clearAtomSimulation();
    this.atomGroup.visible = true;

    // 1. Pulsing Nucleus
    const nucleusGeo = new THREE.SphereGeometry(0.85, 32, 32);
    const nucleusMat = new THREE.MeshBasicMaterial({
      color: elem.color,
      wireframe: false,
    });
    this.nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
    this.atomGroup.add(this.nucleusMesh);

    // Glowing nucleus halo
    const haloGeo = new THREE.SphereGeometry(1.2, 24, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.22,
      wireframe: true,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    this.atomGroup.add(halo);

    // 2. Electron Shells (Bohr model rings with lockstep electrons)
    const shells = elem.electronsPerShell || [1];
    const baseRadius = 2.4;
    const radiusStep = 1.35;

    const electronGeo = new THREE.SphereGeometry(0.20, 16, 16);
    const electronMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });

    shells.forEach((electronCount, shellIdx) => {
      const ringRadius = baseRadius + shellIdx * radiusStep;
      const shellGroup = new THREE.Group();

      // Distinct 3D orbital inclination for each shell (gyroscopic atomic look)
      const tiltAngle = (shellIdx / Math.max(shells.length, 1)) * Math.PI;
      shellGroup.rotation.x = Math.sin(tiltAngle) * 0.55 + 0.25;
      shellGroup.rotation.y = Math.cos(tiltAngle) * 0.65;
      shellGroup.rotation.z = shellIdx * 0.35;

      // Orbit ring line: drawn strictly in the local XY plane (Z = 0) of shellGroup
      const ringPoints: THREE.Vector3[] = [];
      const segments = 96;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        ringPoints.push(new THREE.Vector3(Math.cos(theta) * ringRadius, Math.sin(theta) * ringRadius, 0));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
      const ringMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
      });
      const ringLine = new THREE.LineLoop(ringGeo, ringMat);
      shellGroup.add(ringLine);

      // Place electrons directly on the shell inside shellGroup
      const shellElectrons: { mesh: THREE.Mesh; ringRadius: number; speed: number; angle: number }[] = [];
      for (let e = 0; e < electronCount; e++) {
        const electronMesh = new THREE.Mesh(electronGeo, electronMat);
        const initialAngle = (e / electronCount) * Math.PI * 2;
        // Kepler-like orbital speed: inner electrons travel faster than outer ones
        const speed = 1.4 / Math.sqrt(shellIdx + 1);

        // Position electron exactly on the ring in the shell's local coordinates
        electronMesh.position.set(
          Math.cos(initialAngle) * ringRadius,
          Math.sin(initialAngle) * ringRadius,
          0,
        );

        // Add electron directly to shellGroup so it is permanently locked onto ringLine
        shellGroup.add(electronMesh);

        shellElectrons.push({
          mesh: electronMesh,
          ringRadius,
          speed,
          angle: initialAngle,
        });
      }

      this.atomShells.push({
        group: shellGroup,
        electrons: shellElectrons,
      });

      this.atomGroup.add(shellGroup);
    });
  }

  /**
   * Hides the Bohr atom simulation.
   */
  hideBohrAtom(): void {
    this.atomGroup.visible = false;
    this.clearAtomSimulation();
  }

  private clearAtomSimulation(): void {
    while (this.atomGroup.children.length > 0) {
      const child = this.atomGroup.children[0];
      if (child instanceof THREE.Group) {
        while (child.children.length > 0) {
          const grandChild = child.children[0];
          if (grandChild instanceof THREE.Mesh || grandChild instanceof THREE.LineLoop) {
            grandChild.geometry.dispose();
          }
          child.remove(grandChild);
        }
      } else if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
      this.atomGroup.remove(child);
    }
    this.nucleusMesh = null;
    this.atomShells = [];
  }

  /**
   * Updates animations per frame (Bohr electron orbits, breathing nucleus).
   */
  update(elapsed: number): void {
    if (this.atomGroup.visible) {
      this.atomGroup.rotation.y = elapsed * 0.12;

      if (this.nucleusMesh) {
        const pulse = 1.0 + Math.sin(elapsed * 4) * 0.08;
        this.nucleusMesh.scale.set(pulse, pulse, pulse);
      }

      this.atomShells.forEach((shell) => {
        shell.electrons.forEach((e) => {
          e.angle += e.speed * 0.025;
          // Coordinates in shellGroup's local coordinate system: always exactly on the ring!
          e.mesh.position.set(
            Math.cos(e.angle) * e.ringRadius,
            Math.sin(e.angle) * e.ringRadius,
            0,
          );
        });
      });
    }
  }

  /**
   * Preloads and registers the Singlet font faces in document.fonts
   * ensuring that 2D canvas textures render strictly with the Singlet font.
   */
  async ensureFontsLoaded(): Promise<void> {
    if (typeof document === 'undefined') return;

    if (typeof FontFace !== 'undefined' && document.fonts) {
      const fontConfigs = [
        { family: 'Singlet', url: 'fonts/Singlet/Singlet-Regular.ttf', weight: '500' },
        { family: 'Singlet', url: 'fonts/Singlet/Singlet-Regular.ttf', weight: '400' },
        { family: 'Singlet', url: 'fonts/Singlet/Singlet-ExtraBold.ttf', weight: '700' },
        { family: 'Singlet', url: 'fonts/Singlet/Singlet-ExtraBold.ttf', weight: 'bold' },
        { family: 'Singlet-Regular', url: 'fonts/Singlet/Singlet-Regular.ttf', weight: '500' },
        { family: 'Singlet-Regular', url: 'fonts/Singlet/Singlet-Regular.ttf', weight: '400' },
        { family: 'Singlet-ExtraBold', url: 'fonts/Singlet/Singlet-ExtraBold.ttf', weight: '700' },
        { family: 'Sniglet', url: 'fonts/Singlet/Sniglet-Regular.ttf', weight: '500' },
        { family: 'Sniglet', url: 'fonts/Singlet/Sniglet-Regular.ttf', weight: '400' },
        { family: 'Sniglet', url: 'fonts/Singlet/Sniglet-ExtraBold.ttf', weight: '700' },
        { family: 'Sniglet', url: 'fonts/Singlet/Sniglet-ExtraBold.ttf', weight: 'bold' },
        { family: 'Sniglet-Regular', url: 'fonts/Singlet/Sniglet-Regular.ttf', weight: '500' },
        { family: 'Sniglet-Regular', url: 'fonts/Singlet/Sniglet-Regular.ttf', weight: '400' },
        { family: 'Sniglet-ExtraBold', url: 'fonts/Singlet/Sniglet-ExtraBold.ttf', weight: '700' },
      ];

      await Promise.all(
        fontConfigs.map(async (cfg) => {
          try {
            const face = new FontFace(cfg.family, `url(${cfg.url})`, {
              weight: cfg.weight,
              style: 'normal',
              display: 'swap',
            });
            await face.load();
            document.fonts.add(face);
          } catch {
            // Ignore if already registered
          }
        })
      );

      try {
        await Promise.all([
          document.fonts.load('500 88px Singlet'),
          document.fonts.load('500 26px Singlet'),
          document.fonts.load('500 22px Singlet'),
          document.fonts.load('500 16px Singlet'),
          document.fonts.load('500 15px Singlet'),
          document.fonts.load('500 88px Sniglet'),
        ]);
        await document.fonts.ready;
      } catch {
        // Fallback
      }
    }
  }

  /**
   * Refreshes all 3D element tile textures once fonts (Sniglet/Singlet) are loaded.
   */
  refreshTextures(elements: PeriodicElement[]): void {
    if (this.tiles.length === 0) return;
    elements.forEach((elem, i) => {
      const tile = this.tiles[i];
      if (!tile) return;
      const oldTex = this.textures[i];
      const newTex = this.createTileTexture(elem);
      (tile.material as THREE.MeshBasicMaterial).map = newTex;
      (tile.material as THREE.MeshBasicMaterial).needsUpdate = true;
      if (oldTex) oldTex.dispose();
      this.textures[i] = newTex;
    });
  }

  /**
   * Cleanly disposes all resources.
   */
  clear(): void {
    this.clearAtomSimulation();
    this.tiles.forEach((t) => {
      t.geometry.dispose();
      (t.material as THREE.Material).dispose();
      this.group.remove(t);
    });
    this.tiles = [];
    this.tileUserDatas = [];
    this.textures.forEach((tex) => tex.dispose());
    this.textures = [];
  }
}

