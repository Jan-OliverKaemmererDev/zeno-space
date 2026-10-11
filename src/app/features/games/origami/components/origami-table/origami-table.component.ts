import {
  Component,
  ElementRef,
  ViewChild,
  OnDestroy,
  NgZone,
  inject,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrigamiStateService } from '../../services/origami-state.service';
import { FoldAnimation, OrigamiPaperStyle, OrigamiStep, PaperFacet } from '../../models/origami.models';

interface Point3D {
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
  w: number;
}

interface ActiveFoldAnimation {
  type: 'flap' | 'turnover' | 'squash';
  startTime: number;
  duration: number;
  pivotGroup?: THREE.Group;
  axis?: THREE.Vector3;
  startAngle?: number;
  targetAngle?: number;
  creaseFlashMaterial?: THREE.LineBasicMaterial;
}

/**
 * Interactive 3D desktop workspace for the Origami zen game using Three.js.
 * The paper model hovers freely above the wooden desk without any surrounding frame or depression.
 * Renders authentic physical 3D folding animations (flaps folding over hinges, sheet turnover, crease flashes)
 * and allows free 3D mouse-drag rotation around itself.
 */
@Component({
  selector: 'app-origami-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './origami-table.component.html',
  styleUrl: './origami-table.component.scss',
})
export class OrigamiTableComponent implements OnDestroy {
  readonly state = inject(OrigamiStateService);
  private readonly ngZone = inject(NgZone);

  /** Whether the user is currently holding the mouse button and rotating the 3D model */
  readonly isDragging = signal<boolean>(false);

  private canvasElement?: HTMLCanvasElement;
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private origamiModelGroup?: THREE.Group;
  private contactShadowMesh?: THREE.Mesh;
  private animationFrameId?: number;
  private resizeObserver?: ResizeObserver;

  // Elevation height of the origami model hovering cleanly above the wooden desk plane
  private readonly hoverZ = 0.22;

  // Viewport camera and model rotation parameters
  private readonly defaultRotX = 0.38; // Slightly tilted forward (~22 deg) for optimal 3D perspective
  private readonly defaultRotY = 0.0;
  private readonly defaultZoom = 7.2;

  private currentRotX = 0.38;
  private currentRotY = 0.0;
  private targetRotX = 0.38;
  private targetRotY = 0.0;
  private targetZoom = 7.2;

  private isPointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Active 3D physical folding animation state
  private activeFoldAnimation?: ActiveFoldAnimation;

  // Procedural texture cache for authentic Japanese Washi patterns
  private readonly textureCache = new Map<string, THREE.CanvasTexture>();

