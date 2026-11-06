import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  computed,
  HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import * as THREE from 'three';
import { AudioService } from '../../../core/services/audio.service';
import {
  CosmosViewMode,
  PeriodicElement,
  MoleculeDef,
  GenomeSpecies,
} from './models/elemente.types';
import { PERIODIC_ELEMENTS } from './data/periodic-elements.data';
import { MOLECULES_LIBRARY } from './data/molecules.data';
import { GENOMES_LIBRARY } from './data/genomes.data';
import { StarfieldBackgroundService } from './services/starfield-background.service';
import { PeriodicTable3DService } from './services/periodic-table-3d.service';
import { Molecule3DService } from './services/molecule-3d.service';
import { Dna3DService } from './services/dna-3d.service';
import { KosmosHeaderComponent } from './components/kosmos-header/kosmos-header.component';
import { KosmosDockComponent } from './components/kosmos-dock/kosmos-dock.component';
import { KosmosDetailModalComponent } from './components/kosmos-detail-modal/kosmos-detail-modal.component';

/**
 * Main 3D Game Component for 'Kosmos der Elemente & des Lebens'.
 * Features:
 * 1. 3D Periodic Table in curved cylindrical holo-wall (Option A, Google Arts & Culture inspired)
 * 2. 3D Ball-and-Stick Molecules Cosmos (CPK colors, real bonds)
 * 3. 3D DNA Genomes Observatory (50 Species of animals and plants)
 * 4. Starfield particle background with 3,200 stars & stardust from 'goldener-schnitt'
 * 5. Frosted glassmorphism and pill-shaped HUD dock & modal cards.
 */
