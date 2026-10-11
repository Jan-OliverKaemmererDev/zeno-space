import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { FoldAnimation, OrigamiPaperStyle, OrigamiStep, PaperFacet } from '../models/origami.models';
import { Origami3dBuilderService } from './origami-3d-builder.service';

export interface ActiveFoldAnimation {
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
 * Service orchestrating physical 3D paper folding animations (hinge flap rotations,
 * sheet turnovers, squash flexes, and glowing crease flashes).
 */
@Injectable({
  providedIn: 'root',
})
export class OrigamiAnimatorService {
  /**
   * Sets up physical 3D animation hierarchy: stationary facets vs moving flap on rotating hinge.
   */
  createAnimation(
    currentStep: OrigamiStep,
    nextStep: OrigamiStep,
    paperStyle: OrigamiPaperStyle,
    texture: THREE.CanvasTexture | null,
    modelGroup: THREE.Group,
    builder3D: Origami3dBuilderService
  ): ActiveFoldAnimation | undefined {
    const anim = currentStep.foldAnimation;

    // 1. Whole-Sheet 3D Turnover
    if (anim?.type === 'turnover') {
      const turnoverGroup = new THREE.Group();

      currentStep.facets.forEach((f, i) => {
        const mesh = builder3D.createFacetMesh(f, paperStyle, texture, i);
        if (mesh) turnoverGroup.add(mesh);
      });

      const backFacets =
        anim.turnoverBackFacets && anim.turnoverBackFacets.length > 0
          ? anim.turnoverBackFacets
          : nextStep.facets;
      const backGroup = new THREE.Group();
      backFacets.forEach((f, i) => {
        const mesh = builder3D.createFacetMesh(f, paperStyle, texture, i);
        if (mesh) backGroup.add(mesh);
      });
      backGroup.rotation.y = Math.PI;
      turnoverGroup.add(backGroup);

      modelGroup.add(turnoverGroup);
      return {
        type: 'turnover',
        startTime: performance.now(),
        duration: 520,
        pivotGroup: turnoverGroup,
      };
    }

    // 2. Flap or Unfold 3D Hinge Motion
    if ((anim?.type === 'flap' || anim?.type === 'unfold') && anim.flapPoints) {
      const normalizedFlap = this.normalizePoints(anim.flapPoints);
      const stationaryFacets: PaperFacet[] = [];
      let movingFacet: PaperFacet | null = null;

      for (const facet of currentStep.facets) {
        if (!movingFacet && facet.points && this.normalizePoints(facet.points) === normalizedFlap) {
          movingFacet = facet;
        } else {
          stationaryFacets.push(facet);
        }
      }

      if (!movingFacet && currentStep.facets.length > 0) {
        movingFacet = currentStep.facets[currentStep.facets.length - 1];
      }

      stationaryFacets.forEach((f, i) => {
        const mesh = builder3D.createFacetMesh(f, paperStyle, texture, i);
        if (mesh) modelGroup.add(mesh);
      });

      if (movingFacet) {
        const originX = ((anim.origin?.x ?? 250) - 250) * 0.009;
        const originY = -((anim.origin?.y ?? 250) - 250) * 0.009;

        const flapPivotGroup = new THREE.Group();
        flapPivotGroup.position.set(originX, originY, 0.015);

        const flapMeshGroup = builder3D.createFacetMesh(movingFacet, paperStyle, texture, 0);
        if (flapMeshGroup) {
          flapMeshGroup.position.set(-originX, -originY, 0);
          flapPivotGroup.add(flapMeshGroup);
        }

        const { axis, startAngle, targetAngle } = this.resolveFoldAxisAndAngles(
          anim,
          currentStep
        );

        modelGroup.add(flapPivotGroup);

        const creaseMat = this.addCreaseFlash3D(currentStep, modelGroup);

        return {
          type: 'flap',
          startTime: performance.now(),
          duration: 520,
          pivotGroup: flapPivotGroup,
          axis,
          startAngle,
          targetAngle,
          creaseFlashMaterial: creaseMat,
        };
      }
    }

    // 3. Squash / Reverse / Final 3D Fold Flex
    currentStep.facets.forEach((f, i) => {
      const mesh = builder3D.createFacetMesh(f, paperStyle, texture, i);
      if (mesh) modelGroup.add(mesh);
    });

    const creaseMat = this.addCreaseFlash3D(currentStep, modelGroup);
    return {
      type: 'squash',
      startTime: performance.now(),
      duration: 520,
      creaseFlashMaterial: creaseMat,
    };
  }

  /**
   * Resolves the 3D hinge axis vector and start/target rotation angles.
   */
  resolveFoldAxisAndAngles(
    anim: FoldAnimation,
    step: OrigamiStep
  ): {
    axis: THREE.Vector3;
    startAngle: number;
    targetAngle: number;
  } {
    const animClass = anim.animationClass || '';
    const rot = anim.rotateTransform || '';

    if (animClass.includes('fold-up-x') || rot.includes('rotateX(-180deg)')) {
      return { axis: new THREE.Vector3(1, 0, 0), startAngle: 0, targetAngle: -Math.PI };
    }
    if (animClass.includes('fold-down-x') || rot.includes('rotateX(180deg)')) {
      return { axis: new THREE.Vector3(1, 0, 0), startAngle: 0, targetAngle: Math.PI };
    }
    if (animClass.includes('fold-right-y') || rot.includes('rotateY(180deg)')) {
      return { axis: new THREE.Vector3(0, 1, 0), startAngle: 0, targetAngle: Math.PI };
    }
    if (animClass.includes('fold-left-y') || rot.includes('rotateY(-180deg)')) {
      return { axis: new THREE.Vector3(0, 1, 0), startAngle: 0, targetAngle: -Math.PI };
    }
    if (animClass.includes('unfold-down-x')) {
      return { axis: new THREE.Vector3(1, 0, 0), startAngle: -Math.PI, targetAngle: 0 };
    }
    if (animClass.includes('unfold-up-x')) {
      return { axis: new THREE.Vector3(1, 0, 0), startAngle: Math.PI, targetAngle: 0 };
    }
    if (animClass.includes('unfold-right-y')) {
      return { axis: new THREE.Vector3(0, 1, 0), startAngle: -Math.PI, targetAngle: 0 };
    }
    if (animClass.includes('unfold-left-y')) {
      return { axis: new THREE.Vector3(0, 1, 0), startAngle: Math.PI, targetAngle: 0 };
    }
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

    return { axis: new THREE.Vector3(1, 0, 0), startAngle: 0, targetAngle: -Math.PI };
  }

  /**
   * Adds glowing radiant golden crease flash lines at the fold location.
   */
  addCreaseFlash3D(step: OrigamiStep, modelGroup: THREE.Group): THREE.LineBasicMaterial | undefined {
    if (!step.creaseLines || step.creaseLines.length === 0) {
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
      modelGroup.add(lineObj);
    }

    return mat;
  }

  normalizePoints(pointsStr: string): string {
    return pointsStr
      .trim()
      .split(/\s+/)
      .map((p) => p.split(',').slice(0, 2).join(','))
      .sort()
      .join(' ');
  }
}