  /**
   * Dynamically tracks when the canvas element enters or leaves the DOM.
   */
  @ViewChild('origamiCanvas') set canvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    if (ref && ref.nativeElement !== this.canvasElement) {
      this.canvasElement = ref.nativeElement;
      this.initThree();
    } else if (!ref && this.canvasElement) {
      this.cleanupThree();
      this.canvasElement = undefined;
    }
  }

  constructor() {
    // Reactively update 3D meshes whenever step, paper color, or folding state changes
    effect(() => {
      const step = this.state.currentStep();
      const pattern = this.state.selectedPattern();
      const stepIdx = this.state.currentStepIndex();
      const paperStyle = this.state.selectedPaperStyle();
      const showGuides = this.state.showGuideLines();
      const isFolding = this.state.isFolding();

      if (this.origamiModelGroup && step) {
        if (isFolding && pattern && stepIdx < pattern.steps.length - 1) {
          const nextStep = pattern.steps[stepIdx + 1];
          this.trigger3DFoldAnimation(step, nextStep, paperStyle);
        } else {
          this.activeFoldAnimation = undefined;
          if (pattern?.id === 'crane' && step.stepNumber === 18) {
            this.targetRotY = 0.65;
            this.targetRotX = 0.28;
          } else if (pattern?.id === 'turtle' && step.stepNumber === 14) {
            this.targetRotY = 0.35;
            this.targetRotX = 0.52;
          } else if (pattern?.id === 'owl' && step.stepNumber === 12) {
            this.targetRotY = 0.25;
            this.targetRotX = 0.25;
          }
          this.buildOrigami3DModel(step, paperStyle, showGuides);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupThree();
    this.textureCache.forEach((tex) => tex.dispose());
    this.textureCache.clear();
  }

  /**
   * Resets the 3D model view back to the initial default angle and zoom.
   */
  resetView(): void {
    const patternId = this.state.selectedPattern()?.id;
    const stepNumber = this.state.currentStep()?.stepNumber;

    if (patternId === 'crane' && stepNumber === 18) {
      this.targetRotX = 0.28;
      this.targetRotY = 0.65;
    } else if (patternId === 'turtle' && stepNumber === 14) {
      this.targetRotX = 0.52;
      this.targetRotY = 0.35;
    } else if (patternId === 'owl' && stepNumber === 12) {
      this.targetRotX = 0.25;
      this.targetRotY = 0.25;
    } else {
      this.targetRotX = this.defaultRotX;
      this.targetRotY = this.defaultRotY;
    }
    this.targetZoom = this.defaultZoom;
  }

  /**
   * Pointer down: Grabs the 3D model to begin rotating it around itself.
   */
  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return; // Only primary left mouse button
    this.isPointerDown = true;
    this.isDragging.set(true);
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;

    try {
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Ignore if pointer capture is not supported
    }
  }

  /**
   * Pointer move: Freely rotates the model in 3D around its own center.
   */
  onPointerMove(event: PointerEvent): void {
    if (!this.isPointerDown) return;

    const deltaX = event.clientX - this.lastPointerX;
    const deltaY = event.clientY - this.lastPointerY;

    // Horizontal mouse movement rotates around vertical Y-axis (Yaw)
    this.targetRotY += deltaX * 0.009;

    // Vertical mouse movement tilts around horizontal X-axis (Pitch), clamped to prevent tumbling upside-down
    this.targetRotX = Math.max(-1.45, Math.min(1.45, this.targetRotX + deltaY * 0.009));

    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  }

  /**
   * Pointer up / cancel: Releases the grab hold on the 3D model.
   */
  onPointerUp(event: PointerEvent): void {
    this.isPointerDown = false;
    this.isDragging.set(false);

    try {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // Ignore
    }
  }

  /**
   * Mouse wheel: Smoothly zooms the camera in or out for close-up fold inspection.
   */
  onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.targetZoom = Math.max(3.8, Math.min(10.0, this.targetZoom + event.deltaY * 0.004));
  }

  // ----------------------------------------------------
  // THREE.JS INITIALIZATION & SCENE SETUP
  // ----------------------------------------------------
  private initThree(): void {
    if (!this.canvasElement) return;

    const canvas = this.canvasElement;
    const width = canvas.clientWidth || 460;
    const height = canvas.clientHeight || 460;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(0, 0, this.targetZoom);
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer with antialiasing and transparent background for desk integration
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lighting for realistic paper shading and facet depth
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.25);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff1e0, 1.4);
    sunLight.position.set(3.5, 6, 4.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.55);
    rimLight.position.set(-3.5, -4, -3.5);
    this.scene.add(rimLight);

    const deskFillLight = new THREE.PointLight(0xfef3c7, 0.6, 14);
    deskFillLight.position.set(0, 2, 4);
    this.scene.add(deskFillLight);

    // 5. Soft Contact Shadow Plane on the wooden tabletop beneath the hovering paper
    this.addDeskContactShadow();

    // 6. Origami Model Root Group (hovers freely at hoverZ, rotated around itself by mouse)
    this.origamiModelGroup = new THREE.Group();
    this.origamiModelGroup.position.set(0, 0, this.hoverZ);
    this.origamiModelGroup.rotation.x = this.currentRotX;
    this.origamiModelGroup.rotation.y = this.currentRotY;
    this.scene.add(this.origamiModelGroup);

    // 7. Initial Model Build if step is already available
    const step = this.state.currentStep();
    if (step) {
      this.buildOrigami3DModel(step, this.state.selectedPaperStyle(), this.state.showGuideLines());
    }

    // 8. Responsive Resize Observer
    this.setupResizeObserver();

    // 9. Render Loop running outside Angular zone for high-performance 60fps
    this.ngZone.runOutsideAngular(() => {
      this.startRenderLoop();
    });
  }

  /**
   * Renders a soft radial contact shadow directly onto the wooden desk plane beneath the hovering paper.
   */
  private addDeskContactShadow(): void {
    if (!this.scene) return;

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(10, 5, 3, 0.55)');
    gradient.addColorStop(0.5, 'rgba(10, 5, 3, 0.2)');
    gradient.addColorStop(1, 'rgba(10, 5, 3, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeom = new THREE.PlaneGeometry(6.6, 6.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.contactShadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
    // Positioned on the desk surface below the hovering paper
    this.contactShadowMesh.position.z = -0.38;
    this.scene.add(this.contactShadowMesh);
  }

  /**
   * Observes container resize and updates camera aspect and renderer dimensions.
   */
  private setupResizeObserver(): void {
    if (!this.canvasElement) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && this.renderer && this.camera) {
          this.camera.aspect = width / height;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(width, height, false);
        }
      }
    });

    this.resizeObserver.observe(this.canvasElement);
  }

  /**
   * Main animation frame loop.
   * Smoothly interpolates user drag rotation and executes physical 3D fold motions.
   */
  private startRenderLoop(): void {
    const render = () => {
      if (!this.renderer || !this.scene || !this.camera || !this.origamiModelGroup) {
        return;
      }

      // Smooth damped rotation interpolation around model center
      this.currentRotX += (this.targetRotX - this.currentRotX) * 0.18;
      this.currentRotY += (this.targetRotY - this.currentRotY) * 0.18;

      this.origamiModelGroup.rotation.x = this.currentRotX;
      this.origamiModelGroup.rotation.y = this.currentRotY;

      // Handle active 3D physical folding animation
      if (this.activeFoldAnimation) {
        const elapsed = performance.now() - this.activeFoldAnimation.startTime;
        const p = Math.min(1.0, elapsed / this.activeFoldAnimation.duration);
        // Smooth cubic ease-in-out curve
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

        if (
          this.activeFoldAnimation.type === 'flap' &&
          this.activeFoldAnimation.pivotGroup &&
          this.activeFoldAnimation.axis
        ) {
          const { axis, startAngle = 0, targetAngle = -Math.PI } = this.activeFoldAnimation;
          const currentAngle = startAngle + (targetAngle - startAngle) * ease;
          this.activeFoldAnimation.pivotGroup.quaternion.setFromAxisAngle(axis, currentAngle);
          // Arch upward in 3D during mid-fold to clear stationary layers cleanly
          this.activeFoldAnimation.pivotGroup.position.z =
            this.hoverZ + 0.015 + Math.sin(p * Math.PI) * 0.12;
        } else if (
          this.activeFoldAnimation.type === 'turnover' &&
          this.activeFoldAnimation.pivotGroup
        ) {
          this.activeFoldAnimation.pivotGroup.rotation.y = ease * Math.PI;
          this.activeFoldAnimation.pivotGroup.position.z =
            this.hoverZ + Math.sin(p * Math.PI) * 0.45;
        } else if (this.activeFoldAnimation.type === 'squash') {
          const flex = Math.sin(p * Math.PI);
          this.origamiModelGroup.position.z = this.hoverZ + flex * 0.22;
          this.origamiModelGroup.scale.setScalar(1 + flex * 0.05);
        }

        // Crease flash fade
        if (this.activeFoldAnimation.creaseFlashMaterial) {
          this.activeFoldAnimation.creaseFlashMaterial.opacity = (1 - p) * 0.95;
        }

        if (p >= 1.0) {
          this.activeFoldAnimation = undefined;
        }
      } else {
        // Normal steady hovering state above the desk
        this.origamiModelGroup.position.set(0, 0, this.hoverZ);
        this.origamiModelGroup.scale.setScalar(1.0);
      }

      // Smooth camera zoom
      this.camera.position.z += (this.targetZoom - this.camera.position.z) * 0.15;

      this.renderer.render(this.scene, this.camera);
      this.animationFrameId = requestAnimationFrame(render);
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  // ----------------------------------------------------
  // PHYSICAL 3D FOLD TRANSITION ANIMATION
  // ----------------------------------------------------
  /**
   * Sets up and initiates the physical 3D folding animation between steps.
   */
  private trigger3DFoldAnimation(
    currentStep: OrigamiStep,
    nextStep: OrigamiStep,
    paperStyle: OrigamiPaperStyle
  ): void {
    if (!this.origamiModelGroup) return;

    this.clearGroup(this.origamiModelGroup);
    const texture = this.getPaperTexture(paperStyle);
    const anim = this.getActiveFoldAnimation(currentStep);

    // 1. Whole-Sheet 3D Turnover
    if (anim?.type === 'turnover') {
      const turnoverGroup = new THREE.Group();

      // Front card: current step facets facing +Z
      currentStep.facets.forEach((f, i) => {
        const mesh = this.createFacetMesh(f, paperStyle, texture, i);
        if (mesh) turnoverGroup.add(mesh);
      });

      // Back card: destination facets facing -Z
      const backFacets =
        anim.turnoverBackFacets && anim.turnoverBackFacets.length > 0
          ? anim.turnoverBackFacets
          : nextStep.facets;
      const backGroup = new THREE.Group();
      backFacets.forEach((f, i) => {
        const mesh = this.createFacetMesh(f, paperStyle, texture, i);
        if (mesh) backGroup.add(mesh);
      });
      backGroup.rotation.y = Math.PI; // Inverted so it faces reverse
      turnoverGroup.add(backGroup);

      this.origamiModelGroup.add(turnoverGroup);
      this.activeFoldAnimation = {
        type: 'turnover',
        startTime: performance.now(),
        duration: 520,
        pivotGroup: turnoverGroup,
      };
      return;
    }

    // 2. Flap or Unfold 3D Hinge Motion
    if ((anim?.type === 'flap' || anim?.type === 'unfold') && anim.flapPoints) {
      const normalizedFlap = this.normalizePoints(anim.flapPoints);
      const stationaryFacets: PaperFacet[] = [];
      let movingFacet: PaperFacet | null = null;

      for (const facet of currentStep.facets) {
        if (!movingFacet && this.normalizePoints(facet.points) === normalizedFlap) {
          movingFacet = facet;
        } else {
          stationaryFacets.push(facet);
        }
      }

      // Fallback if exact point string matched nothing
      if (!movingFacet && currentStep.facets.length > 0) {
        movingFacet = currentStep.facets[currentStep.facets.length - 1];
      }

      // Build stationary base facets
      stationaryFacets.forEach((f, i) => {
        const mesh = this.createFacetMesh(f, paperStyle, texture, i);
        if (mesh) this.origamiModelGroup!.add(mesh);
      });

      // Build moving flap on rotating hinge pivot
      if (movingFacet) {
        const originX = ((anim.origin?.x ?? 250) - 250) * 0.009;
        const originY = -((anim.origin?.y ?? 250) - 250) * 0.009;

        const flapPivotGroup = new THREE.Group();
        flapPivotGroup.position.set(originX, originY, 0.015);

        const flapMeshGroup = this.createFacetMesh(movingFacet, paperStyle, texture, 0);
        if (flapMeshGroup) {
          flapMeshGroup.position.set(-originX, -originY, 0);
          flapPivotGroup.add(flapMeshGroup);
        }

        // Determine hinge rotation axis and angles from animation metadata
        const { axis, startAngle, targetAngle } = this.resolveFoldAxisAndAngles(
          anim,
          currentStep
        );

        this.origamiModelGroup.add(flapPivotGroup);

        // Radiant golden crease flash along fold line
        const creaseMat = this.addCreaseFlash3D(currentStep);

        this.activeFoldAnimation = {
          type: 'flap',
          startTime: performance.now(),
          duration: 520,
          pivotGroup: flapPivotGroup,
          axis,
          startAngle,
          targetAngle,
          creaseFlashMaterial: creaseMat,
        };
        return;
      }
    }

    // 3. Squash / Reverse / Final 3D Fold Flex
    currentStep.facets.forEach((f, i) => {
      const mesh = this.createFacetMesh(f, paperStyle, texture, i);
      if (mesh) this.origamiModelGroup!.add(mesh);
    });

    const creaseMat = this.addCreaseFlash3D(currentStep);
    this.activeFoldAnimation = {
      type: 'squash',
      startTime: performance.now(),
      duration: 520,
      creaseFlashMaterial: creaseMat,
    };
  }

  /**
   * Resolves the 3D hinge axis vector and start/target rotation angles.
   */
  private resolveFoldAxisAndAngles(
    anim: FoldAnimation,
    step: OrigamiStep
  ): {
    axis: THREE.Vector3;
    startAngle: number;
    targetAngle: number;
  } {
    const animClass = anim.animationClass || '';
    const rot = anim.rotateTransform || '';

    // Fold UP along horizontal X-axis
    if (animClass.includes('fold-up-x') || rot.includes('rotateX(-180deg)')) {
      return { axis: new THREE.Vector3(1, 0, 0), startAngle: 0, targetAngle: -Math.PI };
    }
    // Fold DOWN along horizontal X-axis
    if (animClass.includes('fold-down-x') || rot.includes('rotateX(180deg)')) {
      return { axis: new THREE.Vector3(1, 0, 0), startAngle: 0, targetAngle: Math.PI };
    }
    // Fold RIGHT along vertical Y-axis
    if (animClass.includes('fold-right-y') || rot.includes('rotateY(180deg)')) {
      return { axis: new THREE.Vector3(0, 1, 0), startAngle: 0, targetAngle: Math.PI };
    }
    // Fold LEFT along vertical Y-axis
    if (animClass.includes('fold-left-y') || rot.includes('rotateY(-180deg)')) {
      return { axis: new THREE.Vector3(0, 1, 0), startAngle: 0, targetAngle: -Math.PI };
    }
    // Unfold DOWN
    if (animClass.includes('unfold-down-x')) {
      return { axis: new THREE.Vector3(1, 0, 0), startAngle: -Math.PI, targetAngle: 0 };
    }
    // Unfold UP
    if (animClass.includes('unfold-up-x')) {
      return { axis: new THREE.Vector3(1, 0, 0), startAngle: Math.PI, targetAngle: 0 };
    }
    // Unfold RIGHT
    if (animClass.includes('unfold-right-y')) {
      return { axis: new THREE.Vector3(0, 1, 0), startAngle: -Math.PI, targetAngle: 0 };
    }
    // Unfold LEFT
    if (animClass.includes('unfold-left-y')) {
      return { axis: new THREE.Vector3(0, 1, 0), startAngle: Math.PI, targetAngle: 0 };
    }
    // Kite fold diagonal: Flaps fold toward the vertical center line
    if (animClass.includes('kite-right') || animClass.includes('kite-left')) {
      if (step.creaseLines && step.creaseLines.length > 0) {
        const cl = step.creaseLines[0];
        const dx = (cl.x2 - cl.x1) * 0.009;
        const dy = -(cl.y2 - cl.y1) * 0.009;
        const axis = new THREE.Vector3(dx, dy, 0).normalize();
        const isRight = animClass.includes('right');
        return {
          axis,
          startAngle: 0,
          targetAngle: isRight ? -Math.PI : Math.PI,
        };
      }
      if (animClass.includes('kite-right')) {
        const axis = new THREE.Vector3(0.54, 1.08, 0).normalize();
        return { axis, startAngle: 0, targetAngle: -Math.PI };
      }
      if (animClass.includes('kite-left')) {
        const axis = new THREE.Vector3(-0.54, 1.08, 0).normalize();
        return { axis, startAngle: 0, targetAngle: Math.PI };
      }
    }

    // Default safe horizontal fold
    return { axis: new THREE.Vector3(1, 0, 0), startAngle: 0, targetAngle: -Math.PI };
  }

  /**
   * Adds glowing radiant golden crease flash lines at the fold location.
   */
  private addCreaseFlash3D(step: OrigamiStep): THREE.LineBasicMaterial | undefined {
    if (!step.creaseLines || step.creaseLines.length === 0 || !this.origamiModelGroup) {
      return undefined;
    }

    const mat = new THREE.LineBasicMaterial({
      color: 0xfde047,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
    });

    for (const line of step.creaseLines) {
      const p1 = new THREE.Vector3((line.x1 - 250) * 0.009, -(line.y1 - 250) * 0.009, 0.035);
      const p2 = new THREE.Vector3((line.x2 - 250) * 0.009, -(line.y2 - 250) * 0.009, 0.035);
      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineObj = new THREE.Line(geom, mat);
      this.origamiModelGroup.add(lineObj);
    }

    return mat;
  }

  // ----------------------------------------------------
  // PROCEDURAL 3D MESH GENERATION FROM STEP FACETS
  // ----------------------------------------------------
  /**
   * Reconstructs the resting 3D origami paper model from the current step's facets,
   * guideline creases, and fold direction arrow.
   */
  private buildOrigami3DModel(
    step: OrigamiStep,
    paperStyle: OrigamiPaperStyle,
    showGuideLines: boolean
  ): void {
    if (!this.origamiModelGroup) return;

    // 1. Dispose previous facet meshes, edges, and materials
    this.clearGroup(this.origamiModelGroup);

    // 2. Retrieve or generate pattern texture
    const texture = this.getPaperTexture(paperStyle);

    // 3. For completed models, render authentic masterwork 3D origami sculptures
    if (this.state.selectedPattern()?.id === 'crane' && step.stepNumber === 18) {
      this.buildMasterworkCrane3D(paperStyle, texture);
      return;
    }
    if (this.state.selectedPattern()?.id === 'owl' && step.stepNumber === 12) {
      this.buildMasterworkOwl3D(paperStyle, texture);
      return;
    }
    if (this.state.selectedPattern()?.id === 'turtle' && step.stepNumber === 14) {
      this.buildMasterworkTurtle3D(paperStyle, texture);
      return;
    }

    // 4. Build each facet with authentic double-sided paper and subtle Z-stacking
    const totalFacets = step.facets.length;
    step.facets.forEach((facet, index) => {
      const facetGroup = this.createFacetMesh(facet, paperStyle, texture, index);
      if (facetGroup) {
        this.origamiModelGroup!.add(facetGroup);
      }
    });

    // 5. Build Crease Guidelines in 3D (Mountain, Valley, Guide)
    if (showGuideLines && step.creaseLines && step.creaseLines.length > 0) {
      const creasesGroup = this.createCreaseLines3D(step.creaseLines, totalFacets);
      this.origamiModelGroup.add(creasesGroup);
    }

    // 6. Build Fold Motion Trajectory Arrow in 3D
    if (showGuideLines && step.arrow) {
      const arrowGroup = this.createMotionArrow3D(step.arrow, totalFacets);
      this.origamiModelGroup.add(arrowGroup);
    }
  }

  /**
   * Constructs the authentic masterwork 3D Origami Crane (Tsuru),
   * faithfully reproducing the exact proportions, faceted folds, sweeping wings,
   * slender neck with crimped downward beak, and tall pointed tail shown in traditional origami.
   */
  private buildMasterworkCrane3D(
    paperStyle: OrigamiPaperStyle,
    patternTexture: THREE.CanvasTexture | null
  ): void {
    if (!this.origamiModelGroup) return;

    // 1. Definition of canonical 3D vertices
    // Bottom apex and central body
    const V_BOTTOM = new THREE.Vector3(0, -0.92, 0);          // Base point resting on table
    const V_BACK = new THREE.Vector3(0, 0.44, -0.04);          // Top crest of the back saddle
    const V_CHEST = new THREE.Vector3(0, -0.12, 0.52);         // Front chest rim (neck root)
    const V_REAR = new THREE.Vector3(0, -0.12, -0.56);         // Rear saddle rim (tail root)

    // Wing roots (fold crease lines where wings branch from the torso)
    const V_WROOT_FL = new THREE.Vector3(-0.28, 0.04, 0.34);
    const V_WROOT_ML = new THREE.Vector3(-0.32, 0.16, -0.02);
    const V_WROOT_RL = new THREE.Vector3(-0.28, 0.04, -0.36);

    const V_WROOT_FR = new THREE.Vector3(0.28, 0.04, 0.34);
    const V_WROOT_MR = new THREE.Vector3(0.32, 0.16, -0.02);
    const V_WROOT_RR = new THREE.Vector3(0.28, 0.04, -0.36);

    // Wings (large sweeping triangular sheets with central ridge crease)
    const V_WTIP_L = new THREE.Vector3(-2.18, 0.92, 0.06);     // Left wingtip
    const V_WLEAD_L = new THREE.Vector3(-1.24, 0.38, 0.54);    // Left leading edge
    const V_WTRAIL_L = new THREE.Vector3(-1.24, 0.38, -0.44);  // Left trailing edge

    const V_WTIP_R = new THREE.Vector3(2.18, 0.92, 0.06);      // Right wingtip
    const V_WLEAD_R = new THREE.Vector3(1.24, 0.38, 0.54);     // Right leading edge
    const V_WTRAIL_R = new THREE.Vector3(1.24, 0.38, -0.44);   // Right trailing edge

    // Neck & Head (long slender needle rising forward-up, head crimped down)
    const V_NECK_BASE_L = new THREE.Vector3(-0.06, -0.22, 0.44);
    const V_NECK_BASE_R = new THREE.Vector3(0.06, -0.22, 0.44);
    const V_NECK_MID_L = new THREE.Vector3(-0.04, 0.36, 0.96);
    const V_NECK_MID_R = new THREE.Vector3(0.04, 0.36, 0.96);
    const V_NECK_CREST = new THREE.Vector3(0, 0.42, 0.94);
    const V_NECK_TOP_L = new THREE.Vector3(-0.03, 0.80, 1.44);
    const V_NECK_TOP_R = new THREE.Vector3(0.03, 0.80, 1.44);
    const V_HEAD_CROWN = new THREE.Vector3(0, 0.86, 1.46);
    const V_HEAD_THROAT = new THREE.Vector3(0, 0.60, 1.54);
    const V_BEAK_TIP = new THREE.Vector3(0, 0.36, 1.88);       // Crisp downward pointed beak

    // Tail (long slender needle shooting back-up)
    const V_TAIL_BASE_L = new THREE.Vector3(-0.06, -0.22, -0.46);
    const V_TAIL_BASE_R = new THREE.Vector3(0.06, -0.22, -0.46);
    const V_TAIL_MID_L = new THREE.Vector3(-0.03, 0.54, -1.06);
    const V_TAIL_MID_R = new THREE.Vector3(0.03, 0.54, -1.06);
    const V_TAIL_CREST = new THREE.Vector3(0, 0.58, -1.02);
    const V_TAIL_TIP = new THREE.Vector3(0, 1.32, -1.66);      // Tall sharp tail tip

    interface CraneFace {
      v: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
      shade: number;
    }

    const faces: CraneFace[] = [
      // 1. Central Back Saddle
      { v: [V_BACK, V_WROOT_FL, V_WROOT_ML], shade: 1.05 },
      { v: [V_BACK, V_WROOT_ML, V_WROOT_RL], shade: 0.98 },
      { v: [V_BACK, V_WROOT_MR, V_WROOT_FR], shade: 1.12 },
      { v: [V_BACK, V_WROOT_RR, V_WROOT_MR], shade: 1.02 },

      // 2. Underbody / Flanks
      { v: [V_BOTTOM, V_CHEST, V_WROOT_FL], shade: 0.94 },
      { v: [V_BOTTOM, V_WROOT_FL, V_WROOT_RL], shade: 0.90 },
      { v: [V_BOTTOM, V_WROOT_RL, V_REAR], shade: 0.86 },
      { v: [V_BOTTOM, V_WROOT_FR, V_CHEST], shade: 1.00 },
      { v: [V_BOTTOM, V_WROOT_RR, V_WROOT_FR], shade: 0.96 },
      { v: [V_BOTTOM, V_REAR, V_WROOT_RR], shade: 0.92 },

      // 3. Left Wing
      { v: [V_WROOT_ML, V_WLEAD_L, V_WTIP_L], shade: 1.08 },
      { v: [V_WROOT_ML, V_WTIP_L, V_WTRAIL_L], shade: 0.95 },
      { v: [V_WROOT_FL, V_WLEAD_L, V_WROOT_ML], shade: 1.02 },
      { v: [V_WROOT_ML, V_WTRAIL_L, V_WROOT_RL], shade: 0.90 },

      // 4. Right Wing
      { v: [V_WROOT_MR, V_WTIP_R, V_WLEAD_R], shade: 1.18 },
      { v: [V_WROOT_MR, V_WTRAIL_R, V_WTIP_R], shade: 1.05 },
      { v: [V_WROOT_FR, V_WROOT_MR, V_WLEAD_R], shade: 1.12 },
      { v: [V_WROOT_MR, V_WROOT_RR, V_WTRAIL_R], shade: 0.98 },

      // 5. Neck
      { v: [V_NECK_BASE_L, V_NECK_MID_L, V_NECK_CREST], shade: 1.04 },
      { v: [V_NECK_BASE_R, V_NECK_CREST, V_NECK_MID_R], shade: 1.12 },
      { v: [V_NECK_MID_L, V_NECK_TOP_L, V_HEAD_CROWN], shade: 1.06 },
      { v: [V_NECK_MID_R, V_HEAD_CROWN, V_NECK_TOP_R], shade: 1.14 },
      { v: [V_CHEST, V_HEAD_THROAT, V_NECK_TOP_L], shade: 0.96 },
      { v: [V_CHEST, V_NECK_TOP_R, V_HEAD_THROAT], shade: 1.02 },

      // 6. Head & Beak
      { v: [V_HEAD_CROWN, V_BEAK_TIP, V_HEAD_THROAT], shade: 1.10 },
      { v: [V_HEAD_CROWN, V_HEAD_THROAT, V_BEAK_TIP], shade: 0.92 },
      { v: [V_HEAD_CROWN, V_NECK_TOP_L, V_BEAK_TIP], shade: 1.18 },
      { v: [V_HEAD_CROWN, V_BEAK_TIP, V_NECK_TOP_R], shade: 1.15 },

      // 7. Tail
      { v: [V_TAIL_BASE_L, V_TAIL_MID_L, V_TAIL_CREST], shade: 0.98 },
      { v: [V_TAIL_BASE_R, V_TAIL_CREST, V_TAIL_MID_R], shade: 1.08 },
      { v: [V_TAIL_MID_L, V_TAIL_TIP, V_TAIL_CREST], shade: 1.02 },
      { v: [V_TAIL_MID_R, V_TAIL_CREST, V_TAIL_TIP], shade: 1.12 },
      { v: [V_REAR, V_TAIL_TIP, V_TAIL_BASE_L], shade: 0.92 },
      { v: [V_REAR, V_TAIL_BASE_R, V_TAIL_TIP], shade: 1.00 },
    ];

    const group = new THREE.Group();

    for (const face of faces) {
      const geom = new THREE.BufferGeometry().setFromPoints(face.v);
      geom.computeVertexNormals();

      // UVs for authentic Japanese Washi patterns
      const uvs = [
        (face.v[0].x + 2.5) / 5,
        (face.v[0].z + 2.5) / 5,
        (face.v[1].x + 2.5) / 5,
        (face.v[1].z + 2.5) / 5,
        (face.v[2].x + 2.5) / 5,
        (face.v[2].z + 2.5) / 5,
      ];
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

      const color = new THREE.Color(paperStyle.primaryColor).multiplyScalar(face.shade);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0.03,
        flatShading: true,
        side: THREE.DoubleSide,
        map: patternTexture,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Crisp origami crease lines along triangle perimeters
      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        face.v[0],
        face.v[1],
        face.v[1],
        face.v[2],
        face.v[2],
        face.v[0],
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x000000,
        opacity: 0.22,
        transparent: true,
      });
      const line = new THREE.LineSegments(lineGeom, lineMat);
      group.add(line);
    }

    this.origamiModelGroup.add(group);
  }

  /**
   * Constructs the authentic masterwork 3D Origami Owl (Fukuro),
   * faithfully reproducing the iconic upright body, prominent folded ear tufts,
   * puffed breast shield with reverse paper contrast, folded amber beak,
   * high-contrast origami eyes, wrap-around wings, and table perch.
   */
  private buildMasterworkOwl3D(
    paperStyle: OrigamiPaperStyle,
    patternTexture: THREE.CanvasTexture | null
  ): void {
    if (!this.origamiModelGroup) return;

    // 1. Definition of canonical 3D vertices for the Wise Zen Owl (Fukuro)
    // Ear tufts & Brow
    const V_EAR_TIP_L = new THREE.Vector3(-0.64, 1.25, 0.12);
    const V_EAR_TIP_R = new THREE.Vector3(0.64, 1.25, 0.12);
    const V_BROW_CENTER = new THREE.Vector3(0, 0.90, 0.22);
    const V_BROW_L = new THREE.Vector3(-0.36, 0.82, 0.26);
    const V_BROW_R = new THREE.Vector3(0.36, 0.82, 0.26);
    const V_HEAD_TEMPLE_L = new THREE.Vector3(-0.75, 0.68, 0.06);
    const V_HEAD_TEMPLE_R = new THREE.Vector3(0.75, 0.68, 0.06);
    const V_HEAD_BACK = new THREE.Vector3(0, 0.98, -0.22);

    // Facial Disk & Beak
    const V_BEAK_ROOT = new THREE.Vector3(0, 0.48, 0.52);
    const V_BEAK_TIP = new THREE.Vector3(0, 0.22, 0.78);       // Protrudes proudly forward
    const V_BEAK_BASE_L = new THREE.Vector3(-0.10, 0.38, 0.46);
    const V_BEAK_BASE_R = new THREE.Vector3(0.10, 0.38, 0.46);
    const V_BEAK_THROAT = new THREE.Vector3(0, 0.28, 0.44);

    // Eyes (Faceted origami eyes disks)
    const V_EYE_TOP_L = new THREE.Vector3(-0.24, 0.66, 0.38);
    const V_EYE_OUT_L = new THREE.Vector3(-0.46, 0.52, 0.32);
    const V_EYE_BOT_L = new THREE.Vector3(-0.24, 0.40, 0.36);
    const V_EYE_IN_L = new THREE.Vector3(-0.10, 0.54, 0.42);

    const V_EYE_TOP_R = new THREE.Vector3(0.24, 0.66, 0.38);
    const V_EYE_OUT_R = new THREE.Vector3(0.46, 0.52, 0.32);
    const V_EYE_BOT_R = new THREE.Vector3(0.24, 0.40, 0.36);
    const V_EYE_IN_R = new THREE.Vector3(0.10, 0.54, 0.42);

    // Puffed Breast (white/accent reverse fold shield)
    const V_CHEST_PEAK = new THREE.Vector3(0, 0.05, 0.64);     // Puffed forward
    const V_CHEST_MID_L = new THREE.Vector3(-0.42, 0.02, 0.40);
    const V_CHEST_MID_R = new THREE.Vector3(0.42, 0.02, 0.40);
    const V_BELLY_APEX = new THREE.Vector3(0, -0.62, 0.42);
    const V_BELLY_LOW_L = new THREE.Vector3(-0.35, -0.60, 0.32);
    const V_BELLY_LOW_R = new THREE.Vector3(0.35, -0.60, 0.32);

    // Wings (tucked folded wings along the flanks)
    const V_WING_SHOULDER_L = new THREE.Vector3(-0.72, 0.45, 0.16);
    const V_WING_ELBOW_L = new THREE.Vector3(-0.96, -0.10, 0.02);
    const V_WING_TIP_L = new THREE.Vector3(-0.52, -0.78, -0.18);

    const V_WING_SHOULDER_R = new THREE.Vector3(0.72, 0.45, 0.16);
    const V_WING_ELBOW_R = new THREE.Vector3(0.96, -0.10, 0.02);
    const V_WING_TIP_R = new THREE.Vector3(0.52, -0.78, -0.18);

    // Back & Tail
    const V_BACK_UPPER = new THREE.Vector3(0, 0.40, -0.32);
    const V_BACK_LOWER = new THREE.Vector3(0, -0.35, -0.35);
    const V_TAIL_TIP = new THREE.Vector3(0, -0.92, -0.26);

    // Claws / Talons (Folded golden paper feet resting on desk)
    const V_TALON_L1 = new THREE.Vector3(-0.32, -0.94, 0.36);
    const V_TALON_L2 = new THREE.Vector3(-0.20, -0.94, 0.40);
    const V_TALON_L3 = new THREE.Vector3(-0.10, -0.94, 0.36);
    const V_FOOT_BASE_L = new THREE.Vector3(-0.20, -0.72, 0.28);

    const V_TALON_R1 = new THREE.Vector3(0.10, -0.94, 0.36);
    const V_TALON_R2 = new THREE.Vector3(0.20, -0.94, 0.40);
    const V_TALON_R3 = new THREE.Vector3(0.32, -0.94, 0.36);
    const V_FOOT_BASE_R = new THREE.Vector3(0.20, -0.72, 0.28);

    // Perch Bar on desk
    const V_PERCH_L = new THREE.Vector3(-0.85, -0.95, 0.22);
    const V_PERCH_R = new THREE.Vector3(0.85, -0.95, 0.22);
    const V_PERCH_BOT_L = new THREE.Vector3(-0.85, -1.02, 0.22);
    const V_PERCH_BOT_R = new THREE.Vector3(0.85, -1.02, 0.22);

    // 2. Structured facet definitions
    const faces: {
      v: THREE.Vector3[];
      shade: number;
      colorOverride?: string;
      isReverse?: boolean;
    }[] = [
      // Ear tufts
      { v: [V_EAR_TIP_L, V_BROW_CENTER, V_BROW_L], shade: 1.08 },
      { v: [V_EAR_TIP_L, V_BROW_L, V_HEAD_TEMPLE_L], shade: 0.94 },
      { v: [V_EAR_TIP_L, V_HEAD_TEMPLE_L, V_HEAD_BACK], shade: 0.90 },
      { v: [V_EAR_TIP_R, V_BROW_R, V_BROW_CENTER], shade: 1.15 },
      { v: [V_EAR_TIP_R, V_HEAD_TEMPLE_R, V_BROW_R], shade: 1.02 },
      { v: [V_EAR_TIP_R, V_HEAD_BACK, V_HEAD_TEMPLE_R], shade: 0.92 },
      { v: [V_BROW_CENTER, V_BROW_L, V_BROW_R], shade: 1.05 },

      // Forehead & Face Root
      { v: [V_BROW_CENTER, V_BROW_R, V_BEAK_ROOT], shade: 1.06 },
      { v: [V_BROW_CENTER, V_BEAK_ROOT, V_BROW_L], shade: 0.98 },
      { v: [V_BROW_L, V_EYE_IN_L, V_BEAK_ROOT], shade: 0.94 },
      { v: [V_BROW_L, V_HEAD_TEMPLE_L, V_EYE_OUT_L], shade: 0.92 },
      { v: [V_BROW_L, V_EYE_OUT_L, V_EYE_TOP_L], shade: 0.96 },
      { v: [V_BROW_L, V_EYE_TOP_L, V_EYE_IN_L], shade: 1.00 },
      { v: [V_BROW_R, V_BEAK_ROOT, V_EYE_IN_R], shade: 1.08 },
      { v: [V_BROW_R, V_EYE_OUT_R, V_HEAD_TEMPLE_R], shade: 1.02 },
      { v: [V_BROW_R, V_EYE_TOP_R, V_EYE_OUT_R], shade: 1.10 },
      { v: [V_BROW_R, V_EYE_IN_R, V_EYE_TOP_R], shade: 1.06 },

      // Protruding Folded Golden Beak
      { v: [V_BEAK_ROOT, V_BEAK_BASE_L, V_BEAK_TIP], shade: 1.12, colorOverride: '#f59e0b' },
      { v: [V_BEAK_ROOT, V_BEAK_TIP, V_BEAK_BASE_R], shade: 1.20, colorOverride: '#fbbf24' },
      { v: [V_BEAK_TIP, V_BEAK_BASE_L, V_BEAK_THROAT], shade: 0.94, colorOverride: '#d97706' },
      { v: [V_BEAK_TIP, V_BEAK_THROAT, V_BEAK_BASE_R], shade: 1.02, colorOverride: '#d97706' },

      // Origami Eyes: Light Iris + Obsidian Pupils
      { v: [V_EYE_TOP_L, V_EYE_OUT_L, V_EYE_BOT_L], shade: 1.08, isReverse: true },
      { v: [V_EYE_TOP_L, V_EYE_BOT_L, V_EYE_IN_L], shade: 1.12, isReverse: true },
      { v: [V_EYE_TOP_R, V_EYE_BOT_R, V_EYE_OUT_R], shade: 1.15, isReverse: true },
      { v: [V_EYE_TOP_R, V_EYE_IN_R, V_EYE_BOT_R], shade: 1.18, isReverse: true },
      // Pupils
      {
        v: [
          new THREE.Vector3(-0.25, 0.58, 0.40),
          new THREE.Vector3(-0.31, 0.52, 0.38),
          new THREE.Vector3(-0.23, 0.46, 0.39),
        ],
        shade: 1.0,
        colorOverride: '#18181b',
      },
      {
        v: [
          new THREE.Vector3(-0.25, 0.58, 0.40),
          new THREE.Vector3(-0.23, 0.46, 0.39),
          new THREE.Vector3(-0.17, 0.52, 0.41),
        ],
        shade: 1.0,
        colorOverride: '#18181b',
      },
      {
        v: [
          new THREE.Vector3(0.25, 0.58, 0.40),
          new THREE.Vector3(0.23, 0.46, 0.39),
          new THREE.Vector3(0.31, 0.52, 0.38),
        ],
        shade: 1.0,
        colorOverride: '#18181b',
      },
      {
        v: [
          new THREE.Vector3(0.25, 0.58, 0.40),
          new THREE.Vector3(0.17, 0.52, 0.41),
          new THREE.Vector3(0.23, 0.46, 0.39),
        ],
        shade: 1.0,
        colorOverride: '#18181b',
      },

      // Puffed Breast Shield (Reverse Paper / Light Washi contrast)
      { v: [V_BEAK_THROAT, V_CHEST_MID_L, V_CHEST_PEAK], shade: 1.14, isReverse: true },
      { v: [V_BEAK_THROAT, V_CHEST_PEAK, V_CHEST_MID_R], shade: 1.22, isReverse: true },
      { v: [V_CHEST_PEAK, V_CHEST_MID_L, V_BELLY_APEX], shade: 1.08, isReverse: true },
      { v: [V_CHEST_PEAK, V_BELLY_APEX, V_CHEST_MID_R], shade: 1.16, isReverse: true },

      // Torso Flanks (Connecting breast to wings)
      { v: [V_EYE_BOT_L, V_WING_SHOULDER_L, V_CHEST_MID_L], shade: 0.94 },
      { v: [V_CHEST_MID_L, V_WING_ELBOW_L, V_BELLY_LOW_L], shade: 0.92 },
      { v: [V_CHEST_MID_L, V_BELLY_LOW_L, V_BELLY_APEX], shade: 0.98 },
      { v: [V_EYE_BOT_R, V_CHEST_MID_R, V_WING_SHOULDER_R], shade: 1.06 },
      { v: [V_CHEST_MID_R, V_BELLY_LOW_R, V_WING_ELBOW_R], shade: 1.02 },
      { v: [V_CHEST_MID_R, V_BELLY_APEX, V_BELLY_LOW_R], shade: 1.04 },

      // Folded Wings (Hugging the sides)
      { v: [V_HEAD_TEMPLE_L, V_WING_ELBOW_L, V_WING_SHOULDER_L], shade: 0.92 },
      { v: [V_WING_SHOULDER_L, V_WING_ELBOW_L, V_WING_TIP_L], shade: 0.88 },
      { v: [V_HEAD_TEMPLE_L, V_BACK_UPPER, V_WING_ELBOW_L], shade: 0.90 },
      { v: [V_BACK_UPPER, V_BACK_LOWER, V_WING_TIP_L], shade: 0.86 },

      { v: [V_HEAD_TEMPLE_R, V_WING_SHOULDER_R, V_WING_ELBOW_R], shade: 1.10 },
      { v: [V_WING_SHOULDER_R, V_WING_TIP_R, V_WING_ELBOW_R], shade: 1.06 },
      { v: [V_HEAD_TEMPLE_R, V_WING_ELBOW_R, V_BACK_UPPER], shade: 1.02 },
      { v: [V_BACK_UPPER, V_WING_TIP_R, V_BACK_LOWER], shade: 0.98 },

      // Back & Tail
      { v: [V_HEAD_BACK, V_HEAD_TEMPLE_L, V_BACK_UPPER], shade: 0.92 },
      { v: [V_HEAD_BACK, V_BACK_UPPER, V_HEAD_TEMPLE_R], shade: 0.96 },
      { v: [V_BACK_LOWER, V_WING_TIP_L, V_TAIL_TIP], shade: 0.88 },
      { v: [V_BACK_LOWER, V_TAIL_TIP, V_WING_TIP_R], shade: 0.94 },

      // Claws / Talons (Golden paper feet)
      { v: [V_FOOT_BASE_L, V_TALON_L1, V_TALON_L2], shade: 1.05, colorOverride: '#d97706' },
      { v: [V_FOOT_BASE_L, V_TALON_L2, V_TALON_L3], shade: 1.10, colorOverride: '#f59e0b' },
      { v: [V_FOOT_BASE_R, V_TALON_R1, V_TALON_R2], shade: 1.08, colorOverride: '#f59e0b' },
      { v: [V_FOOT_BASE_R, V_TALON_R2, V_TALON_R3], shade: 1.12, colorOverride: '#d97706' },

      // Perch Bar
      { v: [V_PERCH_L, V_PERCH_BOT_L, V_PERCH_BOT_R], shade: 0.85, colorOverride: '#78350f' },
      { v: [V_PERCH_L, V_PERCH_BOT_R, V_PERCH_R], shade: 0.90, colorOverride: '#78350f' },
    ];

    const group = new THREE.Group();

    for (const face of faces) {
      const geom = new THREE.BufferGeometry().setFromPoints(face.v);
      geom.computeVertexNormals();

      const uvs = [
        (face.v[0].x + 2.5) / 5,
        (face.v[0].y + 2.5) / 5,
        (face.v[1].x + 2.5) / 5,
        (face.v[1].y + 2.5) / 5,
        (face.v[2].x + 2.5) / 5,
        (face.v[2].y + 2.5) / 5,
      ];
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

      let baseHex = paperStyle.primaryColor;
      if (face.colorOverride) {
        baseHex = face.colorOverride;
      } else if (face.isReverse) {
        baseHex = paperStyle.secondaryColor || '#ffffff';
      }

      const color = new THREE.Color(baseHex).multiplyScalar(face.shade);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0.03,
        flatShading: true,
        side: THREE.DoubleSide,
        map: face.colorOverride || face.isReverse ? null : patternTexture,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        face.v[0],
        face.v[1],
        face.v[1],
        face.v[2],
        face.v[2],
        face.v[0],
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x000000,
        opacity: 0.22,
        transparent: true,
      });
      const line = new THREE.LineSegments(lineGeom, lineMat);
      group.add(line);
    }

    this.origamiModelGroup.add(group);
  }

  /**
   * Constructs the authentic masterwork 3D Origami Turtle (Kame),
   * faithfully reproducing the elevated hexagonal Kikkō carapace,
   * sloping geometric perimeter scutes, extended diamond head with center ridge fold,
   * wide curved swimming flippers resting on the table, and rear rudder flippers.
   */
  private buildMasterworkTurtle3D(
    paperStyle: OrigamiPaperStyle,
    patternTexture: THREE.CanvasTexture | null
  ): void {
    if (!this.origamiModelGroup) return;

    // 1. Definition of canonical 3D vertices for the Ancient Zen Turtle (Kame)
    // Hexagonal Domed Carapace (elevated Kikkō shell dome)
    const V_SHELL_APEX = new THREE.Vector3(0, 0.44, 0.04);
    const V_SCUTE_ANT = new THREE.Vector3(0, 0.36, 0.44);
    const V_SCUTE_POST = new THREE.Vector3(0, 0.34, -0.38);
    const V_SCUTE_MID_L = new THREE.Vector3(-0.48, 0.36, 0.04);
    const V_SCUTE_MID_R = new THREE.Vector3(0.48, 0.36, 0.04);
    const V_SCUTE_ANT_L = new THREE.Vector3(-0.38, 0.30, 0.42);
    const V_SCUTE_ANT_R = new THREE.Vector3(0.38, 0.30, 0.42);
    const V_SCUTE_POST_L = new THREE.Vector3(-0.38, 0.28, -0.36);
    const V_SCUTE_POST_R = new THREE.Vector3(0.38, 0.28, -0.36);

    // Carapace Rim (periphery sloping gracefully down towards the table)
    const V_RIM_NECK = new THREE.Vector3(0, 0.14, 0.82);
    const V_RIM_ANT_L = new THREE.Vector3(-0.52, 0.10, 0.72);
    const V_RIM_ANT_R = new THREE.Vector3(0.52, 0.10, 0.72);
    const V_RIM_MID_L = new THREE.Vector3(-0.96, 0.04, 0.04);
    const V_RIM_MID_R = new THREE.Vector3(0.96, 0.04, 0.04);
    const V_RIM_POST_L = new THREE.Vector3(-0.64, 0.02, -0.66);
    const V_RIM_POST_R = new THREE.Vector3(0.64, 0.02, -0.66);
    const V_RIM_TAIL = new THREE.Vector3(0, 0.04, -0.82);

    // Head & Neck (Folded origami diamond extending forward)
    const V_HEAD_CROWN = new THREE.Vector3(0, 0.26, 1.28);
    const V_SNOUT = new THREE.Vector3(0, 0.12, 1.62);          // Tip of turtle snout
    const V_HEAD_L = new THREE.Vector3(-0.20, 0.16, 1.22);
    const V_HEAD_R = new THREE.Vector3(0.20, 0.16, 1.22);
    const V_THROAT = new THREE.Vector3(0, 0.00, 1.24);

    // Front Left Swimming Flipper (wide sweeping paddle)
    const V_FLIP_L_LEAD = new THREE.Vector3(-0.50, 0.10, 0.74);
    const V_FLIP_L_TRAIL = new THREE.Vector3(-0.82, 0.06, 0.32);
    const V_FLIP_L_RIDGE = new THREE.Vector3(-1.42, 0.12, 0.62);
    const V_FLIP_L_TIP = new THREE.Vector3(-2.04, -0.06, 0.38); // Grazes the tabletop

    // Front Right Swimming Flipper
    const V_FLIP_R_LEAD = new THREE.Vector3(0.50, 0.10, 0.74);
    const V_FLIP_R_TRAIL = new THREE.Vector3(0.82, 0.06, 0.32);
    const V_FLIP_R_RIDGE = new THREE.Vector3(1.42, 0.12, 0.62);
    const V_FLIP_R_TIP = new THREE.Vector3(2.04, -0.06, 0.38);

    // Rear Flippers (Rudders)
    const V_RFLIP_L_ROOT = new THREE.Vector3(-0.56, 0.02, -0.62);
    const V_RFLIP_L_TIP = new THREE.Vector3(-1.18, -0.06, -0.96);
    const V_RFLIP_L_IN = new THREE.Vector3(-0.48, -0.06, -1.04);

    const V_RFLIP_R_ROOT = new THREE.Vector3(0.56, 0.02, -0.62);
    const V_RFLIP_R_TIP = new THREE.Vector3(1.18, -0.06, -0.96);
    const V_RFLIP_R_IN = new THREE.Vector3(0.48, -0.06, -1.04);

    // Needle Tail
    const V_TAIL_TIP = new THREE.Vector3(0, -0.04, -1.26);

    // Belly Plastron
    const V_BELLY_CENTER = new THREE.Vector3(0, -0.04, 0);

    // 2. Structured facet definitions
    const faces: { v: THREE.Vector3[]; shade: number }[] = [
      // Central Hexagonal Dome Carapace
      { v: [V_SHELL_APEX, V_SCUTE_ANT, V_SCUTE_ANT_L], shade: 1.14 },
      { v: [V_SHELL_APEX, V_SCUTE_ANT_R, V_SCUTE_ANT], shade: 1.22 },
      { v: [V_SHELL_APEX, V_SCUTE_ANT_L, V_SCUTE_MID_L], shade: 1.08 },
      { v: [V_SHELL_APEX, V_SCUTE_MID_R, V_SCUTE_ANT_R], shade: 1.20 },
      { v: [V_SHELL_APEX, V_SCUTE_MID_L, V_SCUTE_POST_L], shade: 1.02 },
      { v: [V_SHELL_APEX, V_SCUTE_POST_R, V_SCUTE_MID_R], shade: 1.16 },
      { v: [V_SHELL_APEX, V_SCUTE_POST_L, V_SCUTE_POST], shade: 0.96 },
      { v: [V_SHELL_APEX, V_SCUTE_POST, V_SCUTE_POST_R], shade: 1.10 },

      // Anterior Carapace Rim
      { v: [V_SCUTE_ANT, V_RIM_NECK, V_SCUTE_ANT_L], shade: 1.06 },
      { v: [V_SCUTE_ANT, V_SCUTE_ANT_R, V_RIM_NECK], shade: 1.18 },
      { v: [V_SCUTE_ANT_L, V_RIM_NECK, V_RIM_ANT_L], shade: 1.02 },
      { v: [V_SCUTE_ANT_R, V_RIM_ANT_R, V_RIM_NECK], shade: 1.15 },

      // Mid-Lateral Carapace Left
      { v: [V_SCUTE_ANT_L, V_RIM_ANT_L, V_RIM_MID_L], shade: 0.98 },
      { v: [V_SCUTE_ANT_L, V_RIM_MID_L, V_SCUTE_MID_L], shade: 1.04 },
      { v: [V_SCUTE_MID_L, V_RIM_MID_L, V_SCUTE_POST_L], shade: 0.94 },
      { v: [V_SCUTE_POST_L, V_RIM_MID_L, V_RIM_POST_L], shade: 0.90 },

      // Mid-Lateral Carapace Right
      { v: [V_SCUTE_ANT_R, V_RIM_MID_R, V_RIM_ANT_R], shade: 1.16 },
      { v: [V_SCUTE_ANT_R, V_SCUTE_MID_R, V_RIM_MID_R], shade: 1.12 },
      { v: [V_SCUTE_MID_R, V_SCUTE_POST_R, V_RIM_MID_R], shade: 1.08 },
      { v: [V_SCUTE_POST_R, V_RIM_POST_R, V_RIM_MID_R], shade: 1.02 },

      // Posterior Carapace Rim
      { v: [V_SCUTE_POST_L, V_RIM_POST_L, V_RIM_TAIL], shade: 0.88 },
      { v: [V_SCUTE_POST_L, V_RIM_TAIL, V_SCUTE_POST], shade: 0.92 },
      { v: [V_SCUTE_POST_R, V_RIM_TAIL, V_RIM_POST_R], shade: 1.00 },
      { v: [V_SCUTE_POST, V_RIM_TAIL, V_SCUTE_POST_R], shade: 0.96 },

      // Head & Snout
      { v: [V_HEAD_CROWN, V_HEAD_L, V_SNOUT], shade: 1.06 },
      { v: [V_HEAD_CROWN, V_SNOUT, V_HEAD_R], shade: 1.18 },
      { v: [V_RIM_NECK, V_HEAD_L, V_HEAD_CROWN], shade: 1.02 },
      { v: [V_RIM_NECK, V_HEAD_CROWN, V_HEAD_R], shade: 1.14 },
      { v: [V_THROAT, V_SNOUT, V_HEAD_L], shade: 0.94 },
      { v: [V_THROAT, V_HEAD_R, V_SNOUT], shade: 1.00 },

      // Front Left Swimming Flipper
      { v: [V_FLIP_L_LEAD, V_FLIP_L_TIP, V_FLIP_L_RIDGE], shade: 0.98 },
      { v: [V_FLIP_L_LEAD, V_FLIP_L_TRAIL, V_FLIP_L_TIP], shade: 0.88 },

      // Front Right Swimming Flipper
      { v: [V_FLIP_R_LEAD, V_FLIP_R_RIDGE, V_FLIP_R_TIP], shade: 1.15 },
      { v: [V_FLIP_R_LEAD, V_FLIP_R_TIP, V_FLIP_R_TRAIL], shade: 1.06 },

      // Rear Flippers
      { v: [V_RFLIP_L_ROOT, V_RFLIP_L_TIP, V_RFLIP_L_IN], shade: 0.86 },
      { v: [V_RFLIP_R_ROOT, V_RFLIP_R_IN, V_RFLIP_R_TIP], shade: 0.98 },

      // Needle Tail
      { v: [V_RIM_TAIL, V_TAIL_TIP, V_RIM_POST_L], shade: 0.88 },
      { v: [V_RIM_TAIL, V_RIM_POST_R, V_TAIL_TIP], shade: 0.96 },

      // Underside Plastron (Seals bottom & casts clean contact shadow)
      { v: [V_BELLY_CENTER, V_RIM_ANT_L, V_RIM_NECK], shade: 0.85 },
      { v: [V_BELLY_CENTER, V_RIM_NECK, V_RIM_ANT_R], shade: 0.85 },
      { v: [V_BELLY_CENTER, V_RIM_MID_L, V_RIM_ANT_L], shade: 0.80 },
      { v: [V_BELLY_CENTER, V_RIM_ANT_R, V_RIM_MID_R], shade: 0.85 },
      { v: [V_BELLY_CENTER, V_RIM_POST_L, V_RIM_MID_L], shade: 0.78 },
      { v: [V_BELLY_CENTER, V_RIM_MID_R, V_RIM_POST_R], shade: 0.82 },
      { v: [V_BELLY_CENTER, V_RIM_TAIL, V_RIM_POST_L], shade: 0.76 },
      { v: [V_BELLY_CENTER, V_RIM_POST_R, V_RIM_TAIL], shade: 0.80 },
    ];

    const group = new THREE.Group();

    for (const face of faces) {
      const geom = new THREE.BufferGeometry().setFromPoints(face.v);
      geom.computeVertexNormals();

      const uvs = [
        (face.v[0].x + 2.5) / 5,
        (face.v[0].z + 2.5) / 5,
        (face.v[1].x + 2.5) / 5,
        (face.v[1].z + 2.5) / 5,
        (face.v[2].x + 2.5) / 5,
        (face.v[2].z + 2.5) / 5,
      ];
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

      const color = new THREE.Color(paperStyle.primaryColor).multiplyScalar(face.shade);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0.03,
        flatShading: true,
        side: THREE.DoubleSide,
        map: patternTexture,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        face.v[0],
        face.v[1],
        face.v[1],
        face.v[2],
        face.v[2],
        face.v[0],
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x000000,
        opacity: 0.22,
        transparent: true,
      });
      const line = new THREE.LineSegments(lineGeom, lineMat);
      group.add(line);
    }

    this.origamiModelGroup.add(group);
  }

  /**
   * Creates a 3D paper facet with front and back materials, crisp edges, and Z-layering.
   * If vertices include non-zero Z coordinates, builds true 3D spatial geometry with volumetric depth.
   */
  private createFacetMesh(
    facet: PaperFacet,
    paperStyle: OrigamiPaperStyle,
    patternTexture: THREE.CanvasTexture | null,
    zIndex: number
  ): THREE.Group | null {
    if (!facet.points) return null;
    const rawPoints = this.parsePoints(facet.points);
    if (rawPoints.length < 3) return null;

    const has3D = rawPoints.some((p) => Math.abs(p.z) > 0.05);

    if (has3D) {
      // 1. Build genuine 3D spatial BufferGeometry with volumetric vertices
      const geometry = new THREE.BufferGeometry();
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (const pt of rawPoints) {
        positions.push(pt.u, pt.v, pt.w);
        uvs.push(pt.x / 500, 1 - pt.y / 500);
      }

      // Fan triangulation for convex polygon / triangle / quad in 3D
      for (let i = 1; i < rawPoints.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      // Double-sided material with faceted shading for authentic folded paper feel
      const color = this.getFacetFrontColor(facet, paperStyle);
      const material = new THREE.MeshStandardMaterial({
        color,
        side: THREE.DoubleSide,
        roughness: 0.62,
        metalness: 0.03,
        map: facet.isReverseSide || facet.fillOverride ? null : patternTexture,
        flatShading: true,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Crisp perimeter crease lines along the 3D facet
      const linePoints: THREE.Vector3[] = [];
      for (let i = 0; i < rawPoints.length; i++) {
        const p1 = rawPoints[i];
        const p2 = rawPoints[(i + 1) % rawPoints.length];
        linePoints.push(new THREE.Vector3(p1.u, p1.v, p1.w));
        linePoints.push(new THREE.Vector3(p2.u, p2.v, p2.w));
      }
      const edgeLineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
      const edgeLine = new THREE.LineSegments(
        edgeLineGeom,
        new THREE.LineBasicMaterial({
          color: 0x000000,
          opacity: 0.22,
          transparent: true,
        })
      );

      const facetGroup = new THREE.Group();
      facetGroup.add(mesh);
      facetGroup.add(edgeLine);
      // Directly positioned in real 3D space by vertex coordinates
      facetGroup.position.z = 0;

      return facetGroup;
    }

    // 2. Flat 2D Paper Facet with double-sided layering (for flat steps on tabletop)
    // Ensure counter-clockwise winding so front normal faces +Z
    const pts = this.ensureCounterClockwise(rawPoints);

    const shape = new THREE.Shape();
    shape.moveTo(pts[0].u, pts[0].v);
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo(pts[i].u, pts[i].v);
    }
    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);
    geometry.computeVertexNormals();

    // Front Material: Colored / Patterned or Fill Override or Cream
    const frontColor = this.getFacetFrontColor(facet, paperStyle);
    const frontMat = new THREE.MeshStandardMaterial({
      color: frontColor,
      side: THREE.FrontSide,
      roughness: 0.62,
      metalness: 0.03,
      map: facet.isReverseSide || facet.fillOverride ? null : patternTexture,
      flatShading: true,
    });

    // Back Material: Authentic Washi Cream / White Reverse Side
    const backColor = this.getFacetBackColor(facet, paperStyle);
    const backMat = new THREE.MeshStandardMaterial({
      color: backColor,
      side: THREE.BackSide,
      roughness: 0.68,
      metalness: 0.03,
      flatShading: true,
    });

    const frontMesh = new THREE.Mesh(geometry, frontMat);
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;

    const backMesh = new THREE.Mesh(geometry, backMat);
    backMesh.castShadow = true;
    backMesh.receiveShadow = true;

    // Crisp Fold Edge Line along facet perimeter
    const edgesGeom = new THREE.EdgesGeometry(geometry);
    const edgeLine = new THREE.LineSegments(
      edgesGeom,
      new THREE.LineBasicMaterial({
        color: 0x000000,
        opacity: 0.22,
        transparent: true,
      })
    );

    const facetGroup = new THREE.Group();
    facetGroup.add(frontMesh);
    facetGroup.add(backMesh);
    facetGroup.add(edgeLine);

    // Physical sub-millimeter layer stacking along Z to prevent Z-fighting and replicate real folded layers
    facetGroup.position.z = zIndex * 0.0035;

    return facetGroup;
  }

  /**
   * Renders 3D fold crease lines (mountain, valley, guides) slightly above the top paper layer.
   */
  private createCreaseLines3D(
    creaseLines: OrigamiStep['creaseLines'],
    facetCount: number
  ): THREE.Group {
    const group = new THREE.Group();
    if (!creaseLines) return group;

    const topZ = facetCount * 0.0035 + 0.006;

    for (const line of creaseLines) {
      const p1 = new THREE.Vector3((line.x1 - 250) * 0.009, -(line.y1 - 250) * 0.009, topZ);
      const p2 = new THREE.Vector3((line.x2 - 250) * 0.009, -(line.y2 - 250) * 0.009, topZ);

      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);

      let color = 0xfde047; // Valley: Golden yellow
      let dashSize = 0.08;
      let gapSize = 0.04;

      if (line.type === 'mountain') {
        color = 0xf97316; // Mountain: Warm amber
        dashSize = 0.12;
        gapSize = 0.04;
      } else if (line.type === 'guide') {
        color = 0xffffff; // Guide: Clean white
        dashSize = 0.05;
        gapSize = 0.05;
      }

      const mat = new THREE.LineDashedMaterial({
        color,
        dashSize,
        gapSize,
        linewidth: 2,
      });

      const lineObj = new THREE.Line(geom, mat);
      lineObj.computeLineDistances();
      group.add(lineObj);
    }

    return group;
  }

  /**
   * Renders an arched 3D fold direction arrow floating above the paper with a golden cone tip.
   */
  private createMotionArrow3D(
    arrow: NonNullable<OrigamiStep['arrow']>,
    facetCount: number
  ): THREE.Group {
    const group = new THREE.Group();
    const topZ = facetCount * 0.0035 + 0.01;

    const start = new THREE.Vector3((arrow.fromX - 250) * 0.009, -(arrow.fromY - 250) * 0.009, topZ);
    const end = new THREE.Vector3((arrow.toX - 250) * 0.009, -(arrow.toY - 250) * 0.009, topZ);

    // Arched apex in 3D space
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2 + (arrow.curveOffset || 0) * 0.004,
      (start.y + end.y) / 2,
      topZ + 0.38
    );

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const curvePoints = curve.getPoints(24);
    const curveGeom = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const curveMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.08,
      gapSize: 0.04,
    });
    const curveLine = new THREE.Line(curveGeom, curveMat);
    curveLine.computeLineDistances();
    group.add(curveLine);

    // 3D Arrowhead Cone
    const coneGeom = new THREE.ConeGeometry(0.07, 0.18, 12);
    coneGeom.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const coneMesh = new THREE.Mesh(coneGeom, coneMat);
    coneMesh.position.copy(end);

    const tangent = curve.getTangent(1).normalize();
    coneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    group.add(coneMesh);

    return group;
  }

  // ----------------------------------------------------
  // GEOMETRIC & TEXTURE UTILITIES
  // ----------------------------------------------------
  private getActiveFoldAnimation(step: OrigamiStep): FoldAnimation | null {
    if (step.foldAnimation) {
      return step.foldAnimation;
    }
    if (step.creaseType === 'turnover') {
      return { type: 'turnover', rotateTransform: 'rotateY(180deg)' };
    }
    if (step.creaseType === 'squash') {
      return { type: 'squash' };
    }
    if (step.creaseType === 'reverse') {
      return { type: 'reverse' };
    }
    if (step.creaseType === 'final') {
      return { type: 'final' };
    }
    return { type: 'squash' };
  }

  private normalizePoints(points: string | undefined): string {
    if (!points) return '';
    return points.trim().replace(/\s+/g, ' ');
  }

  private parsePoints(pointsStr: string | undefined): Point3D[] {
    if (!pointsStr) return [];
    const parts = pointsStr.trim().split(/\s+/);
    const pts: Point3D[] = [];

    for (const p of parts) {
      if (!p.includes(',')) continue;
      const coords = p.split(',');
      const x = parseFloat(coords[0]);
      const y = parseFloat(coords[1]);
      const z = coords.length > 2 ? parseFloat(coords[2]) : 0;
      if (isNaN(x) || isNaN(y)) continue;
      const finalZ = isNaN(z) ? 0 : z;

      if (pts.length > 0) {
        const prev = pts[pts.length - 1];
        if (Math.hypot(prev.x - x, prev.y - y, prev.z - finalZ) < 0.1) continue;
      }

      pts.push({
        x,
        y,
        z: finalZ,
        u: (x - 250) * 0.009,
        v: -(y - 250) * 0.009,
        w: finalZ * 0.009,
      });
    }

    if (pts.length > 2) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z) < 0.1) {
        pts.pop();
      }
    }

    return pts;
  }

  private ensureCounterClockwise(pts: Point3D[]): Point3D[] {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i].u * pts[j].v - pts[j].u * pts[i].v;
    }
    if (area < 0) {
      return [...pts].reverse();
    }
    return pts;
  }

  private getFacetFrontColor(facet: PaperFacet, paperStyle: OrigamiPaperStyle): THREE.Color {
    if (facet.fillOverride) {
      return new THREE.Color(facet.fillOverride);
    }
    if (facet.isReverseSide) {
      const shade = facet.shadeFactor ?? 1.0;
      const base = Math.min(1.0, 0.98 * shade);
      return new THREE.Color(base, base * 0.98, base * 0.94);
    }

    const color = new THREE.Color(paperStyle.primaryColor);
    if (facet.shadeFactor) {
      color.multiplyScalar(facet.shadeFactor);
    }
    return color;
  }

  private getFacetBackColor(facet: PaperFacet, paperStyle: OrigamiPaperStyle): THREE.Color {
    if (facet.fillOverride) {
      return new THREE.Color(facet.fillOverride);
    }
    if (facet.isReverseSide) {
      const color = new THREE.Color(paperStyle.primaryColor);
      if (facet.shadeFactor) {
        color.multiplyScalar(facet.shadeFactor);
      }
      return color;
    }
    return new THREE.Color(0.98, 0.96, 0.92);
  }

  private getPaperTexture(paperStyle: OrigamiPaperStyle): THREE.CanvasTexture | null {
    if (paperStyle.patternType === 'solid') return null;

    const key = `${paperStyle.id}_${paperStyle.primaryColor}_${paperStyle.accentColor}`;
    if (this.textureCache.has(key)) {
      return this.textureCache.get(key)!;
    }

    let texture: THREE.CanvasTexture | null = null;
    if (paperStyle.patternType === 'seigaiha') {
      texture = this.createSeigaihaTexture(paperStyle.primaryColor, paperStyle.accentColor || '#ffffff');
    } else if (paperStyle.patternType === 'asanoha') {
      texture = this.createAsanohaTexture(paperStyle.primaryColor, paperStyle.accentColor || '#ffffff');
    }

    if (texture) {
      this.textureCache.set(key, texture);
    }
    return texture;
  }

  private createSeigaihaTexture(primary: string, accent: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;

    const drawWave = (cx: number, cy: number) => {
      for (let r = 12; r <= 32; r += 7) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
        ctx.stroke();
      }
    };

    for (let x = 0; x <= 128; x += 32) {
      drawWave(x, 32);
      drawWave(x, 96);
    }
    for (let x = -16; x <= 144; x += 32) {
      drawWave(x, 64);
      drawWave(x, 128);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  private createAsanohaTexture(primary: string, accent: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6;

    const s = 32;
    for (let y = 0; y <= 128; y += s) {
      for (let x = 0; x <= 128; x += s) {
        ctx.beginPath();
        ctx.moveTo(x, y - s / 2);
        ctx.lineTo(x + s / 2, y);
        ctx.lineTo(x, y + s / 2);
        ctx.lineTo(x - s / 2, y);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y - s / 2);
        ctx.lineTo(x, y + s / 2);
        ctx.moveTo(x - s / 2, y);
        ctx.lineTo(x + s / 2, y);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  private clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);

      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      } else if (obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      } else if (obj instanceof THREE.Group) {
        this.clearGroup(obj);
      }
    }
  }

  private cleanupThree(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    if (this.origamiModelGroup) {
      this.clearGroup(this.origamiModelGroup);
      this.scene?.remove(this.origamiModelGroup);
      this.origamiModelGroup = undefined;
    }

    if (this.contactShadowMesh) {
      this.contactShadowMesh.geometry.dispose();
      if (Array.isArray(this.contactShadowMesh.material)) {
        this.contactShadowMesh.material.forEach((m) => m.dispose());
      } else {
        this.contactShadowMesh.material.dispose();
      }
      this.scene?.remove(this.contactShadowMesh);
      this.contactShadowMesh = undefined;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer = undefined;
    }

    this.scene = undefined;
    this.camera = undefined;
  }
}
