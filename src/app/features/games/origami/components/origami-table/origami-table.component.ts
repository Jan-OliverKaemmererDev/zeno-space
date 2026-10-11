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
import { OrigamiTextureService } from '../../services/origami-texture.service';
import { Origami3dBuilderService } from '../../services/origami-3d-builder.service';
import {
  ActiveFoldAnimation,
  OrigamiAnimatorService,
} from '../../services/origami-animator.service';
import { OrigamiPaperStyle, OrigamiStep } from '../../models/origami.models';
import { OrigamiCraneComponent } from '../animals/origami-crane/origami-crane.component';
import { OrigamiOwlComponent } from '../animals/origami-owl/origami-owl.component';
import { OrigamiTurtleComponent } from '../animals/origami-turtle/origami-turtle.component';
import { OrigamiDeskAmbientComponent } from './origami-desk-ambient/origami-desk-ambient.component';
import { OrigamiEmptyTableComponent } from './origami-empty-table/origami-empty-table.component';
import { OrigamiStepInstructionComponent } from './origami-step-instruction/origami-step-instruction.component';

/**
 * Interactive 3D desktop workspace for the Origami zen game using Three.js.
 * The paper model hovers freely above the wooden desk without any surrounding frame or depression.
 * Coordinates 3D physical folding animations, free 3D mouse-drag rotation,
 * and delegates animal models and UI sections to modular subcomponents.
 */
