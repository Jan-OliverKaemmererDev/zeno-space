import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { CreaseLine, FoldArrow, OrigamiPaperStyle, PaperFacet } from '../models/origami.models';

export interface Point3D {
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
  w: number;
}

/**
 * Service responsible for constructing procedural 3D Three.js geometry from paper step facets,
 * guideline crease segments, and fold trajectory arrows.
 */
@Injectable({
  providedIn: 'root',
})
export class Origami3dBuilderService {
  /**
   * Creates a 3D paper facet with front and back materials, crisp edges, and Z-layering.
   * If vertices include non-zero Z coordinates, builds genuine 3D spatial BufferGeometry.
   */
  createFacetMesh(
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

      for (let i = 1; i < rawPoints.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

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
      facetGroup.position.z = 0;

      return facetGroup;
    }

    // 2. Flat 2D Paper Facet with double-sided layering (for flat steps on tabletop)
    let points = rawPoints.map((p) => new THREE.Vector2(p.u, p.v));
    const area = this.polygonSignedArea(points);
    if (area < 0) {
      points.reverse();
    }

    const shape = new THREE.Shape(points);
    const geometry = new THREE.ShapeGeometry(shape);

    const uvs = geometry.attributes['position'].array;
    const uvArray = new Float32Array((uvs.length / 3) * 2);
    for (let i = 0, j = 0; i < uvs.length; i += 3, j += 2) {
      uvArray[j] = (uvs[i] + 2.5) / 5;
      uvArray[j + 1] = (uvs[i + 1] + 2.5) / 5;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));

    const frontColor = this.getFacetFrontColor(facet, paperStyle);
    const frontMat = new THREE.MeshStandardMaterial({
      color: frontColor,
      side: THREE.FrontSide,
      roughness: 0.62,
      metalness: 0.03,
      map: facet.isReverseSide || facet.fillOverride ? null : patternTexture,
      flatShading: true,
    });
    const frontMesh = new THREE.Mesh(geometry, frontMat);
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;

    const backColor = this.getFacetBackColor(facet, paperStyle);
    const backMat = new THREE.MeshStandardMaterial({
      color: backColor,
      side: THREE.BackSide,
      roughness: 0.68,
      metalness: 0.02,
      map: !facet.isReverseSide && !facet.fillOverride ? null : patternTexture,
      flatShading: true,
    });
    const backMesh = new THREE.Mesh(geometry, backMat);
    backMesh.castShadow = true;
    backMesh.receiveShadow = true;