@Component({
  selector: 'app-kosmos-der-elemente',
  standalone: true,
  imports: [
    KosmosHeaderComponent,
    KosmosDockComponent,
    KosmosDetailModalComponent,
  ],
  templateUrl: './kosmos-der-elemente.component.html',
  styleUrl: './kosmos-der-elemente.component.scss',
})
export class KosmosDerElementeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  // Helper 3D Services
  private readonly starfieldService = new StarfieldBackgroundService();
  private readonly periodicTableService = new PeriodicTable3DService();
  private readonly moleculeService = new Molecule3DService();
  private readonly dnaService = new Dna3DService();

  // Data
  readonly elements = PERIODIC_ELEMENTS;
  readonly molecules = MOLECULES_LIBRARY;
  readonly genomes = GENOMES_LIBRARY;

  // ---------------------------------------------------------------------------
  // Reactive Signals for State
  // ---------------------------------------------------------------------------
  readonly activeMode = signal<CosmosViewMode>('periodic');
  readonly searchQuery = signal<string>('');
  readonly activeCategory = signal<string | null>(null);
  readonly activeState = signal<string | null>(null);
  readonly activeSpeciesGroup = signal<string | null>(null);

  readonly selectedElement = signal<PeriodicElement | null>(null);
  readonly selectedMolecule = signal<MoleculeDef | null>(this.molecules[0]);
  readonly selectedSpecies = signal<GenomeSpecies | null>(this.genomes[0]);
  readonly isBohrActive = signal<boolean>(false);
  readonly isSoundEnabled = signal<boolean>(true);
  readonly isDetailModalOpen = signal<boolean>(false);

  // Filtered molecules & species based on search/group
  readonly filteredMolecules = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.molecules;
    return this.molecules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.formula.toLowerCase().includes(q) ||
        m.categoryLabel.toLowerCase().includes(q),
    );
  });

  readonly filteredSpecies = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const group = this.activeSpeciesGroup();
    return this.genomes.filter((s) => {
      const matchQuery =
        !q ||
        s.commonName.toLowerCase().includes(q) ||
        s.scientificName.toLowerCase().includes(q) ||
        s.groupLabel.toLowerCase().includes(q);
      const matchGroup = !group || s.group === group;
      return matchQuery && matchGroup;
    });
  });

  readonly itemCountLabel = computed(() => {
    const mode = this.activeMode();
    if (mode === 'periodic') return '118 Elemente';
    if (mode === 'molecules') return `${this.filteredMolecules().length} Stoffe`;
    return `${this.filteredSpecies().length} Spezies`;
  });

  // ---------------------------------------------------------------------------
  // Three.js State
  // ---------------------------------------------------------------------------
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private animationFrameId: number | null = null;
  private raycaster = new THREE.Raycaster();
  private mouseNDC = new THREE.Vector2(9999, 9999);

  // Orbit / Pan physics
  private targetRotY = 0;
  private targetRotX = 0;
  private currentRotY = 0;
  private currentRotX = 0;
  private targetPanX = 0;
  private currentPanX = 0;
  private targetPanY = 0;
  private currentPanY = 0;
  private targetCameraZ = 48;
  private currentCameraZ = 48;

  // Keyboard navigation (WASD & Arrow Keys)
  private readonly activeKeys = new Set<string>();

  // Pointer drag state for smooth direct manipulation
  private isPointerDown = false;
  private dragOriginX = 0;
  private dragOriginY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerVelocityX = 0;
  private pointerVelocityY = 0;
  private hasDragged = false;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  ngAfterViewInit(): void {
    this.initThree();
    this.setupViewMode('periodic');
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.activeKeys.clear();
    if (this.scene) {
      this.starfieldService.destroy(this.scene);
    }
    this.periodicTableService.clear();
    this.moleculeService.clear();
    this.dnaService.clear();
    this.renderer?.dispose();
  }

  // ---------------------------------------------------------------------------
  // Three.js Setup
  // ---------------------------------------------------------------------------
  private initThree(): void {
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene with obsidian cosmic atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07080d);
    this.scene.fog = new THREE.FogExp2(0x07080d, 0.003);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 2000);
    this.camera.position.set(0, 0, this.currentCameraZ);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.4);
    dirLight1.position.set(20, 30, 25);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xf472b6, 0.8);
    dirLight2.position.set(-25, -20, 20);
    this.scene.add(dirLight2);

    // 5. Starfield & Cosmic Stardust Background
    this.starfieldService.init(this.scene);

    // 6. 3D Services Groups (use 'YXZ' rotation order for intuitive turntable & gimbal-free orbit)
    this.periodicTableService.group.rotation.order = 'YXZ';
    this.periodicTableService.buildTable(this.elements);
    this.scene.add(this.periodicTableService.group);

    this.moleculeService.group.rotation.order = 'YXZ';
    this.scene.add(this.moleculeService.group);
    this.moleculeService.group.visible = false;

    this.dnaService.group.rotation.order = 'YXZ';
    this.scene.add(this.dnaService.group);
    this.dnaService.group.visible = false;
  }

  // ---------------------------------------------------------------------------
  // View Modes Setup & Transitions
  // ---------------------------------------------------------------------------
  setMode(mode: CosmosViewMode): void {
    if (this.activeMode() === mode) return;

    this.activeMode.set(mode);
    this.searchQuery.set('');
    this.setupViewMode(mode);

    if (this.isSoundEnabled()) {
      this.audioService.playBubbleHover();
    }
  }

  private setupViewMode(mode: CosmosViewMode): void {
    this.periodicTableService.group.visible = mode === 'periodic';
    this.moleculeService.group.visible = mode === 'molecules';
    this.dnaService.group.visible = mode === 'genomes';

    this.targetRotX = 0;
    this.targetRotY = 0;
    this.currentRotX = 0;
    this.currentRotY = 0;
    this.targetPanX = 0;
    this.currentPanX = 0;
    this.targetPanY = 0;
    this.currentPanY = 0;
    this.activeKeys.clear();
    this.periodicTableService.group.position.set(0, 0, 0);
    this.moleculeService.group.position.set(0, 0, 0);
    this.dnaService.group.position.set(0, 0, 0);

    if (mode === 'periodic') {
      this.targetCameraZ = 48;
      if (this.selectedElement()) {
        this.isDetailModalOpen.set(true);
      } else {
        this.isDetailModalOpen.set(false);
      }
    } else if (mode === 'molecules') {
      this.targetCameraZ = 12;
      const currentMol = this.selectedMolecule() || this.molecules[0];
      this.moleculeService.setMolecule(currentMol);
      this.isDetailModalOpen.set(true);
    } else if (mode === 'genomes') {
      this.targetCameraZ = 16;
      const currentSpec = this.selectedSpecies() || this.genomes[0];
      this.dnaService.buildHelix(currentSpec);
      this.isDetailModalOpen.set(true);
    }
  }

  // ---------------------------------------------------------------------------
  // Selection Handlers
  // ---------------------------------------------------------------------------
  onSelectElement(elem: PeriodicElement): void {
    this.selectedElement.set(elem);
    this.isDetailModalOpen.set(true);
    if (this.isSoundEnabled()) {
      this.audioService.playWaterdropToneOn(0.9);
    }
    if (this.isBohrActive()) {
      this.periodicTableService.showBohrAtom(elem);
    }
  }

  onSelectMolecule(mol: MoleculeDef): void {
    this.selectedMolecule.set(mol);
    this.moleculeService.setMolecule(mol);
    this.isDetailModalOpen.set(true);
    if (this.isSoundEnabled()) {
      this.audioService.playWaterdropToneOn(0.9);
    }
  }

  onSelectSpecies(spec: GenomeSpecies): void {
    this.selectedSpecies.set(spec);
    this.dnaService.buildHelix(spec);
    this.isDetailModalOpen.set(true);
    if (this.isSoundEnabled()) {
      this.audioService.playWaterdropToneOn(0.9);
    }
  }

  toggleBohrAtom(): void {
    const next = !this.isBohrActive();
    this.isBohrActive.set(next);
    const elem = this.selectedElement();
    if (next && elem) {
      this.periodicTableService.showBohrAtom(elem);
    } else {
      this.periodicTableService.hideBohrAtom();
    }
    if (this.isSoundEnabled()) {
      this.audioService.playBubbleHover();
    }
  }

  // ---------------------------------------------------------------------------
  // Filters & Search
  // ---------------------------------------------------------------------------
  onSearchChange(query: string): void {
    this.activeKeys.clear();
    this.searchQuery.set(query);
    if (this.activeMode() === 'periodic') {
      this.periodicTableService.filterElements(
        query,
        this.activeCategory(),
        this.activeState(),
      );
    }
  }

  onFilterCategory(cat: string | null): void {
    this.activeCategory.set(cat);
    this.periodicTableService.filterElements(
      this.searchQuery(),
      cat,
      this.activeState(),
    );
  }

  onFilterState(state: string | null): void {
    this.activeState.set(state);
    this.periodicTableService.filterElements(
      this.searchQuery(),
      this.activeCategory(),
      state,
    );
  }

  onFilterSpeciesGroup(group: string | null): void {
    this.activeSpeciesGroup.set(group);
    const available = this.filteredSpecies();
    if (available.length > 0) {
      const current = this.selectedSpecies();
      if (!current || !available.some((s) => s.id === current.id)) {
        this.onSelectSpecies(available[0]);
      }
    }
  }

  onPrevSpecies(): void {
    const list = this.filteredSpecies();
    if (list.length === 0) return;
    const current = this.selectedSpecies();
    const idx = list.findIndex((s) => s.id === current?.id);
    const prevIdx = (idx - 1 + list.length) % list.length;
    this.onSelectSpecies(list[prevIdx]);
  }

  onNextSpecies(): void {
    const list = this.filteredSpecies();
    if (list.length === 0) return;
    const current = this.selectedSpecies();
    const idx = list.findIndex((s) => s.id === current?.id);
    const nextIdx = (idx + 1) % list.length;
    this.onSelectSpecies(list[nextIdx]);
  }

  // ---------------------------------------------------------------------------
  // Pointer & Orbit Controls
  // ---------------------------------------------------------------------------
  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.isPointerDown = true;
    this.hasDragged = false;
    this.dragOriginX = event.clientX;
    this.dragOriginY = event.clientY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.pointerVelocityX = 0;
    this.pointerVelocityY = 0;

    const target = event.currentTarget as HTMLElement;
    if (target?.setPointerCapture) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Ignored
      }
    }
  }

  onPointerMove(event: PointerEvent): void {
    const container = this.containerRef.nativeElement;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Normalised Device Coordinates for Raycasting (-1 to +1)
    if (rect.width > 0 && rect.height > 0) {
      this.mouseNDC.x = (mouseX / rect.width) * 2 - 1;
      this.mouseNDC.y = -(mouseY / rect.height) * 2 + 1;
    }

    if (this.isPointerDown) {
      const totalDist = Math.hypot(
        event.clientX - this.dragOriginX,
        event.clientY - this.dragOriginY,
      );

      // Register drag once moved more than 3px from initial click point
      if (!this.hasDragged && totalDist > 3) {
        this.hasDragged = true;
        if (this.activeMode() === 'periodic') {
          this.periodicTableService.resetHover();
        }
      }

      const deltaX = event.clientX - this.lastPointerX;
      const deltaY = event.clientY - this.lastPointerY;
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;

      if (this.hasDragged) {
        // Direct, proportional angular rotation speed
        const rotSpeed = 0.0055;
        const velX = deltaX * rotSpeed;
        const velY = deltaY * rotSpeed;

        this.pointerVelocityX = velX;
        this.pointerVelocityY = velY;

        this.targetRotY += velX;

        if (this.activeMode() === 'periodic') {
          this.targetRotX = Math.max(
            -0.70,
            Math.min(0.70, this.targetRotX + velY),
          );
        } else if (this.activeMode() === 'genomes') {
          this.targetRotX = Math.max(
            -0.90,
            Math.min(0.90, this.targetRotX + velY),
          );
        } else {
          // Molecule mode: Full 360° horizontal turntable + up to 85° vertical tilt
          // Clamping to [-1.48, 1.48] prevents gimbal lock and inverted controls
          this.targetRotX = Math.max(
            -1.48,
            Math.min(1.48, this.targetRotX + velY),
          );
        }
      }
    } else {
      // Raycasting for periodic table hover only when not dragging
      if (this.activeMode() === 'periodic') {
        this.raycaster.setFromCamera(this.mouseNDC, this.camera);
        this.periodicTableService.raycast(this.raycaster);
      }
    }
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    const target = event.currentTarget as HTMLElement;
    if (target?.releasePointerCapture) {
      try {
        target.releasePointerCapture(event.pointerId);
      } catch {
        // Ignored
      }
    }

    if (this.hasDragged) {
      // Smooth momentum carry-forward on flick release
      const momentumMultiplier = 4.0;
      this.targetRotY += this.pointerVelocityX * momentumMultiplier;

      if (this.activeMode() === 'periodic') {
        this.targetRotX = Math.max(
          -0.70,
          Math.min(0.70, this.targetRotX + this.pointerVelocityY * momentumMultiplier),
        );
      } else if (this.activeMode() === 'genomes') {
        this.targetRotX = Math.max(
          -0.90,
          Math.min(0.90, this.targetRotX + this.pointerVelocityY * momentumMultiplier),
        );
      } else {
        this.targetRotX = Math.max(
          -1.48,
          Math.min(1.48, this.targetRotX + this.pointerVelocityY * momentumMultiplier),
        );
      }
    } else {
      // Handle click only when user didn't drag
      this.handleClickAtPointer();
    }
  }

  private handleClickAtPointer(): void {
    if (this.activeMode() === 'periodic') {
      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      const hitElement = this.periodicTableService.raycast(this.raycaster);
      if (hitElement) {
        this.onSelectElement(hitElement);
      }
    }
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomSpeed = 0.025;
    const minZ = this.activeMode() === 'periodic' ? 18 : 6;
    const maxZ = this.activeMode() === 'periodic' ? 75 : 36;

    this.targetCameraZ = Math.max(
      minZ,
      Math.min(maxZ, this.targetCameraZ + event.deltaY * zoomSpeed),
    );
  }

  resetCamera(): void {
    this.targetRotX = 0;
    this.targetRotY = 0;
    this.currentRotX = 0;
    this.currentRotY = 0;
    this.targetPanX = 0;
    this.currentPanX = 0;
    this.targetPanY = 0;
    this.currentPanY = 0;
    this.activeKeys.clear();
    this.periodicTableService.group.position.set(0, 0, 0);
    this.moleculeService.group.position.set(0, 0, 0);
    this.dnaService.group.position.set(0, 0, 0);

    if (this.activeMode() === 'periodic') {
      this.targetCameraZ = 48;
    } else if (this.activeMode() === 'molecules') {
      this.targetCameraZ = 12;
    } else {
      this.targetCameraZ = 16;
    }
    if (this.isSoundEnabled()) {
      this.audioService.playBubbleHover();
    }
  }

  toggleSound(): void {
    this.isSoundEnabled.update((v) => !v);
  }

  leaveGame(): void {
    this.router.navigate(['/']);
  }

  closeDetailModal(): void {
    this.isDetailModalOpen.set(false);
  }

  // ---------------------------------------------------------------------------
  // Keyboard Navigation (WASD & Arrow Keys)
  // ---------------------------------------------------------------------------
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target as HTMLElement)?.isContentEditable
    ) {
      this.activeKeys.clear();
      return;
    }

    const key = event.key.toLowerCase();
    const code = event.code;

    const isNavKey =
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      key === 'w' ||
      key === 'a' ||
      key === 's' ||
      key === 'd' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      key === 'arrowup' ||
      key === 'arrowdown' ||
      key === 'arrowleft' ||
      key === 'arrowright';

    if (isNavKey) {
      this.activeKeys.add(code || key);
      event.preventDefault();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    const code = event.code;
    if (code) this.activeKeys.delete(code);
    if (key) this.activeKeys.delete(key);
  }

  @HostListener('window:blur')
  onWindowBlur(): void {
    this.activeKeys.clear();
  }

  private handleKeyboardNavigation(dt: number): void {
    if (this.activeKeys.size === 0) return;

    const isUp =
      this.activeKeys.has('KeyW') ||
      this.activeKeys.has('w') ||
      this.activeKeys.has('ArrowUp') ||
      this.activeKeys.has('arrowup');

    const isDown =
      this.activeKeys.has('KeyS') ||
      this.activeKeys.has('s') ||
      this.activeKeys.has('ArrowDown') ||
      this.activeKeys.has('arrowdown');

    const isLeft =
      this.activeKeys.has('KeyA') ||
      this.activeKeys.has('a') ||
      this.activeKeys.has('ArrowLeft') ||
      this.activeKeys.has('arrowleft');

    const isRight =
      this.activeKeys.has('KeyD') ||
      this.activeKeys.has('d') ||
      this.activeKeys.has('ArrowRight') ||
      this.activeKeys.has('arrowright');

    if (this.activeMode() === 'periodic') {
      // Horizontal pan (pure lateral translation in space, no tilt/rotation):
      // Left (A) shifts view left in space, Right (D) shifts view right in space
      const horizSpeed = 16.0;
      if (isLeft) {
        this.targetPanX = Math.max(-24.0, this.targetPanX - horizSpeed * dt);
      }
      if (isRight) {
        this.targetPanX = Math.min(24.0, this.targetPanX + horizSpeed * dt);
      }

      // Vertical pan: Up (W) moves camera up to Period 1, Down (S) moves camera down to Period 7 & Actinides
      const vertSpeed = 14.0;
      if (isUp) {
        this.targetPanY = Math.min(12.0, this.targetPanY + vertSpeed * dt);
      }
      if (isDown) {
        this.targetPanY = Math.max(-12.0, this.targetPanY - vertSpeed * dt);
      }
    } else if (this.activeMode() === 'molecules') {
      const panSpeed = 12.0;
      if (isLeft) this.targetPanX = Math.max(-12.0, this.targetPanX - panSpeed * dt);
      if (isRight) this.targetPanX = Math.min(12.0, this.targetPanX + panSpeed * dt);
      if (isUp) this.targetPanY = Math.min(10.0, this.targetPanY + panSpeed * dt);
      if (isDown) this.targetPanY = Math.max(-10.0, this.targetPanY - panSpeed * dt);
    } else if (this.activeMode() === 'genomes') {
      const panSpeed = 12.0;
      if (isLeft) this.targetPanX = Math.max(-14.0, this.targetPanX - panSpeed * dt);
      if (isRight) this.targetPanX = Math.min(14.0, this.targetPanX + panSpeed * dt);
      if (isUp) this.targetPanY = Math.min(10.0, this.targetPanY + panSpeed * dt);
      if (isDown) this.targetPanY = Math.max(-10.0, this.targetPanY - panSpeed * dt);
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.containerRef || !this.renderer || !this.camera) return;
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // ---------------------------------------------------------------------------
  // Render Loop
  // ---------------------------------------------------------------------------
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();

    // WASD & Arrow Keys Navigation
    this.handleKeyboardNavigation(dt);

    // Responsive frame-rate independent interpolation:
    // When dragging with mouse, high responsiveness (36.0) for direct, non-laggy control.
    // When released, smooth damping (16.0) for buttery gliding.
    const rotSpeedFactor = this.isPointerDown ? 36.0 : 16.0;
    const rotLerp = 1.0 - Math.exp(-rotSpeedFactor * dt);
    this.currentRotY += (this.targetRotY - this.currentRotY) * rotLerp;
    this.currentRotX += (this.targetRotX - this.currentRotX) * rotLerp;

    const panSpeedFactor = this.activeKeys.size > 0 ? 30.0 : 16.0;
    const panLerp = 1.0 - Math.exp(-panSpeedFactor * dt);
    this.currentPanX += (this.targetPanX - this.currentPanX) * panLerp;
    this.currentPanY += (this.targetPanY - this.currentPanY) * panLerp;

    const camLerp = 1.0 - Math.exp(-12.0 * dt);
    this.currentCameraZ +=
      (this.targetCameraZ - this.currentCameraZ) * camLerp;

    this.camera.position.z = this.currentCameraZ;

    // Update active 3D group positions & rotations
    if (this.activeMode() === 'periodic') {
      this.periodicTableService.group.position.x = -this.currentPanX;
      this.periodicTableService.group.position.y = -this.currentPanY;
      this.periodicTableService.group.rotation.y = this.currentRotY;
      this.periodicTableService.group.rotation.x = this.currentRotX;
      this.periodicTableService.update(elapsed);
    } else if (this.activeMode() === 'molecules') {
      this.moleculeService.group.position.x = -this.currentPanX;
      this.moleculeService.group.position.y = -this.currentPanY;
      this.moleculeService.group.rotation.y = this.currentRotY;
      this.moleculeService.group.rotation.x = this.currentRotX;
      this.moleculeService.update(elapsed);
    } else if (this.activeMode() === 'genomes') {
      this.dnaService.group.position.x = -this.currentPanX;
      this.dnaService.update(elapsed, -this.currentPanY);
      this.dnaService.group.rotation.y = this.currentRotY;
      this.dnaService.group.rotation.x = this.currentRotX;
    }

    // Update background starfield
    this.starfieldService.update(elapsed);

    // Render frame
    this.renderer.render(this.scene, this.camera);
  };
}