@Component({
  selector: 'app-origami-table',
  standalone: true,
  imports: [
    CommonModule,
    OrigamiDeskAmbientComponent,
    OrigamiEmptyTableComponent,
    OrigamiStepInstructionComponent,
    OrigamiCraneComponent,
    OrigamiOwlComponent,
    OrigamiTurtleComponent,
  ],
  templateUrl: './origami-table.component.html',
  styleUrl: './origami-table.component.scss',
})
export class OrigamiTableComponent implements OnDestroy {
  readonly state = inject(OrigamiStateService);
  private readonly ngZone = inject(NgZone);
  private readonly textureService = inject(OrigamiTextureService);
  private readonly builder3D = inject(Origami3dBuilderService);
  private readonly animator = inject(OrigamiAnimatorService);

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
            this.targetRotX = OrigamiCraneComponent.DEFAULT_ROTATION.rotX;
            this.targetRotY = OrigamiCraneComponent.DEFAULT_ROTATION.rotY;
          } else if (pattern?.id === 'turtle' && step.stepNumber === 14) {
            this.targetRotX = OrigamiTurtleComponent.DEFAULT_ROTATION.rotX;
            this.targetRotY = OrigamiTurtleComponent.DEFAULT_ROTATION.rotY;
          } else if (pattern?.id === 'owl' && step.stepNumber === 12) {
            this.targetRotX = OrigamiOwlComponent.DEFAULT_ROTATION.rotX;
            this.targetRotY = OrigamiOwlComponent.DEFAULT_ROTATION.rotY;
          }
          this.buildOrigami3DModel(step, paperStyle, showGuides);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupThree();
    this.textureService.dispose();
  }

  /**
   * Resets the 3D model view back to the initial default angle and zoom.
   */
  resetView(): void {
    const patternId = this.state.selectedPattern()?.id;
    const stepNumber = this.state.currentStep()?.stepNumber;

    if (patternId === 'crane' && stepNumber === 18) {
      this.targetRotX = OrigamiCraneComponent.DEFAULT_ROTATION.rotX;
      this.targetRotY = OrigamiCraneComponent.DEFAULT_ROTATION.rotY;
    } else if (patternId === 'turtle' && stepNumber === 14) {
      this.targetRotX = OrigamiTurtleComponent.DEFAULT_ROTATION.rotX;
      this.targetRotY = OrigamiTurtleComponent.DEFAULT_ROTATION.rotY;
    } else if (patternId === 'owl' && stepNumber === 12) {
      this.targetRotX = OrigamiOwlComponent.DEFAULT_ROTATION.rotX;
      this.targetRotY = OrigamiOwlComponent.DEFAULT_ROTATION.rotY;
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
    if (event.button !== 0) return;
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

    this.targetRotY += deltaX * 0.009;
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

      // Smooth damped zoom interpolation
      if (Math.abs(this.camera.position.z - this.targetZoom) > 0.005) {
        this.camera.position.z += (this.targetZoom - this.camera.position.z) * 0.15;
      }

      // Execute physical 3D folding animation progression
      this.updateFoldAnimationProgress();

      this.renderer.render(this.scene, this.camera);
      this.animationFrameId = requestAnimationFrame(render);
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  /**
   * Drives physical 3D hinge flap rotations, turnovers, and squash compressions in real time.
   */
  private updateFoldAnimationProgress(): void {
    if (!this.activeFoldAnimation) return;

    const now = performance.now();
    const elapsed = now - this.activeFoldAnimation.startTime;
    const progress = Math.min(1, elapsed / this.activeFoldAnimation.duration);

    const eased =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    if (this.activeFoldAnimation.type === 'turnover' && this.activeFoldAnimation.pivotGroup) {
      this.activeFoldAnimation.pivotGroup.rotation.y = eased * Math.PI;
      const lift = Math.sin(progress * Math.PI) * 0.45;
      this.activeFoldAnimation.pivotGroup.position.z = lift;
    } else if (
      this.activeFoldAnimation.type === 'flap' &&
      this.activeFoldAnimation.pivotGroup &&
      this.activeFoldAnimation.axis
    ) {
      const startAngle = this.activeFoldAnimation.startAngle ?? 0;
      const targetAngle = this.activeFoldAnimation.targetAngle ?? Math.PI;
      const currentAngle = startAngle + (targetAngle - startAngle) * eased;

      const q = new THREE.Quaternion();
      q.setFromAxisAngle(this.activeFoldAnimation.axis, currentAngle);
      this.activeFoldAnimation.pivotGroup.quaternion.copy(q);

      const lift = Math.sin(progress * Math.PI) * 0.22;
      this.activeFoldAnimation.pivotGroup.position.z = 0.015 + lift;
    } else if (this.activeFoldAnimation.type === 'squash' && this.origamiModelGroup) {
      const pulse = 1.0 + Math.sin(progress * Math.PI) * 0.045;
      this.origamiModelGroup.scale.set(pulse, pulse, pulse);
    }

    if (this.activeFoldAnimation.creaseFlashMaterial) {
      this.activeFoldAnimation.creaseFlashMaterial.opacity = Math.sin(progress * Math.PI) * 0.95;
    }

    if (progress >= 1) {
      if (this.activeFoldAnimation.creaseFlashMaterial) {
        this.activeFoldAnimation.creaseFlashMaterial.dispose();
      }
      this.activeFoldAnimation = undefined;
      const step = this.state.currentStep();
      if (step) {
        this.buildOrigami3DModel(
          step,
          this.state.selectedPaperStyle(),
          this.state.showGuideLines()
        );
      }
    }
  }

  /**
   * Sets up physical 3D animation hierarchy: stationary facets vs moving flap on rotating hinge.
   */
  private trigger3DFoldAnimation(
    currentStep: OrigamiStep,
    nextStep: OrigamiStep,
    paperStyle: OrigamiPaperStyle
  ): void {
    if (!this.origamiModelGroup) return;

    this.clearGroup(this.origamiModelGroup);
    const texture = this.textureService.getPaperTexture(paperStyle);

    this.activeFoldAnimation = this.animator.createAnimation(
      currentStep,
      nextStep,
      paperStyle,
      texture,
      this.origamiModelGroup,
      this.builder3D
    );
  }

  // ----------------------------------------------------
  // PROCEDURAL 3D MESH GENERATION FROM STEP FACETS
  // ----------------------------------------------------
  /**
   * Reconstructs the resting 3D origami paper model from the current step's facets,
   * guideline creases, and fold direction arrow, or delegates to animal models when complete.
   */
  private buildOrigami3DModel(
    step: OrigamiStep,
    paperStyle: OrigamiPaperStyle,
    showGuideLines: boolean
  ): void {
    if (!this.origamiModelGroup) return;

    this.clearGroup(this.origamiModelGroup);
    const texture = this.textureService.getPaperTexture(paperStyle);

    // For completed models, render authentic masterwork 3D origami sculptures from dedicated animal components
    const patternId = this.state.selectedPattern()?.id;
    if (patternId === 'crane' && step.stepNumber === 18) {
      this.origamiModelGroup.add(OrigamiCraneComponent.build3DModel(paperStyle, texture));
      return;
    }
    if (patternId === 'owl' && step.stepNumber === 12) {
      this.origamiModelGroup.add(OrigamiOwlComponent.build3DModel(paperStyle, texture));
      return;
    }
    if (patternId === 'turtle' && step.stepNumber === 14) {
      this.origamiModelGroup.add(OrigamiTurtleComponent.build3DModel(paperStyle, texture));
      return;
    }

    // Build each facet with authentic double-sided paper and subtle Z-stacking
    const totalFacets = step.facets.length;
    step.facets.forEach((facet, index) => {
      const facetGroup = this.builder3D.createFacetMesh(facet, paperStyle, texture, index);
      if (facetGroup) {
        this.origamiModelGroup!.add(facetGroup);
      }
    });

    // Build Crease Guidelines in 3D (Mountain, Valley, Guide)
    if (showGuideLines && step.creaseLines && step.creaseLines.length > 0) {
      const creasesGroup = this.builder3D.createCreaseLines3D(step.creaseLines, totalFacets);
      this.origamiModelGroup.add(creasesGroup);
    }

    // Build Fold Motion Trajectory Arrow in 3D
    if (showGuideLines && step.arrow) {
      const arrowGroup = this.builder3D.createMotionArrow3D(step.arrow, totalFacets);
      this.origamiModelGroup.add(arrowGroup);
    }
  }

  private clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      this.disposeObject(child);
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    if ((obj as THREE.Mesh).geometry) {
      (obj as THREE.Mesh).geometry.dispose();
    }
    if ((obj as THREE.Mesh).material) {
      const mat = (obj as THREE.Mesh).material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else {
        mat.dispose();
      }
    }
    if (obj.children) {
      obj.children.forEach((c) => this.disposeObject(c));
    }
  }

  private cleanupThree(): void {
    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    if (this.origamiModelGroup) {
      this.clearGroup(this.origamiModelGroup);
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = undefined;
    }

    this.scene = undefined;
    this.camera = undefined;
  }
}