    const edges = new THREE.EdgesGeometry(geometry, 15);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x000000,
      opacity: 0.22,
      transparent: true,
      linewidth: 1,
    });
    const edgeLines = new THREE.LineSegments(edges, lineMat);

    const facetGroup = new THREE.Group();
    facetGroup.add(frontMesh);
    facetGroup.add(backMesh);
    facetGroup.add(edgeLines);

    facetGroup.position.z = zIndex * 0.003;

    return facetGroup;
  }

  /**
   * Constructs 3D crease guidelines (Mountain, Valley, Guide).
   */
  createCreaseLines3D(creases: CreaseLine[], totalFacets: number): THREE.Group {
    const group = new THREE.Group();
    const elevatedZ = totalFacets * 0.003 + 0.006;

    for (const crease of creases) {
      const p1 = this.coordToThree(crease.x1, crease.y1);
      const p2 = this.coordToThree(crease.x2, crease.y2);

      const points = [
        new THREE.Vector3(p1.u, p1.v, elevatedZ),
        new THREE.Vector3(p2.u, p2.v, elevatedZ),
      ];

      const geom = new THREE.BufferGeometry().setFromPoints(points);
      const color = crease.type === 'valley' ? 0xec4899 : crease.type === 'mountain' ? 0xf97316 : 0x38bdf8;

      const mat = new THREE.LineDashedMaterial({
        color,
        dashSize: 0.12,
        gapSize: 0.06,
        linewidth: 2,
        transparent: true,
        opacity: 0.85,
      });

      const line = new THREE.Line(geom, mat);
      line.computeLineDistances();
      group.add(line);
    }

    return group;
  }

  /**
   * Constructs 3D fold trajectory motion arrow with curved spline and cone head.
   */
  createMotionArrow3D(arrow: FoldArrow, totalFacets: number): THREE.Group {
    const group = new THREE.Group();
    const elevatedZ = totalFacets * 0.003 + 0.012;

    const pStart = this.coordToThree(arrow.fromX, arrow.fromY);
    const pEnd = this.coordToThree(arrow.toX, arrow.toY);

    const midX = (pStart.u + pEnd.u) / 2;
    const midY = (pStart.v + pEnd.v) / 2;
    const curveOffset = (arrow.curveOffset || 0) * (5.0 / 500);

    const perpX = -(pEnd.v - pStart.v);
    const perpY = pEnd.u - pStart.u;
    const len = Math.hypot(perpX, perpY) || 1;
    const ctrlX = midX + (perpX / len) * curveOffset;
    const ctrlY = midY + (perpY / len) * curveOffset;

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(pStart.u, pStart.v, elevatedZ),
      new THREE.Vector3(ctrlX, ctrlY, elevatedZ + 0.15),
      new THREE.Vector3(pEnd.u, pEnd.v, elevatedZ)
    );

    const curvePoints = curve.getPoints(24);
    const lineGeom = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      linewidth: 3,
      transparent: true,
      opacity: 0.92,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    group.add(line);

    const coneGeom = new THREE.ConeGeometry(0.08, 0.22, 12);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.35,
      metalness: 0.1,
    });
    const cone = new THREE.Mesh(coneGeom, coneMat);

    const pTangent = curve.getTangent(1).normalize();
    cone.position.set(pEnd.u, pEnd.v, elevatedZ);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pTangent);
    group.add(cone);

    return group;
  }

  /**
   * Parses SVG coordinate points (supporting 2D 'x,y' or 3D 'x,y,z').
   */
  parsePoints(pointsStr: string): Point3D[] {
    return pointsStr
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const parts = pair.split(',').map(Number);
        const x = parts[0] ?? 0;
        const y = parts[1] ?? 0;
        const z = parts[2] ?? 0;
        const threePt = this.coordToThree(x, y, z);
        return {
          x,
          y,
          z,
          u: threePt.u,
          v: threePt.v,
          w: threePt.w,
        };
      });
  }

  /**
   * Maps 500x500 2D coordinate system with optional Z depth to Three.js centered units.
   */
  coordToThree(x: number, y: number, z = 0): { u: number; v: number; w: number } {
    return {
      u: (x - 250) * (5.0 / 500),
      v: (250 - y) * (5.0 / 500),
      w: z * (5.0 / 500),
    };
  }

  /**
   * Computes polygon signed area for counter-clockwise normal winding.
   */
  polygonSignedArea(pts: THREE.Vector2[]): number {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      sum += (p2.x - p1.x) * (p2.y + p1.y);
    }
    return sum;
  }

  /**
   * Returns front material color based on paper style and facet shading.
   */
  getFacetFrontColor(facet: PaperFacet, paperStyle: OrigamiPaperStyle): THREE.Color {
    if (facet.fillOverride) {
      return new THREE.Color(facet.fillOverride);
    }
    const baseHex = facet.isReverseSide
      ? paperStyle.secondaryColor || '#ffffff'
      : paperStyle.primaryColor;
    const factor = facet.shadeFactor ?? 1.0;
    return new THREE.Color(baseHex).multiplyScalar(factor);
  }

  /**
   * Returns back material color based on paper style and reverse state.
   */
  getFacetBackColor(facet: PaperFacet, paperStyle: OrigamiPaperStyle): THREE.Color {
    if (facet.fillOverride) {
      return new THREE.Color(facet.fillOverride);
    }
    const baseHex = facet.isReverseSide
      ? paperStyle.primaryColor
      : paperStyle.secondaryColor || '#ffffff';
    const factor = (facet.shadeFactor ?? 1.0) * 0.95;
    return new THREE.Color(baseHex).multiplyScalar(factor);
  }
}
